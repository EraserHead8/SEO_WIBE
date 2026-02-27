from __future__ import annotations

from datetime import date, datetime, timedelta
import math
import time
from typing import Any

import httpx
from app.services.wb_modules import fetch_wb_campaign_stats_bulk, fetch_wb_campaigns


SALES_TIMEOUT = httpx.Timeout(connect=6.0, read=25.0, write=25.0, pool=25.0)
WB_SALES_TIMEOUT = httpx.Timeout(connect=4.0, read=12.0, write=12.0, pool=12.0)
WB_SALES_CACHE_TTL_SEC = 180
_WB_SALES_CACHE: dict[tuple[str, str, str], tuple[float, list[dict[str, Any]], list[str]]] = {}
WB_SALES_MAX_PAGES = 3
WB_SALES_CONTINUATION_THRESHOLD = 79_500
WB_REPORT_DETAIL_LIMIT = 50_000
WB_REPORT_DETAIL_MAX_PAGES = 3
WB_ADS_TIMEOUT = httpx.Timeout(connect=4.0, read=9.0, write=9.0, pool=9.0)
WB_AD_SPEND_CACHE_TTL_SEC = 180
WB_ADS_MAX_CAMPAIGNS = 120
WB_ADS_MAX_STATS_CHUNKS = 3
_WB_AD_SPEND_CACHE: dict[tuple[str, str, str], tuple[float, float, list[str]]] = {}


def build_sales_report(
    marketplace: str,
    date_from: date,
    date_to: date,
    wb_api_key: str = "",
    ozon_api_key: str = "",
) -> dict[str, Any]:
    selected = (marketplace or "all").strip().lower()
    if selected not in {"all", "wb", "ozon"}:
        selected = "all"

    collected: list[dict[str, Any]] = []
    warnings: list[str] = []

    if selected in {"all", "wb"}:
        if wb_api_key.strip():
            wb_rows, wb_warn = _fetch_wb_sales_rows(wb_api_key.strip(), date_from=date_from, date_to=date_to)
            collected.extend(wb_rows)
            warnings.extend(wb_warn)
        else:
            warnings.append("WB ключ не подключен.")

    if selected in {"all", "ozon"}:
        if ozon_api_key.strip():
            ozon_rows, ozon_warn = _fetch_ozon_sales_rows(ozon_api_key.strip(), date_from=date_from, date_to=date_to)
            collected.extend(ozon_rows)
            warnings.extend(ozon_warn)
        else:
            warnings.append("Ozon ключ не подключен.")

    wb_ad_spend_by_day: dict[str, float] = {}
    if selected in {"all", "wb"} and wb_api_key.strip():
        spent_total, spent_warn = _fetch_wb_ad_spent_total(wb_api_key.strip(), date_from=date_from, date_to=date_to)
        warnings.extend(spent_warn)
        if spent_total > 0:
            days = list(_iter_days(date_from, date_to))
            if days:
                # WB API fullstats returns campaign totals for period, so we distribute evenly by day for trend visibility.
                per_day = round(spent_total / len(days), 2)
                wb_ad_spend_by_day = {day.isoformat(): per_day for day in days}
                drift = round(spent_total - (per_day * len(days)), 2)
                if drift and days:
                    wb_ad_spend_by_day[days[-1].isoformat()] = round(wb_ad_spend_by_day.get(days[-1].isoformat(), 0.0) + drift, 2)

    rows = _aggregate_rows(collected, wb_ad_spend_by_day=wb_ad_spend_by_day)
    chart = _build_chart(rows)
    totals = {
        "orders": int(sum(int(x.get("orders") or 0) for x in rows)),
        "units": int(sum(int(x.get("units") or 0) for x in rows)),
        "revenue": float(round(sum(float(x.get("revenue") or 0.0) for x in rows), 2)),
        "returns": int(sum(int(x.get("returns") or 0) for x in rows)),
        "ad_spend": float(round(sum(float(x.get("ad_spend") or 0.0) for x in rows), 2)),
        "other_costs": float(round(sum(float(x.get("other_costs") or 0.0) for x in rows), 2)),
        "days": len({str(x.get("date") or "") for x in rows}),
    }
    totals["gross_profit"] = float(round(float(totals["revenue"]) - float(totals["ad_spend"]) - float(totals["other_costs"]), 2))
    return {"rows": rows, "chart": chart, "totals": totals, "warnings": warnings}


def _fetch_wb_sales_rows(api_key: str, date_from: date, date_to: date) -> tuple[list[dict[str, Any]], list[str]]:
    cache_key = (api_key[-12:], date_from.isoformat(), date_to.isoformat())
    cached = _WB_SALES_CACHE.get(cache_key)
    now = time.monotonic()
    if cached and now - cached[0] <= WB_SALES_CACHE_TTL_SEC:
        return list(cached[1]), list(cached[2])

    rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    endpoint = "https://statistics-api.wildberries.ru/api/v1/supplier/sales"
    cursor = date_from.isoformat()
    seen_cursors: set[str] = set()
    response_pages: list[list[dict[str, Any]]] = []
    last_error = "WB sales API недоступен."
    for page_idx in range(WB_SALES_MAX_PAGES):
        params = {"dateFrom": cursor, "flag": 0}
        payload, status = _request_wb_sales_payload(api_key=api_key, endpoint=endpoint, params=params)
        if payload is None:
            if status == "rate_limited":
                warnings.append("WB sales API вернул 429, показана частичная статистика.")
                break
            if page_idx == 0:
                if cached:
                    return list(cached[1]), list(cached[2]) + ["WB sales API недоступен, показаны кэшированные данные."]
                return [], [last_error if status == "unavailable" else status]
            warnings.append("WB sales API недоступен, показана частичная статистика.")
            break
        if not isinstance(payload, list) or not payload:
            break
        response_pages.append(payload)

        if len(payload) < WB_SALES_CONTINUATION_THRESHOLD:
            break
        next_cursor = _extract_wb_sales_cursor(payload[-1])
        if not next_cursor or next_cursor in seen_cursors:
            break
        seen_cursors.add(next_cursor)
        cursor = next_cursor
        if page_idx == 0:
            warnings.append("WB sales: период большой, догружаем данные порциями.")

    dedupe_keys: set[str] = set()
    for payload in response_pages:
        for item in payload:
            if not isinstance(item, dict):
                continue
            day = _parse_any_date(
                item.get("date")
                or item.get("saleDate")
                or item.get("lastChangeDate")
            )
            if not day or day < date_from or day > date_to:
                continue
            unique_key = _wb_sale_row_key(item)
            if unique_key in dedupe_keys:
                continue
            dedupe_keys.add(unique_key)

            units_raw = _to_float(item.get("quantity") or item.get("saleQty") or item.get("quantityFull") or 0)
            units = int(round(abs(units_raw)))
            if units <= 0:
                units = 1
            revenue = _to_float(
                item.get("forPay")
                or item.get("totalPrice")
                or item.get("finishedPrice")
                or item.get("priceWithDisc")
                or 0.0
            )
            is_return = bool(
                _is_truthy(item.get("isReturn"))
                or _is_truthy(item.get("is_return"))
                or units_raw < 0
                or revenue < 0
                or str(item.get("saleID") or "").upper().startswith("R")
            )
            safe_revenue = abs(float(round(revenue, 2)))
            if is_return:
                rows.append(
                    {
                        "date": day.isoformat(),
                        "marketplace": "wb",
                        "orders": 0,
                        "units": 0,
                        "revenue": 0.0,
                        "returns": units,
                        "ad_spend": 0.0,
                        "other_costs": safe_revenue,
                    }
                )
                continue
            rows.append(
                {
                    "date": day.isoformat(),
                    "marketplace": "wb",
                    "orders": 1,
                    "units": units,
                    "revenue": safe_revenue,
                    "returns": 0,
                    "ad_spend": 0.0,
                    "other_costs": 0.0,
                }
            )

    if not rows and not response_pages:
        fallback_rows, fallback_warning = _fetch_wb_sales_rows_report_detail(api_key=api_key, date_from=date_from, date_to=date_to)
        if fallback_rows:
            if fallback_warning:
                warnings.append(fallback_warning)
            _WB_SALES_CACHE[cache_key] = (time.monotonic(), list(fallback_rows), list(warnings))
            return fallback_rows, warnings

    _WB_SALES_CACHE[cache_key] = (time.monotonic(), list(rows), list(warnings))
    return rows, warnings


def _fetch_ozon_sales_rows(api_key: str, date_from: date, date_to: date) -> tuple[list[dict[str, Any]], list[str]]:
    rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    creds = _parse_ozon_credentials(api_key)
    if not creds:
        return [], ["Ozon ключ должен быть в формате client_id:api_key."]
    client_id, token = creds
    headers = {
        "Client-Id": client_id,
        "Api-Key": token,
        "Content-Type": "application/json",
    }

    endpoint = "https://api-seller.ozon.ru/v1/analytics/data"
    payload_variants = [
        {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "metrics": ["ordered_units", "revenue", "orders"],
            "dimension": ["day"],
            "limit": 1000,
            "offset": 0,
        },
        {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "metrics": ["ordered_units", "revenue"],
            "dimensions": ["day"],
            "limit": 1000,
            "offset": 0,
        },
    ]

    parsed_rows: list[dict[str, Any]] = []
    for payload in payload_variants:
        try:
            with httpx.Client(timeout=SALES_TIMEOUT, follow_redirects=True) as client:
                response = client.post(endpoint, headers=headers, json=payload)
            if response.status_code >= 400:
                continue
            data = response.json()
        except Exception:
            continue
        parsed_rows = _extract_ozon_analytics_rows(data)
        if parsed_rows:
            break

    if not parsed_rows:
        return [], ["Ozon analytics API не вернул данные продаж."]

    for item in parsed_rows:
        day = _parse_any_date(item.get("date") or item.get("day"))
        if not day or day < date_from or day > date_to:
            continue
        units = int(round(_to_float(item.get("units") or item.get("ordered_units") or 0.0)))
        orders = int(round(_to_float(item.get("orders") or units)))
        revenue = float(round(_to_float(item.get("revenue") or 0.0), 2))
        if units < 0:
            units = 0
        if orders < 0:
            orders = 0
        rows.append(
            {
                "date": day.isoformat(),
                "marketplace": "ozon",
                "orders": orders,
                "units": units,
                "revenue": revenue,
                "returns": 0,
                "ad_spend": 0.0,
                "other_costs": 0.0,
            }
        )
    return rows, warnings


def _aggregate_rows(rows: list[dict[str, Any]], wb_ad_spend_by_day: dict[str, float] | None = None) -> list[dict[str, Any]]:
    bucket: dict[tuple[str, str], dict[str, Any]] = {}
    ad_map = wb_ad_spend_by_day or {}
    for item in rows:
        day = str(item.get("date") or "").strip()
        marketplace = str(item.get("marketplace") or "").strip().lower()
        if not day or marketplace not in {"wb", "ozon"}:
            continue
        key = (day, marketplace)
        row = bucket.setdefault(
            key,
            {
                "date": day,
                "marketplace": marketplace,
                "orders": 0,
                "units": 0,
                "revenue": 0.0,
                "returns": 0,
                "ad_spend": 0.0,
                "other_costs": 0.0,
            },
        )
        row["orders"] += int(item.get("orders") or 0)
        row["units"] += int(item.get("units") or 0)
        row["revenue"] = float(round(float(row["revenue"]) + float(item.get("revenue") or 0.0), 2))
        row["returns"] += int(item.get("returns") or 0)
        row["ad_spend"] = float(round(float(row["ad_spend"]) + float(item.get("ad_spend") or 0.0), 2))
        row["other_costs"] = float(round(float(row["other_costs"]) + float(item.get("other_costs") or 0.0), 2))
    if ad_map:
        for row in bucket.values():
            if str(row.get("marketplace") or "").lower() != "wb":
                continue
            day = str(row.get("date") or "").strip()
            row["ad_spend"] = float(round(float(row.get("ad_spend") or 0.0) + float(ad_map.get(day) or 0.0), 2))
    out = list(bucket.values())
    out.sort(key=lambda x: (str(x.get("date") or ""), str(x.get("marketplace") or "")))
    return out


def _build_chart(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    bucket: dict[str, dict[str, Any]] = {}
    for item in rows:
        day = str(item.get("date") or "")
        if not day:
            continue
        row = bucket.setdefault(day, {"date": day, "orders": 0, "units": 0, "revenue": 0.0, "returns": 0, "ad_spend": 0.0, "other_costs": 0.0})
        row["orders"] += int(item.get("orders") or 0)
        row["units"] += int(item.get("units") or 0)
        row["revenue"] = float(round(float(row["revenue"]) + float(item.get("revenue") or 0.0), 2))
        row["returns"] += int(item.get("returns") or 0)
        row["ad_spend"] = float(round(float(row["ad_spend"]) + float(item.get("ad_spend") or 0.0), 2))
        row["other_costs"] = float(round(float(row["other_costs"]) + float(item.get("other_costs") or 0.0), 2))
    out = list(bucket.values())
    out.sort(key=lambda x: str(x.get("date") or ""))
    return out


def _fetch_wb_ad_spent_total(api_key: str, date_from: date, date_to: date) -> tuple[float, list[str]]:
    cache_key = (api_key[-12:], date_from.isoformat(), date_to.isoformat())
    cached = _WB_AD_SPEND_CACHE.get(cache_key)
    now = time.monotonic()
    if cached and now - cached[0] <= WB_AD_SPEND_CACHE_TTL_SEC:
        return float(cached[1]), list(cached[2])

    warnings: list[str] = []
    spent_total = 0.0
    try:
        campaign_rows = fetch_wb_campaigns(
            api_key,
            enrich=False,
            fast_mode=True,
            request_timeout=WB_ADS_TIMEOUT,
            max_attempts=1,
        )
    except Exception:
        return 0.0, ["WB Ads API недоступен для расчета рекламных расходов."]
    ids: list[int] = []
    for row in campaign_rows if isinstance(campaign_rows, list) else []:
        cid = _campaign_id_from_any(row)
        if cid > 0:
            ids.append(cid)
    ids = sorted(set(ids))
    if not ids:
        return 0.0, warnings
    max_campaigns = WB_ADS_MAX_CAMPAIGNS
    if len(ids) > max_campaigns:
        warnings.append(f"WB Ads: кампаний много ({len(ids)}), для скорости учитываем первые {max_campaigns}.")
        ids = ids[:max_campaigns]
    try:
        stats = fetch_wb_campaign_stats_bulk(
            api_key=api_key,
            campaign_ids=ids,
            date_from=date_from.isoformat(),
            date_to=date_to.isoformat(),
            fast_mode=True,
            request_timeout=WB_ADS_TIMEOUT,
            max_attempts=1,
            max_chunks=WB_ADS_MAX_STATS_CHUNKS,
        )
    except Exception:
        return 0.0, ["WB Ads статистика недоступна для расчета расходов."]
    if not isinstance(stats, dict) or not stats:
        return 0.0, ["WB Ads статистика недоступна для расчета расходов (пустой ответ/лимит API)."]
    if len(stats) < len(ids):
        warnings.append(f"WB Ads: обработано кампаний {len(stats)}/{len(ids)} для ускорения ответа.")
    for payload in stats.values() if isinstance(stats, dict) else []:
        spent_total += float(payload.get("spent") or 0.0)
    result = float(round(max(0.0, spent_total), 2))
    _WB_AD_SPEND_CACHE[cache_key] = (time.monotonic(), result, list(warnings))
    return result, warnings


def _campaign_id_from_any(row: Any) -> int:
    if not isinstance(row, dict):
        return 0
    for key in ("advertId", "advert_id", "campaignId", "campaign_id", "id", "adId"):
        value = row.get(key)
        try:
            num = int(str(value).strip())
        except Exception:
            continue
        if num > 0:
            return num
    return 0


def _fetch_wb_sales_rows_report_detail(api_key: str, date_from: date, date_to: date) -> tuple[list[dict[str, Any]], str]:
    endpoint = "https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod"
    rrdid = 0
    source_rows: list[dict[str, Any]] = []
    for _ in range(WB_REPORT_DETAIL_MAX_PAGES):
        params = {
            "dateFrom": date_from.isoformat(),
            "dateTo": date_to.isoformat(),
            "limit": WB_REPORT_DETAIL_LIMIT,
            "rrdid": rrdid,
        }
        payload, status = _request_wb_sales_payload(api_key=api_key, endpoint=endpoint, params=params)
        if payload is None:
            return [], status
        if not payload:
            break
        source_rows.extend(payload)
        if len(payload) < WB_REPORT_DETAIL_LIMIT:
            break
        next_rrdid = _to_int(payload[-1].get("rrd_id") or payload[-1].get("rrdId") or payload[-1].get("rrdid") or 0)
        if not next_rrdid or next_rrdid <= rrdid:
            break
        rrdid = next_rrdid

    if not source_rows:
        return [], ""

    rows: list[dict[str, Any]] = []
    dedupe_keys: set[str] = set()
    for item in source_rows:
        if not isinstance(item, dict):
            continue
        day = _parse_any_date(
            item.get("sale_dt")
            or item.get("saleDt")
            or item.get("order_dt")
            or item.get("rr_dt")
            or item.get("date")
            or item.get("date_from")
        )
        if not day or day < date_from or day > date_to:
            continue
        marker = "|".join(
            [
                str(item.get("rrd_id") or item.get("rrdId") or ""),
                str(item.get("rid") or ""),
                str(item.get("srid") or ""),
                str(item.get("sale_dt") or item.get("order_dt") or item.get("rr_dt") or ""),
                str(item.get("nm_id") or item.get("nmId") or ""),
                str(item.get("quantity") or ""),
            ]
        )
        if marker in dedupe_keys:
            continue
        dedupe_keys.add(marker)

        units = int(round(abs(_to_float(item.get("quantity") or 0))))
        if units <= 0:
            units = 1
        revenue = _to_float(
            item.get("ppvz_for_pay")
            or item.get("forPay")
            or item.get("retail_amount")
            or item.get("retail_price_withdisc_rub")
            or 0.0
        )
        return_amount = abs(float(round(_to_float(item.get("return_amount") or item.get("returnAmount") or 0.0), 2)))
        op_name = str(item.get("supplier_oper_name") or item.get("doc_type_name") or "").lower()
        is_return = bool(return_amount > 0 or "возврат" in op_name or "return" in op_name or revenue < 0)
        safe_revenue = abs(float(round(revenue, 2)))
        if is_return:
            rows.append(
                {
                    "date": day.isoformat(),
                    "marketplace": "wb",
                    "orders": 0,
                    "units": 0,
                    "revenue": 0.0,
                    "returns": units,
                    "ad_spend": 0.0,
                    "other_costs": return_amount if return_amount > 0 else safe_revenue,
                }
            )
            continue
        rows.append(
            {
                "date": day.isoformat(),
                "marketplace": "wb",
                "orders": 1,
                "units": units,
                "revenue": safe_revenue,
                "returns": 0,
                "ad_spend": 0.0,
                "other_costs": 0.0,
            }
        )
    if not rows:
        return [], ""
    return rows, "WB sales: использован fallback API reportDetailByPeriod."


def _request_wb_sales_payload(api_key: str, endpoint: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]] | None, str]:
    token = (api_key or "").strip()
    if not token:
        return None, "WB ключ не подключен."
    auth_variants = (token, f"Bearer {token}")
    last_error = "WB sales API недоступен."
    for auth_value in auth_variants:
        headers = {"Authorization": auth_value}
        response = None
        try:
            with httpx.Client(timeout=WB_SALES_TIMEOUT, follow_redirects=True) as client:
                response = client.get(endpoint, headers=headers, params=params)
        except Exception:
            response = None
        if response is None:
            continue
        if response.status_code in {401, 403}:
            last_error = "WB sales API отклонил ключ (401/403)."
            continue
        if response.status_code == 429:
            return None, "rate_limited"
        if response.status_code >= 400:
            return None, f"WB sales API error {response.status_code}"
        try:
            payload = response.json()
        except Exception:
            return None, "WB sales API вернул некорректный ответ."
        if isinstance(payload, list):
            return payload, "ok"
        return None, "WB sales API вернул неожиданный формат."
    return None, last_error if last_error else "unavailable"


def _extract_wb_sales_cursor(item: dict[str, Any]) -> str:
    for key in ("lastChangeDate", "last_change_date", "date", "saleDate"):
        value = item.get(key)
        text = str(value or "").strip()
        if text:
            return text
    return ""


def _wb_sale_row_key(item: dict[str, Any]) -> str:
    return "|".join(
        [
            str(item.get("srid") or ""),
            str(item.get("saleID") or item.get("saleId") or ""),
            str(item.get("lastChangeDate") or ""),
            str(item.get("date") or ""),
            str(item.get("nmId") or ""),
        ]
    )


def _iter_days(left: date, right: date) -> list[date]:
    if left > right:
        left, right = right, left
    out: list[date] = []
    current = left
    while current <= right:
        out.append(current)
        current = current + timedelta(days=1)
    return out


def _is_truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value > 0
    text = str(value or "").strip().lower()
    return text in {"1", "true", "yes", "y", "ok", "done"}


def _extract_ozon_analytics_rows(data: Any) -> list[dict[str, Any]]:
    rows = []
    if isinstance(data, dict):
        rows = data.get("result", {}).get("data") or data.get("data") or []
    if not isinstance(rows, list):
        return []

    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        day = _extract_ozon_day(row)
        metrics = row.get("metrics")
        units = _pick_metric_value(row, metrics, keys=["ordered_units", "units", "qty"], index=0)
        revenue = _pick_metric_value(row, metrics, keys=["revenue", "revenue_rub", "sum"], index=1)
        orders = _pick_metric_value(row, metrics, keys=["orders", "orders_count"], index=2, fallback=units)
        out.append(
            {
                "date": day or "",
                "units": units,
                "revenue": revenue,
                "orders": orders,
            }
        )
    return out


def _extract_ozon_day(row: dict[str, Any]) -> str:
    for key in ("date", "day"):
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    dims = row.get("dimensions")
    if isinstance(dims, list):
        for dim in dims:
            if isinstance(dim, dict):
                for key in ("id", "name", "value"):
                    value = dim.get(key)
                    if isinstance(value, str) and value.strip():
                        return value.strip()
            if isinstance(dim, str) and dim.strip():
                return dim.strip()
    return ""


def _pick_metric_value(
    row: dict[str, Any],
    metrics: Any,
    keys: list[str],
    index: int,
    fallback: float = 0.0,
) -> float:
    for key in keys:
        if key in row:
            return _to_float(row.get(key))
    if isinstance(metrics, dict):
        for key in keys:
            if key in metrics:
                return _to_float(metrics.get(key))
    if isinstance(metrics, list) and len(metrics) > index:
        return _to_float(metrics[index])
    return _to_float(fallback)


def _parse_ozon_credentials(api_key: str) -> tuple[str, str] | None:
    raw = (api_key or "").strip()
    if ":" not in raw:
        return None
    left, right = raw.split(":", 1)
    if not left.strip() or not right.strip():
        return None
    return left.strip(), right.strip()


def _parse_any_date(value: Any) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    chunk = text[:10]
    try:
        return datetime.fromisoformat(chunk).date()
    except Exception:
        pass
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(chunk, fmt).date()
        except Exception:
            continue
    return None


def _to_float(value: Any) -> float:
    try:
        num = float(value)
    except Exception:
        try:
            num = float(str(value).replace(",", ".").strip())
        except Exception:
            return 0.0
    if not math.isfinite(num):
        return 0.0
    return float(num)


def _to_int(value: Any) -> int:
    try:
        return int(str(value).strip())
    except Exception:
        return 0
