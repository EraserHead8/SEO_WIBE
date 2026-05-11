from __future__ import annotations

from datetime import date, datetime, timedelta
import math
import time
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from app.services.wb_modules import fetch_wb_campaign_stats_bulk, fetch_wb_campaigns


SALES_TIMEOUT = httpx.Timeout(connect=4.0, read=8.0, write=8.0, pool=8.0)
WB_SALES_TIMEOUT = httpx.Timeout(connect=3.0, read=6.0, write=6.0, pool=6.0)
WB_SALES_CACHE_TTL_SEC = 180
WB_SALES_CACHE_TTL_LIVE_SEC = 60
_WB_SALES_CACHE: dict[tuple[str, str, str], tuple[float, list[dict[str, Any]], list[str]]] = {}
WB_ORDERS_CACHE_TTL_SEC = 180
WB_ORDERS_CACHE_TTL_LIVE_SEC = 60
_WB_ORDERS_CACHE: dict[tuple[str, str, str], tuple[float, list[dict[str, Any]], list[str]]] = {}
WB_REPORT_DETAIL_CACHE_TTL_SEC = 180
WB_REPORT_DETAIL_CACHE_TTL_LIVE_SEC = 60
_WB_REPORT_DETAIL_CACHE: dict[tuple[str, str, str], tuple[float, list[dict[str, Any]], str]] = {}
WB_SALES_MAX_PAGES = 3
WB_SALES_CONTINUATION_THRESHOLD = 79_500
WB_SALES_LONG_RANGE_DAYS = 10
WB_REPORT_DETAIL_LIMIT = 50_000
WB_REPORT_DETAIL_MAX_PAGES = 3
WB_ADS_TIMEOUT = httpx.Timeout(connect=4.0, read=9.0, write=9.0, pool=9.0)
WB_AD_SPEND_CACHE_TTL_SEC = 180
WB_AD_SPEND_CACHE_TTL_LIVE_SEC = 60
WB_ADS_MAX_CAMPAIGNS = 120
WB_ADS_MAX_CAMPAIGNS_LONG_RANGE = 60
WB_ADS_MAX_STATS_CHUNKS = 3
_WB_AD_SPEND_CACHE: dict[tuple[str, str, str], tuple[float, float, list[str]]] = {}
OZON_FINANCE_TIMEOUT = httpx.Timeout(connect=4.0, read=8.0, write=8.0, pool=8.0)
OZON_FINANCE_PAGE_SIZE = 500
OZON_FINANCE_MAX_PAGES = 8

def _ozon_month_chunk_end(day: date) -> date:
    next_month = (day.replace(day=28) + timedelta(days=4)).replace(day=1)
    return next_month - timedelta(days=1)


def build_sales_report(
    marketplace: str,
    date_from: date,
    date_to: date,
    wb_api_key: str = "",
    ozon_api_key: str = "",
    granularity: str = "auto",
    timezone: str = "UTC",
    prefer_live: bool = False,
    force_fresh_wb: bool = False,
) -> dict[str, Any]:
    selected = (marketplace or "all").strip().lower()
    if selected not in {"all", "wb", "ozon"}:
        selected = "all"

    collected: list[dict[str, Any]] = []
    warnings: list[str] = []
    wb_sales_cache_ttl_sec = WB_SALES_CACHE_TTL_LIVE_SEC if prefer_live else WB_SALES_CACHE_TTL_SEC
    wb_ads_cache_ttl_sec = WB_AD_SPEND_CACHE_TTL_LIVE_SEC if prefer_live else WB_AD_SPEND_CACHE_TTL_SEC
    wb_orders_cache_ttl_sec = WB_ORDERS_CACHE_TTL_LIVE_SEC if prefer_live else WB_ORDERS_CACHE_TTL_SEC
    wb_report_detail_cache_ttl_sec = WB_REPORT_DETAIL_CACHE_TTL_LIVE_SEC if prefer_live else WB_REPORT_DETAIL_CACHE_TTL_SEC

    if selected in {"all", "wb"}:
        if wb_api_key.strip():
            # WB statistics/report methods are very tightly rate-limited. Use one
            # reportDetailByPeriod source for both sales and finance metrics instead
            # of cascading sales + orders + finance requests on every dashboard load.
            wb_rows, wb_warn = _fetch_wb_sales_rows_report_detail(
                wb_api_key.strip(),
                date_from=date_from,
                date_to=date_to,
                ignore_cache=bool(force_fresh_wb),
                cache_ttl_sec=wb_report_detail_cache_ttl_sec,
            )
            collected.extend(wb_rows)
            if wb_warn:
                warnings.append(wb_warn)
            wb_finance_rows, wb_finance_warn = _fetch_wb_financial_rows_report_detail(
                wb_api_key.strip(),
                date_from=date_from,
                date_to=date_to,
                ignore_cache=bool(force_fresh_wb),
                cache_ttl_sec=wb_report_detail_cache_ttl_sec,
            )
            collected.extend(wb_finance_rows)
            warnings.extend(wb_finance_warn)
        else:
            warnings.append("WB ключ не подключен.")

    if selected in {"all", "ozon"}:
        if ozon_api_key.strip():
            ozon_rows, ozon_warn = _fetch_ozon_sales_rows(ozon_api_key.strip(), date_from=date_from, date_to=date_to)
            collected.extend(ozon_rows)
            warnings.extend(ozon_warn)
            ozon_finance_rows, ozon_finance_warn = _fetch_ozon_finance_rows(
                ozon_api_key.strip(),
                date_from=date_from,
                date_to=date_to,
            )
            collected.extend(ozon_finance_rows)
            warnings.extend(ozon_finance_warn)
        else:
            warnings.append("Ozon ключ не подключен.")

    wb_ad_spend_by_day: dict[str, float] = {}
    if selected in {"all", "wb"} and wb_api_key.strip():
        spent_total, spent_warn = _fetch_wb_ad_spent_total(
            wb_api_key.strip(),
            date_from=date_from,
            date_to=date_to,
            ignore_cache=bool(force_fresh_wb),
            cache_ttl_sec=wb_ads_cache_ttl_sec,
        )
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
    resolved_granularity = _resolve_granularity(granularity, date_from, date_to)
    chart = _build_chart(rows, source_rows=collected, granularity=resolved_granularity, date_from=date_from, date_to=date_to, timezone=timezone)
    totals = _build_sales_totals(rows)
    totals["gross_profit"] = float(round(float(totals["revenue"]) - float(totals["ad_spend"]) - float(totals["penalties"]), 2))
    return {
        "rows": rows,
        "chart": chart,
        "totals": totals,
        "warnings": warnings,
        "granularity": resolved_granularity,
        "timezone": timezone,
    }


def _build_sales_totals(rows: list[dict[str, Any]]) -> dict[str, Any]:
    metrics_int = ("orders", "units", "buyouts", "returns")
    metrics_money = (
        "order_amount",
        "buyout_amount",
        "revenue",
        "ad_spend",
        "penalties",
        "income",
        "expense",
        "net",
        "commission",
        "logistics",
        "storage",
        "deductions",
        "acceptance",
        "other_expense",
    )
    totals: dict[str, Any] = {
        "days": len({str(x.get("date") or "") for x in rows}),
    }
    for metric in metrics_int:
        totals[metric] = int(sum(int(x.get(metric) or 0) for x in rows))
    for metric in metrics_money:
        totals[metric] = float(round(sum(float(x.get(metric) or 0.0) for x in rows), 2))

    for mp in ("wb", "ozon"):
        mp_rows = [x for x in rows if str(x.get("marketplace") or "").strip().lower() == mp]
        for metric in metrics_int:
            totals[f"{mp}_{metric}"] = int(sum(int(x.get(metric) or 0) for x in mp_rows))
        for metric in metrics_money:
            totals[f"{mp}_{metric}"] = float(round(sum(float(x.get(metric) or 0.0) for x in mp_rows), 2))
        totals[f"{mp}_days"] = len({str(x.get("date") or "") for x in mp_rows})

    return totals


def _fetch_wb_sales_rows(
    api_key: str,
    date_from: date,
    date_to: date,
    *,
    ignore_cache: bool = False,
    cache_ttl_sec: int = WB_SALES_CACHE_TTL_SEC,
) -> tuple[list[dict[str, Any]], list[str]]:
    cache_key = (api_key[-12:], date_from.isoformat(), date_to.isoformat())
    cached = _WB_SALES_CACHE.get(cache_key)
    now = time.monotonic()
    safe_cache_ttl = max(0, int(cache_ttl_sec or 0))
    if cached and (not ignore_cache) and now - cached[0] <= safe_cache_ttl:
        return list(cached[1]), list(cached[2])
    period_days = max(1, (date_to - date_from).days + 1)
    max_pages = 1 if period_days >= WB_SALES_LONG_RANGE_DAYS else WB_SALES_MAX_PAGES

    rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    endpoint = "https://statistics-api.wildberries.ru/api/v1/supplier/sales"
    cursor = date_from.isoformat()
    seen_cursors: set[str] = set()
    response_pages: list[list[dict[str, Any]]] = []
    last_error = "WB sales API недоступен."
    for page_idx in range(max_pages):
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
        if max_pages == 1:
            warnings.append(
                "WB sales: период большой, используем ускоренный одностраничный режим (ограничение WB 1 запрос/мин)."
            )
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
                        "occurred_at": str(item.get("date") or item.get("saleDate") or item.get("lastChangeDate") or ""),
                        "marketplace": "wb",
                        "orders": 0,
                        "units": 0,
                        "buyouts": 0,
                        "order_amount": 0.0,
                        "buyout_amount": 0.0,
                        "revenue": 0.0,
                        "returns": units,
                        "ad_spend": 0.0,
                        "penalties": 0.0,
                        "income": 0.0,
                        "expense": 0.0,
                        "net": 0.0,
                        "commission": 0.0,
                        "logistics": 0.0,
                        "storage": 0.0,
                        "deductions": 0.0,
                        "acceptance": 0.0,
                        "other_expense": 0.0,
                    }
                )
                continue
            rows.append(
                {
                    "date": day.isoformat(),
                    "occurred_at": str(item.get("date") or item.get("saleDate") or item.get("lastChangeDate") or ""),
                    "marketplace": "wb",
                    "orders": 0,
                    "units": 0,
                    "buyouts": units,
                    "order_amount": 0.0,
                    "buyout_amount": safe_revenue,
                    "revenue": safe_revenue,
                    "returns": 0,
                    "ad_spend": 0.0,
                    "penalties": 0.0,
                    "income": safe_revenue,
                    "expense": 0.0,
                    "net": safe_revenue,
                    "commission": 0.0,
                    "logistics": 0.0,
                    "storage": 0.0,
                    "deductions": 0.0,
                    "acceptance": 0.0,
                    "other_expense": 0.0,
                }
            )

    if not rows and not response_pages:
        fallback_rows, fallback_warning = _fetch_wb_sales_rows_report_detail(
            api_key=api_key,
            date_from=date_from,
            date_to=date_to,
            ignore_cache=ignore_cache,
            cache_ttl_sec=WB_REPORT_DETAIL_CACHE_TTL_LIVE_SEC if cache_ttl_sec <= WB_SALES_CACHE_TTL_LIVE_SEC else WB_REPORT_DETAIL_CACHE_TTL_SEC,
        )
        if fallback_rows:
            if fallback_warning:
                warnings.append(fallback_warning)
            rows = list(fallback_rows)

    _WB_SALES_CACHE[cache_key] = (time.monotonic(), list(rows), list(warnings))
    return rows, warnings


def _fetch_ozon_sales_rows(api_key: str, date_from: date, date_to: date) -> tuple[list[dict[str, Any]], list[str]]:
    rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    creds = _parse_ozon_credentials(api_key)
    if not creds:
        return [], ["Ozon ключ должен быть в формате client_id:api_key."]
    if date_from > date_to:
        date_from, date_to = date_to, date_from
    today = datetime.utcnow().date()
    if date_to > today:
        date_to = today
    if date_from > date_to:
        return [], []
    client_id, token = creds
    headers = {
        "Client-Id": client_id,
        "Api-Key": token,
        "Content-Type": "application/json",
    }

    endpoint = "https://api-seller.ozon.ru/v1/analytics/data"
    limit = 1000
    empty_chunks = 0
    chunk_from = date_from

    with httpx.Client(timeout=SALES_TIMEOUT, follow_redirects=True) as client:
        while chunk_from <= date_to:
            chunk_to = min(date_to, _ozon_month_chunk_end(chunk_from))
            chunk_rows: list[dict[str, Any]] = []
            chunk_warning = ""

            payload_variants = [
                {
                    "date_from": chunk_from.isoformat(),
                    "date_to": chunk_to.isoformat(),
                    "metrics": ["ordered_units", "revenue"],
                    "dimension": ["day"],
                    "limit": limit,
                    "offset": 0,
                },
                {
                    "date_from": chunk_from.isoformat(),
                    "date_to": chunk_to.isoformat(),
                    "metrics": ["ordered_units", "revenue", "orders"],
                    "dimension": ["day"],
                    "limit": limit,
                    "offset": 0,
                },
                {
                    "date_from": chunk_from.isoformat(),
                    "date_to": chunk_to.isoformat(),
                    "metrics": ["ordered_units", "revenue"],
                    "dimensions": ["day"],
                    "limit": limit,
                    "offset": 0,
                },
                {
                    "date_from": chunk_from.isoformat(),
                    "date_to": chunk_to.isoformat(),
                    "metrics": ["ordered_units", "revenue", "orders"],
                    "dimensions": ["day"],
                    "limit": limit,
                    "offset": 0,
                },
            ]

            for payload_template in payload_variants:
                variant_rows: list[dict[str, Any]] = []
                offset = 0
                page_guard = 0
                while page_guard < 8:
                    payload = dict(payload_template)
                    payload["offset"] = offset
                    response = None
                    max_attempts = 2
                    for request_attempt in range(max_attempts):
                        try:
                            response = client.post(endpoint, headers=headers, json=payload)
                        except Exception:
                            response = None
                        if response is None:
                            if request_attempt < (max_attempts - 1):
                                time.sleep(0.35 * (request_attempt + 1))
                                continue
                            chunk_warning = "Ozon analytics API недоступен."
                            variant_rows = []
                            break
                        status_code = int(response.status_code)
                        if status_code == 429:
                            if request_attempt < (max_attempts - 1):
                                time.sleep(min(10.0, 1.3 * (request_attempt + 1)))
                                continue
                            chunk_warning = "Ozon analytics API временно ограничил запросы (429)."
                            variant_rows = []
                            response = None
                            break
                        if status_code >= 500 and request_attempt < (max_attempts - 1):
                            time.sleep(min(6.0, 0.9 * (request_attempt + 1)))
                            continue
                        if status_code >= 400:
                            chunk_warning = f"Ozon analytics API error {response.status_code}."
                            variant_rows = []
                            break
                        break
                    if response is None:
                        break
                    if response.status_code >= 400:
                        break
                    try:
                        data = response.json()
                    except Exception:
                        chunk_warning = "Ozon analytics API вернул некорректный ответ."
                        variant_rows = []
                        break
                    batch_rows = _extract_ozon_analytics_rows(data)
                    if not batch_rows:
                        break
                    variant_rows.extend(batch_rows)
                    if len(batch_rows) < limit:
                        break
                    page_guard += 1
                    offset += limit

                if variant_rows:
                    chunk_rows = variant_rows
                    break

            if not chunk_rows:
                empty_chunks += 1
                if chunk_warning:
                    warnings.append(chunk_warning)
                chunk_from = chunk_to + timedelta(days=1)
                time.sleep(0.08)
                continue

            for item in chunk_rows:
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
                        "occurred_at": str(item.get("date") or item.get("day") or ""),
                        "marketplace": "ozon",
                        "orders": orders,
                        "units": units,
                        "buyouts": units,
                        "order_amount": 0.0,
                        "buyout_amount": revenue,
                        "revenue": revenue,
                        "returns": 0,
                        "ad_spend": 0.0,
                        "penalties": 0.0,
                        "income": revenue,
                        "expense": 0.0,
                        "net": revenue,
                        "commission": 0.0,
                        "logistics": 0.0,
                        "storage": 0.0,
                        "deductions": 0.0,
                        "acceptance": 0.0,
                        "other_expense": 0.0,
                    }
                )

            chunk_from = chunk_to + timedelta(days=1)
            time.sleep(0.06)

    if not rows and not warnings:
        warnings.append("Ozon analytics API не вернул данные продаж.")
    elif rows and empty_chunks > 0:
        warnings.append(f"Ozon analytics API вернул пустые данные для части периодов ({empty_chunks}).")

    return rows, list(dict.fromkeys(warnings))

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
                "buyouts": 0,
                "order_amount": 0.0,
                "buyout_amount": 0.0,
                "revenue": 0.0,
                "returns": 0,
                "ad_spend": 0.0,
                "penalties": 0.0,
                "income": 0.0,
                "expense": 0.0,
                "net": 0.0,
                "commission": 0.0,
                "logistics": 0.0,
                "storage": 0.0,
                "deductions": 0.0,
                "acceptance": 0.0,
                "other_expense": 0.0,
            },
        )
        row["orders"] += int(item.get("orders") or 0)
        row["units"] += int(item.get("units") or 0)
        row["buyouts"] += int(item.get("buyouts") or max(0, int(item.get("units") or 0) - int(item.get("returns") or 0)))
        row["order_amount"] = float(round(float(row["order_amount"]) + float(item.get("order_amount") or 0.0), 2))
        row["buyout_amount"] = float(round(float(row["buyout_amount"]) + float(item.get("buyout_amount") or 0.0), 2))
        row["revenue"] = float(round(float(row["revenue"]) + float(item.get("revenue") or 0.0), 2))
        row["returns"] += int(item.get("returns") or 0)
        row["ad_spend"] = float(round(float(row["ad_spend"]) + float(item.get("ad_spend") or 0.0), 2))
        row["penalties"] = float(round(float(row["penalties"]) + float(item.get("penalties") or 0.0), 2))
        row["income"] = float(round(float(row["income"]) + float(item.get("income") or 0.0), 2))
        row["expense"] = float(round(float(row["expense"]) + float(item.get("expense") or 0.0), 2))
        row["net"] = float(round(float(row["net"]) + float(item.get("net") or 0.0), 2))
        row["commission"] = float(round(float(row["commission"]) + float(item.get("commission") or 0.0), 2))
        row["logistics"] = float(round(float(row["logistics"]) + float(item.get("logistics") or 0.0), 2))
        row["storage"] = float(round(float(row["storage"]) + float(item.get("storage") or 0.0), 2))
        row["deductions"] = float(round(float(row["deductions"]) + float(item.get("deductions") or 0.0), 2))
        row["acceptance"] = float(round(float(row["acceptance"]) + float(item.get("acceptance") or 0.0), 2))
        row["other_expense"] = float(round(float(row["other_expense"]) + float(item.get("other_expense") or 0.0), 2))
    if ad_map:
        for row in bucket.values():
            if str(row.get("marketplace") or "").lower() != "wb":
                continue
            day = str(row.get("date") or "").strip()
            row["ad_spend"] = float(round(float(row.get("ad_spend") or 0.0) + float(ad_map.get(day) or 0.0), 2))
    for row in bucket.values():
        income = float(row.get("income") or 0.0)
        expense = float(row.get("expense") or 0.0)
        if income <= 0 and float(row.get("revenue") or 0.0) > 0:
            income = float(row.get("revenue") or 0.0)
            row["income"] = float(round(income, 2))
        if expense <= 0:
            expense = (
                float(row.get("commission") or 0.0)
                + float(row.get("logistics") or 0.0)
                + float(row.get("storage") or 0.0)
                + float(row.get("deductions") or 0.0)
                + float(row.get("acceptance") or 0.0)
                + float(row.get("other_expense") or 0.0)
                + float(row.get("penalties") or 0.0)
            )
            row["expense"] = float(round(expense, 2))
        row["net"] = float(round(float(row.get("income") or 0.0) - float(row.get("expense") or 0.0), 2))
    out = list(bucket.values())
    out.sort(key=lambda x: (str(x.get("date") or ""), str(x.get("marketplace") or "")))
    return out


def _build_chart(
    rows: list[dict[str, Any]],
    *,
    source_rows: list[dict[str, Any]] | None = None,
    granularity: str = "day",
    date_from: date | None = None,
    date_to: date | None = None,
    timezone: str = "UTC",
) -> list[dict[str, Any]]:
    if granularity == "hour":
        return _build_chart_hour(source_rows or rows, date_from=date_from, date_to=date_to, timezone=timezone)
    bucket: dict[str, dict[str, Any]] = {}
    for item in rows:
        day = str(item.get("date") or "")
        if not day:
            continue
        row = bucket.setdefault(day, _new_chart_bucket(day=day, bucket=day))
        _apply_metrics_to_bucket(row, item)
        mp = str(item.get("marketplace") or "").strip().lower()
        if mp in {"wb", "ozon"}:
            _apply_metrics_to_bucket(row, item, prefix=f"{mp}_")
    out = list(bucket.values())
    out.sort(key=lambda x: str(x.get("date") or ""))
    return out


def _resolve_granularity(value: str, date_from: date, date_to: date) -> str:
    code = str(value or "auto").strip().lower()
    if code == "hour":
        return "hour"
    if code == "day":
        return "day"
    return "hour" if date_from == date_to else "day"


def _build_chart_hour(
    rows: list[dict[str, Any]],
    *,
    date_from: date | None,
    date_to: date | None,
    timezone: str,
) -> list[dict[str, Any]]:
    left = date_from or date.today()
    right = date_to or left
    if left > right:
        left, right = right, left
    day = left
    try:
        tzinfo = ZoneInfo(str(timezone or "UTC"))
    except Exception:
        tzinfo = ZoneInfo("UTC")

    buckets: dict[int, dict[str, Any]] = {
        hour: _new_chart_bucket(day=day.isoformat(), bucket=f"{day.isoformat()} {hour:02d}:00")
        for hour in range(24)
    }
    daily_rows: list[dict[str, Any]] = []

    for item in rows:
        row_day = _parse_any_date(item.get("date") or item.get("occurred_at"))
        if row_day is None:
            row_day = day
        if row_day < left or row_day > right:
            continue
        if not _row_has_explicit_time(item):
            daily_rows.append(item)
            continue
        hour = _row_to_hour_bucket(item, tzinfo=tzinfo)
        bucket = buckets.get(hour)
        if not bucket:
            continue
        _apply_metrics_to_bucket(bucket, item)
        mp = str(item.get("marketplace") or "").strip().lower()
        if mp in {"wb", "ozon"}:
            _apply_metrics_to_bucket(bucket, item, prefix=f"{mp}_")

    # Some sources return only daily aggregates without hour timestamps.
    # Do not spread such rows across all hours (looks fake). Put them into a
    # single neutral bucket so totals stay correct and the chart remains honest.
    for item in daily_rows:
        _apply_daily_row_to_neutral_hour(buckets, item)

    return [buckets[x] for x in range(24)]


def _new_chart_bucket(day: str, bucket: str) -> dict[str, Any]:
    return {
        "date": day,
        "bucket": bucket,
        "orders": 0,
        "units": 0,
        "buyouts": 0,
        "order_amount": 0.0,
        "buyout_amount": 0.0,
        "revenue": 0.0,
        "returns": 0,
        "ad_spend": 0.0,
        "penalties": 0.0,
        "income": 0.0,
        "expense": 0.0,
        "net": 0.0,
        "commission": 0.0,
        "logistics": 0.0,
        "storage": 0.0,
        "deductions": 0.0,
        "acceptance": 0.0,
        "other_expense": 0.0,
        "wb_orders": 0,
        "wb_units": 0,
        "wb_buyouts": 0,
        "wb_order_amount": 0.0,
        "wb_buyout_amount": 0.0,
        "wb_revenue": 0.0,
        "wb_returns": 0,
        "wb_ad_spend": 0.0,
        "wb_penalties": 0.0,
        "wb_income": 0.0,
        "wb_expense": 0.0,
        "wb_net": 0.0,
        "wb_commission": 0.0,
        "wb_logistics": 0.0,
        "wb_storage": 0.0,
        "wb_deductions": 0.0,
        "wb_acceptance": 0.0,
        "wb_other_expense": 0.0,
        "ozon_orders": 0,
        "ozon_units": 0,
        "ozon_buyouts": 0,
        "ozon_order_amount": 0.0,
        "ozon_buyout_amount": 0.0,
        "ozon_revenue": 0.0,
        "ozon_returns": 0,
        "ozon_ad_spend": 0.0,
        "ozon_penalties": 0.0,
        "ozon_income": 0.0,
        "ozon_expense": 0.0,
        "ozon_net": 0.0,
        "ozon_commission": 0.0,
        "ozon_logistics": 0.0,
        "ozon_storage": 0.0,
        "ozon_deductions": 0.0,
        "ozon_acceptance": 0.0,
        "ozon_other_expense": 0.0,
    }


def _apply_metrics_to_bucket(target: dict[str, Any], source: dict[str, Any], prefix: str = "") -> None:
    orders_key = f"{prefix}orders"
    units_key = f"{prefix}units"
    buyouts_key = f"{prefix}buyouts"
    order_amount_key = f"{prefix}order_amount"
    buyout_amount_key = f"{prefix}buyout_amount"
    revenue_key = f"{prefix}revenue"
    returns_key = f"{prefix}returns"
    ad_spend_key = f"{prefix}ad_spend"
    penalties_key = f"{prefix}penalties"
    income_key = f"{prefix}income"
    expense_key = f"{prefix}expense"
    net_key = f"{prefix}net"
    commission_key = f"{prefix}commission"
    logistics_key = f"{prefix}logistics"
    storage_key = f"{prefix}storage"
    deductions_key = f"{prefix}deductions"
    acceptance_key = f"{prefix}acceptance"
    other_expense_key = f"{prefix}other_expense"

    target[orders_key] = int(target.get(orders_key) or 0) + int(source.get("orders") or 0)
    target[units_key] = int(target.get(units_key) or 0) + int(source.get("units") or 0)
    target[buyouts_key] = int(target.get(buyouts_key) or 0) + int(source.get("buyouts") or max(0, int(source.get("units") or 0) - int(source.get("returns") or 0)))
    target[order_amount_key] = float(round(float(target.get(order_amount_key) or 0.0) + float(source.get("order_amount") or 0.0), 2))
    target[buyout_amount_key] = float(round(float(target.get(buyout_amount_key) or 0.0) + float(source.get("buyout_amount") or 0.0), 2))
    target[revenue_key] = float(round(float(target.get(revenue_key) or 0.0) + float(source.get("revenue") or 0.0), 2))
    target[returns_key] = int(target.get(returns_key) or 0) + int(source.get("returns") or 0)
    target[ad_spend_key] = float(round(float(target.get(ad_spend_key) or 0.0) + float(source.get("ad_spend") or 0.0), 2))
    target[penalties_key] = float(round(float(target.get(penalties_key) or 0.0) + float(source.get("penalties") or 0.0), 2))
    target[income_key] = float(round(float(target.get(income_key) or 0.0) + float(source.get("income") or 0.0), 2))
    target[expense_key] = float(round(float(target.get(expense_key) or 0.0) + float(source.get("expense") or 0.0), 2))
    target[net_key] = float(round(float(target.get(net_key) or 0.0) + float(source.get("net") or 0.0), 2))
    target[commission_key] = float(round(float(target.get(commission_key) or 0.0) + float(source.get("commission") or 0.0), 2))
    target[logistics_key] = float(round(float(target.get(logistics_key) or 0.0) + float(source.get("logistics") or 0.0), 2))
    target[storage_key] = float(round(float(target.get(storage_key) or 0.0) + float(source.get("storage") or 0.0), 2))
    target[deductions_key] = float(round(float(target.get(deductions_key) or 0.0) + float(source.get("deductions") or 0.0), 2))
    target[acceptance_key] = float(round(float(target.get(acceptance_key) or 0.0) + float(source.get("acceptance") or 0.0), 2))
    target[other_expense_key] = float(round(float(target.get(other_expense_key) or 0.0) + float(source.get("other_expense") or 0.0), 2))


def _row_has_explicit_time(item: dict[str, Any]) -> bool:
    raw = item.get("occurred_at") or item.get("datetime") or item.get("created_at")
    if raw is None:
        return False
    text = str(raw).strip()
    if not text:
        return False
    return "T" in text or (":" in text and " " in text)


def _apply_daily_row_to_neutral_hour(buckets: dict[int, dict[str, Any]], item: dict[str, Any]) -> None:
    bucket = buckets.get(12) or buckets.get(0)
    if not bucket:
        return
    chunk = {
        "orders": int(item.get("orders") or 0),
        "units": int(item.get("units") or 0),
        "buyouts": int(item.get("buyouts") or max(0, int(item.get("units") or 0) - int(item.get("returns") or 0))),
        "order_amount": float(item.get("order_amount") or 0.0),
        "buyout_amount": float(item.get("buyout_amount") or 0.0),
        "revenue": float(item.get("revenue") or 0.0),
        "returns": int(item.get("returns") or 0),
        "ad_spend": float(item.get("ad_spend") or 0.0),
        "penalties": float(item.get("penalties") or 0.0),
        "income": float(item.get("income") or 0.0),
        "expense": float(item.get("expense") or 0.0),
        "net": float(item.get("net") or 0.0),
        "commission": float(item.get("commission") or 0.0),
        "logistics": float(item.get("logistics") or 0.0),
        "storage": float(item.get("storage") or 0.0),
        "deductions": float(item.get("deductions") or 0.0),
        "acceptance": float(item.get("acceptance") or 0.0),
        "other_expense": float(item.get("other_expense") or 0.0),
    }
    mp = str(item.get("marketplace") or "").strip().lower()
    _apply_metrics_to_bucket(bucket, chunk)
    if mp in {"wb", "ozon"}:
        _apply_metrics_to_bucket(bucket, chunk, prefix=f"{mp}_")


def _row_to_hour_bucket(item: dict[str, Any], tzinfo: ZoneInfo) -> int:
    raw = item.get("occurred_at") or item.get("datetime") or item.get("created_at") or item.get("date")
    dt = _parse_any_datetime(raw)
    if dt is None:
        return 12
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    local = dt.astimezone(tzinfo)
    return int(local.hour)


def _fetch_wb_ad_spent_total(
    api_key: str,
    date_from: date,
    date_to: date,
    *,
    ignore_cache: bool = False,
    cache_ttl_sec: int = WB_AD_SPEND_CACHE_TTL_SEC,
) -> tuple[float, list[str]]:
    cache_key = (api_key[-12:], date_from.isoformat(), date_to.isoformat())
    cached = _WB_AD_SPEND_CACHE.get(cache_key)
    now = time.monotonic()
    safe_cache_ttl = max(0, int(cache_ttl_sec or 0))
    if cached and (not ignore_cache) and now - cached[0] <= safe_cache_ttl:
        return float(cached[1]), list(cached[2])

    warnings: list[str] = []
    spent_total = 0.0
    period_days = max(1, (date_to - date_from).days + 1)
    max_campaigns = WB_ADS_MAX_CAMPAIGNS_LONG_RANGE if period_days >= 14 else WB_ADS_MAX_CAMPAIGNS
    max_chunks = 2 if period_days >= 14 else WB_ADS_MAX_STATS_CHUNKS
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
            max_chunks=max_chunks,
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


def _fetch_wb_report_detail_source_rows(
    api_key: str,
    date_from: date,
    date_to: date,
    *,
    ignore_cache: bool = False,
    cache_ttl_sec: int = WB_REPORT_DETAIL_CACHE_TTL_SEC,
) -> tuple[list[dict[str, Any]], str]:
    cache_key = (api_key[-12:], date_from.isoformat(), date_to.isoformat())
    cached = _WB_REPORT_DETAIL_CACHE.get(cache_key)
    now = time.monotonic()
    safe_cache_ttl = max(0, int(cache_ttl_sec or 0))
    if cached and (not ignore_cache) and now - cached[0] <= safe_cache_ttl:
        return list(cached[1]), str(cached[2] or "")

    endpoint = "https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod"
    rrdid = 0
    source_rows: list[dict[str, Any]] = []
    report_from = f"{date_from.isoformat()}T00:00:00+03:00"
    report_to = (date_to + timedelta(days=1)).isoformat()
    for _ in range(WB_REPORT_DETAIL_MAX_PAGES):
        params = {
            "dateFrom": report_from,
            "dateTo": report_to,
            "limit": WB_REPORT_DETAIL_LIMIT,
            "rrdid": rrdid,
        }
        payload, status = _request_wb_sales_payload(api_key=api_key, endpoint=endpoint, params=params)
        if payload is None:
            if cached:
                return list(cached[1]), "cached-stale"
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
    if source_rows:
        _WB_REPORT_DETAIL_CACHE[cache_key] = (time.monotonic(), list(source_rows), "ok")
        return source_rows, "ok"
    if cached:
        return list(cached[1]), "cached-stale"
    return [], ""

def _wb_report_detail_day(item: dict[str, Any]) -> date | None:
    return _parse_any_date(
        item.get("sale_dt")
        or item.get("saleDt")
        or item.get("order_dt")
        or item.get("rr_dt")
        or item.get("date")
        or item.get("date_from")
    )


def _wb_report_detail_marker(item: dict[str, Any]) -> str:
    return "|".join(
        [
            str(item.get("rrd_id") or item.get("rrdId") or ""),
            str(item.get("rid") or ""),
            str(item.get("srid") or ""),
            str(item.get("sale_dt") or item.get("order_dt") or item.get("rr_dt") or ""),
            str(item.get("nm_id") or item.get("nmId") or ""),
            str(item.get("quantity") or ""),
        ]
    )


def _wb_report_detail_sale_amount(item: dict[str, Any]) -> float:
    raw = _to_float(
        item.get("retail_amount")
        or item.get("retail_price_withdisc_rub")
        or item.get("ppvz_for_pay")
        or item.get("forPay")
        or 0.0
    )
    return abs(float(round(raw, 2)))


def _fetch_wb_sales_rows_report_detail(api_key: str, date_from: date, date_to: date, *, ignore_cache: bool = False, cache_ttl_sec: int = WB_REPORT_DETAIL_CACHE_TTL_SEC) -> tuple[list[dict[str, Any]], str]:
    source_rows, status = _fetch_wb_report_detail_source_rows(
        api_key=api_key,
        date_from=date_from,
        date_to=date_to,
        ignore_cache=ignore_cache,
        cache_ttl_sec=cache_ttl_sec,
    )
    if not source_rows:
        return [], status if status != "ok" else ""

    rows: list[dict[str, Any]] = []
    dedupe_keys: set[str] = set()
    for item in source_rows:
        if not isinstance(item, dict):
            continue
        day = _wb_report_detail_day(item)
        if not day or day < date_from or day > date_to:
            continue
        marker = _wb_report_detail_marker(item)
        if marker in dedupe_keys:
            continue
        dedupe_keys.add(marker)
        units = int(round(abs(_to_float(item.get("quantity") or 0))))
        if units <= 0:
            units = 1
        sale_amount = _wb_report_detail_sale_amount(item)
        return_amount = abs(float(round(_to_float(item.get("return_amount") or item.get("returnAmount") or 0.0), 2)))
        op_name = str(item.get("supplier_oper_name") or item.get("doc_type_name") or "").lower()
        is_return = bool(return_amount > 0 or "возврат" in op_name or "return" in op_name)
        if is_return:
            rows.append(
                {
                    "date": day.isoformat(),
                    "occurred_at": str(item.get("sale_dt") or item.get("saleDt") or item.get("order_dt") or item.get("rr_dt") or ""),
                    "marketplace": "wb",
                    "orders": 0,
                    "units": 0,
                    "buyouts": 0,
                    "order_amount": 0.0,
                    "buyout_amount": 0.0,
                    "revenue": 0.0,
                    "returns": units,
                    "ad_spend": 0.0,
                    "penalties": 0.0,
                    "income": 0.0,
                    "expense": 0.0,
                    "net": 0.0,
                    "commission": 0.0,
                    "logistics": 0.0,
                    "storage": 0.0,
                    "deductions": 0.0,
                    "acceptance": 0.0,
                    "other_expense": 0.0,
                }
            )
            continue
        rows.append(
            {
                "date": day.isoformat(),
                "occurred_at": str(item.get("sale_dt") or item.get("saleDt") or item.get("order_dt") or item.get("rr_dt") or ""),
                "marketplace": "wb",
                "orders": 1,
                "units": units,
                "buyouts": units,
                "order_amount": 0.0,
                "buyout_amount": sale_amount,
                "revenue": sale_amount,
                "returns": 0,
                "ad_spend": 0.0,
                "penalties": 0.0,
                "income": sale_amount,
                "expense": 0.0,
                "net": sale_amount,
                "commission": 0.0,
                "logistics": 0.0,
                "storage": 0.0,
                "deductions": 0.0,
                "acceptance": 0.0,
                "other_expense": 0.0,
            }
        )
    if not rows:
        return [], ""
    return rows, "WB sales: использован fallback API reportDetailByPeriod."


def _fetch_wb_financial_rows_report_detail(api_key: str, date_from: date, date_to: date, *, ignore_cache: bool = False, cache_ttl_sec: int = WB_REPORT_DETAIL_CACHE_TTL_SEC) -> tuple[list[dict[str, Any]], list[str]]:
    source_rows, status = _fetch_wb_report_detail_source_rows(
        api_key=api_key,
        date_from=date_from,
        date_to=date_to,
        ignore_cache=ignore_cache,
        cache_ttl_sec=cache_ttl_sec,
    )
    if not source_rows:
        if status and status != "ok":
            return [], [f"WB finance API недоступен ({status})."]
        return [], ["WB finance API не вернул данные по расходам/приходам."]

    rows: list[dict[str, Any]] = []
    dedupe_keys: set[str] = set()
    for item in source_rows:
        if not isinstance(item, dict):
            continue
        day = _wb_report_detail_day(item)
        if not day or day < date_from or day > date_to:
            continue
        marker = _wb_report_detail_marker(item)
        if marker in dedupe_keys:
            continue
        dedupe_keys.add(marker)

        occurred_at = str(item.get("sale_dt") or item.get("saleDt") or item.get("order_dt") or item.get("rr_dt") or "")
        operation_name = str(item.get("supplier_oper_name") or item.get("doc_type_name") or "").strip().lower()
        return_amount = abs(float(round(_to_float(item.get("return_amount") or item.get("returnAmount") or 0.0), 2)))
        additional_payment = float(round(_to_float(item.get("additional_payment") or item.get("additionalPayment") or 0.0), 2))
        commission = (
            abs(_to_float(item.get("ppvz_sales_commission") or item.get("ppvzSalesCommission") or 0.0))
            + abs(_to_float(item.get("ppvz_vw") or item.get("ppvzVw") or 0.0))
            + abs(_to_float(item.get("ppvz_vw_nds") or item.get("ppvzVwNds") or 0.0))
            + abs(_to_float(item.get("acquiring_fee") or item.get("acquiringFee") or 0.0))
        )
        logistics = (
            abs(_to_float(item.get("delivery_rub") or item.get("deliveryRub") or 0.0))
            + abs(_to_float(item.get("rebill_logistic_cost") or item.get("rebillLogisticCost") or 0.0))
            + return_amount
        )
        storage = abs(_to_float(item.get("storage_fee") or item.get("storageFee") or 0.0))
        deductions = abs(_to_float(item.get("deduction") or 0.0))
        acceptance = abs(_to_float(item.get("acceptance") or 0.0))
        penalties = abs(_to_float(item.get("penalty") or 0.0))
        other_expense = max(0.0, -additional_payment)
        # Sales revenue is already counted from WB sales API/fallback rows.
        # Here we keep only non-sales positive adjustments to avoid double counting.
        income = max(0.0, additional_payment)
        expense = commission + logistics + storage + deductions + acceptance + penalties + other_expense
        if income <= 0 and expense <= 0:
            continue
        rows.append(
            {
                "date": day.isoformat(),
                "occurred_at": occurred_at,
                "marketplace": "wb",
                "orders": 0,
                "units": 0,
                "buyouts": 0,
                "order_amount": 0.0,
                "buyout_amount": 0.0,
                "revenue": 0.0,
                "returns": 0,
                "ad_spend": 0.0,
                "penalties": float(round(penalties, 2)),
                "income": float(round(income, 2)),
                "expense": float(round(expense, 2)),
                "net": float(round(income - expense, 2)),
                "commission": float(round(commission, 2)),
                "logistics": float(round(logistics, 2)),
                "storage": float(round(storage, 2)),
                "deductions": float(round(deductions, 2)),
                "acceptance": float(round(acceptance, 2)),
                "other_expense": float(round(other_expense, 2)),
            }
        )

    if not rows:
        return [], ["WB finance: в детализации периода не найдено финансовых операций."]
    return rows, []


def _fetch_wb_orders_rows(
    api_key: str,
    date_from: date,
    date_to: date,
    *,
    ignore_cache: bool = False,
    cache_ttl_sec: int = WB_ORDERS_CACHE_TTL_SEC,
) -> tuple[list[dict[str, Any]], list[str]]:
    cache_key = (api_key[-12:], date_from.isoformat(), date_to.isoformat())
    cached = _WB_ORDERS_CACHE.get(cache_key)
    now = time.monotonic()
    safe_cache_ttl = max(0, int(cache_ttl_sec or 0))
    if cached and (not ignore_cache) and now - cached[0] <= safe_cache_ttl:
        return list(cached[1]), list(cached[2])

    endpoint = "https://statistics-api.wildberries.ru/api/v1/supplier/orders"
    cursor = date_from.isoformat()
    warnings: list[str] = []
    source_rows: list[dict[str, Any]] = []
    seen_cursors: set[str] = set()
    for page_idx in range(WB_SALES_MAX_PAGES):
        params = {"dateFrom": cursor, "flag": 0}
        payload, status = _request_wb_sales_payload(api_key=api_key, endpoint=endpoint, params=params)
        if payload is None:
            if status == "rate_limited":
                warnings.append("WB orders API вернул 429, показана частичная статистика.")
                break
            if page_idx == 0:
                if cached:
                    return list(cached[1]), list(cached[2]) + ["WB orders API unavailable, showing cached snapshot."]
                return [], [status]
            warnings.append("WB orders API недоступен, показана частичная статистика.")
            break
        if not payload:
            break
        source_rows.extend(payload)
        if len(payload) < WB_SALES_CONTINUATION_THRESHOLD:
            break
        next_cursor = _extract_wb_sales_cursor(payload[-1])
        if not next_cursor or next_cursor in seen_cursors:
            break
        seen_cursors.add(next_cursor)
        cursor = next_cursor

    rows: list[dict[str, Any]] = []
    dedupe_keys: set[str] = set()
    for item in source_rows:
        if not isinstance(item, dict):
            continue
        day = _parse_any_date(
            item.get("date")
            or item.get("lastChangeDate")
            or item.get("createdAt")
            or item.get("orderDate")
            or item.get("dateCreated")
        )
        if not day or day < date_from or day > date_to:
            continue
        key = _wb_order_row_key(item)
        if key in dedupe_keys:
            continue
        dedupe_keys.add(key)
        units_raw = _to_float(item.get("quantity") or item.get("quantityFull") or item.get("saleQty") or 0.0)
        units = int(round(abs(units_raw)))
        if units <= 0:
            units = 1
        revenue = _to_float(
            item.get("totalPrice")
            or item.get("priceWithDisc")
            or item.get("finishedPrice")
            or item.get("forPay")
            or 0.0
        )
        status_text = str(item.get("status") or item.get("orderType") or item.get("supplier_oper_name") or "").lower()
        is_cancel = bool(
            _is_truthy(item.get("isCancel"))
            or _is_truthy(item.get("is_cancel"))
            or _is_truthy(item.get("cancel"))
            or "cancel" in status_text
            or "отмен" in status_text
        )
        safe_revenue = abs(float(round(revenue, 2)))
        if is_cancel:
            # Canceled orders should not inflate returns here:
            # real returns are already reflected in sales/finance streams.
            continue
        rows.append(
            {
                "date": day.isoformat(),
                "occurred_at": str(item.get("date") or item.get("lastChangeDate") or item.get("createdAt") or ""),
                "marketplace": "wb",
                "orders": 1,
                "units": units,
                "buyouts": 0,
                "order_amount": safe_revenue,
                "buyout_amount": 0.0,
                "revenue": 0.0,
                "returns": 0,
                "ad_spend": 0.0,
                "penalties": 0.0,
                "income": 0.0,
                "expense": 0.0,
                "net": 0.0,
                "commission": 0.0,
                "logistics": 0.0,
                "storage": 0.0,
                "deductions": 0.0,
                "acceptance": 0.0,
                "other_expense": 0.0,
            }
        )
    _WB_ORDERS_CACHE[cache_key] = (time.monotonic(), list(rows), list(warnings))
    if not rows:
        return [], warnings
    return rows, warnings


def _fetch_ozon_finance_rows(api_key: str, date_from: date, date_to: date) -> tuple[list[dict[str, Any]], list[str]]:
    creds = _parse_ozon_credentials(api_key)
    if not creds:
        return [], ["Ozon ключ должен быть в формате client_id:api_key."]
    client_id, token = creds
    headers = {
        "Client-Id": client_id,
        "Api-Key": token,
        "Content-Type": "application/json",
    }
    endpoint = "https://api-seller.ozon.ru/v3/finance/transaction/list"
    rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    if date_from > date_to:
        date_from, date_to = date_to, date_from
    today = datetime.utcnow().date()
    if date_to > today:
        date_to = today
    if date_from > date_to:
        return [], []
    chunk_from = date_from

    with httpx.Client(timeout=OZON_FINANCE_TIMEOUT, follow_redirects=True) as client:
        while chunk_from <= date_to:
            # Ozon v3 finance accepts a single calendar month per request.
            chunk_to = min(date_to, _ozon_month_chunk_end(chunk_from))
            page = 1
            while page <= OZON_FINANCE_MAX_PAGES:
                payload = {
                    "filter": {
                        "date": {
                            "from": f"{chunk_from.isoformat()}T00:00:00.000Z",
                            "to": f"{chunk_to.isoformat()}T23:59:59.999Z",
                        },
                        "transaction_type": "all",
                    },
                    "page": page,
                    "page_size": OZON_FINANCE_PAGE_SIZE,
                }
                response = None
                max_attempts = 2
                for request_attempt in range(max_attempts):
                    try:
                        response = client.post(endpoint, headers=headers, json=payload)
                    except Exception:
                        response = None
                    if response is None:
                        if request_attempt < (max_attempts - 1):
                            time.sleep(0.35 * (request_attempt + 1))
                            continue
                        warnings.append("Ozon finance API недоступен.")
                        break
                    status_code = int(response.status_code)
                    if status_code == 429:
                        if request_attempt < (max_attempts - 1):
                            time.sleep(min(8.0, 1.1 * (request_attempt + 1)))
                            continue
                        warnings.append("Ozon finance API временно ограничил запросы (429).")
                        response = None
                        break
                    if status_code >= 500 and request_attempt < (max_attempts - 1):
                        time.sleep(min(6.0, 0.8 * (request_attempt + 1)))
                        continue
                    break
                if response is None:
                    break
                if response.status_code >= 400:
                    raw_text = ""
                    try:
                        raw_text = str(response.text or "")
                    except Exception:
                        raw_text = ""
                    lowered = raw_text.lower()
                    if int(response.status_code) == 400 and ("too long period" in lowered or "one month allowed" in lowered):
                        warnings.append("Ozon finance API: период запроса должен быть в пределах одного месяца.")
                    else:
                        warnings.append(f"Ozon finance API error {response.status_code}.")
                    break
                try:
                    data = response.json()
                except Exception:
                    warnings.append("Ozon finance API вернул некорректный ответ.")
                    break
                result = data.get("result") if isinstance(data, dict) else {}
                operations = result.get("operations") if isinstance(result, dict) else []
                if not isinstance(operations, list) or not operations:
                    break
                for op in operations:
                    if not isinstance(op, dict):
                        continue
                    day = _parse_any_date(op.get("operation_date") or op.get("operationDate") or op.get("date"))
                    if not day or day < date_from or day > date_to:
                        continue
                    occurred_at = str(op.get("operation_date") or op.get("operationDate") or op.get("date") or "")
                    op_name = str(
                        op.get("operation_type_name")
                        or op.get("operationTypeName")
                        or op.get("type_name")
                        or op.get("type")
                        or ""
                    ).strip().lower()
                    amount = float(round(_to_float(op.get("amount") or op.get("operation_amount") or 0.0), 2))
                    commission = abs(_to_float(op.get("sale_commission") or op.get("commission") or 0.0))
                    logistics = (
                        abs(_to_float(op.get("delivery_charge") or 0.0))
                        + abs(_to_float(op.get("return_delivery_charge") or 0.0))
                    )
                    storage = 0.0
                    deductions = 0.0
                    acceptance = 0.0
                    penalties = 0.0
                    if "хранен" in op_name or "storage" in op_name:
                        storage = max(storage, abs(amount))
                    if "штраф" in op_name or "penalty" in op_name or "неустой" in op_name:
                        penalties = max(penalties, abs(amount))
                    if "удерж" in op_name or "deduct" in op_name or "коррект" in op_name:
                        deductions = max(deductions, abs(amount))
                    if "приемк" in op_name or "accept" in op_name:
                        acceptance = max(acceptance, abs(amount))
                    is_sale_income_op = bool(
                        "продаж" in op_name
                        or "реализац" in op_name
                        or "sale" in op_name
                        or "realization" in op_name
                    )
                    # Ozon sales revenue is already provided by analytics endpoint.
                    # Keep positive finance income only for non-sales adjustments.
                    income = 0.0 if is_sale_income_op else max(0.0, amount)
                    expense = max(0.0, -amount)
                    components = float(commission + logistics + storage + deductions + acceptance + penalties)
                    other_expense = max(0.0, expense - components)
                    if income <= 0 and expense <= 0 and components <= 0:
                        continue
                    rows.append(
                        {
                            "date": day.isoformat(),
                            "occurred_at": occurred_at,
                            "marketplace": "ozon",
                            "orders": 0,
                            "units": 0,
                            "buyouts": 0,
                            "order_amount": 0.0,
                            "buyout_amount": 0.0,
                            "revenue": 0.0,
                            "returns": 0,
                            "ad_spend": 0.0,
                            "penalties": float(round(penalties, 2)),
                            "income": float(round(income, 2)),
                            "expense": float(round(expense, 2)),
                            "net": float(round(income - expense, 2)),
                            "commission": float(round(commission, 2)),
                            "logistics": float(round(logistics, 2)),
                            "storage": float(round(storage, 2)),
                            "deductions": float(round(deductions, 2)),
                            "acceptance": float(round(acceptance, 2)),
                            "other_expense": float(round(other_expense, 2)),
                        }
                    )
                if len(operations) < OZON_FINANCE_PAGE_SIZE:
                    break
                page += 1
            chunk_from = chunk_to + timedelta(days=1)
            time.sleep(0.08)

    # Empty finance list for a period is normal for part of accounts; keep UI clean.
    return rows, list(dict.fromkeys(warnings))


def _request_wb_sales_payload(api_key: str, endpoint: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]] | None, str]:
    token = (api_key or "").strip()
    if not token:
        return None, "WB ключ не подключен."
    auth_variants = (token, f"Bearer {token}")
    last_error = "WB sales API недоступен."
    for auth_value in auth_variants:
        headers = {"Authorization": auth_value}
        max_attempts = 2
        for attempt in range(max_attempts):
            response = None
            try:
                with httpx.Client(timeout=WB_SALES_TIMEOUT, follow_redirects=True) as client:
                    response = client.get(endpoint, headers=headers, params=params)
            except Exception:
                response = None
            if response is None:
                if attempt < (max_attempts - 1):
                    time.sleep(0.3 * (attempt + 1))
                continue
            if response.status_code in {401, 403}:
                last_error = "WB sales API отклонил ключ (401/403)."
                break
            if response.status_code == 429:
                if attempt < (max_attempts - 1):
                    time.sleep(_wb_retry_after_sec(response, attempt))
                    continue
                return None, "rate_limited"
            if response.status_code >= 400:
                return None, f"WB sales API error {response.status_code}"
            try:
                payload = response.json()
            except Exception:
                if attempt < (max_attempts - 1):
                    time.sleep(0.25 * (attempt + 1))
                    continue
                return None, "WB sales API вернул некорректный ответ."
            rows = _extract_wb_list_payload(payload)
            if rows is not None:
                return rows, "ok"
            if attempt < (max_attempts - 1):
                time.sleep(0.2 * (attempt + 1))
                continue
            return None, "WB sales API вернул неожиданный формат."
    return None, last_error if last_error else "unavailable"


def _extract_wb_list_payload(payload: Any) -> list[dict[str, Any]] | None:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if not isinstance(payload, dict):
        return None
    for key in ("data", "rows", "items", "result", "list"):
        value = payload.get(key)
        if isinstance(value, list):
            return [x for x in value if isinstance(x, dict)]
        if isinstance(value, dict):
            for nested_key in ("data", "rows", "items", "list"):
                nested_value = value.get(nested_key)
                if isinstance(nested_value, list):
                    return [x for x in nested_value if isinstance(x, dict)]
    return None


def _wb_retry_after_sec(response: httpx.Response, attempt: int) -> float:
    headers = response.headers
    raw_values = (
        headers.get("Retry-After"),
        headers.get("X-Ratelimit-Retry"),
        headers.get("X-RateLimit-Retry"),
        headers.get("X-Ratelimit-Reset"),
        headers.get("X-RateLimit-Reset"),
    )
    for raw in raw_values:
        if raw is None:
            continue
        text = str(raw).strip()
        if not text:
            continue
        try:
            value = float(text)
        except Exception:
            continue
        if not math.isfinite(value) or value <= 0:
            continue
        return max(0.8, min(45.0, value))
    return min(14.0, 0.8 * (attempt + 1))


def _extract_wb_sales_cursor(item: dict[str, Any]) -> str:
    for key in ("lastChangeDate", "last_change_date", "date", "saleDate"):
        value = item.get(key)
        text = str(value or "").strip()
        if text:
            return text
    return ""


def _wb_sale_row_key(item: dict[str, Any]) -> str:
    sale_id = str(item.get("saleID") or item.get("saleId") or "").strip()
    srid = str(item.get("srid") or "").strip()
    rid = str(item.get("rid") or item.get("odid") or "").strip()
    nm_id = str(item.get("nmId") or item.get("nm_id") or "").strip()
    barcode = str(item.get("barcode") or "").strip()
    day = str(item.get("date") or item.get("saleDate") or "").strip()[:10]
    qty = str(item.get("quantity") or item.get("saleQty") or item.get("quantityFull") or "").strip()
    pay = str(item.get("forPay") or item.get("finishedPrice") or item.get("priceWithDisc") or "").strip()
    primary = sale_id or srid or rid
    if primary:
        return "|".join([primary, srid, sale_id, rid, nm_id, barcode, day, qty, pay])
    return "|".join([srid, sale_id, rid, nm_id, barcode, day, qty, pay])


def _wb_order_row_key(item: dict[str, Any]) -> str:
    order_id = str(item.get("rid") or item.get("odid") or item.get("gNumber") or "").strip()
    srid = str(item.get("srid") or "").strip()
    nm_id = str(item.get("nmId") or item.get("nm_id") or "").strip()
    barcode = str(item.get("barcode") or "").strip()
    article = str(item.get("supplierArticle") or item.get("supplier_article") or "").strip()
    qty = str(item.get("quantity") or item.get("quantityFull") or "").strip()
    price = str(item.get("totalPrice") or item.get("priceWithDisc") or item.get("finishedPrice") or "").strip()
    created = str(item.get("date") or item.get("createdAt") or item.get("orderDate") or "").strip()[:10]
    if order_id or srid:
        return "|".join([order_id, srid, nm_id, barcode, article, qty, price])
    return "|".join([nm_id, barcode, article, qty, price, created])


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


def _parse_any_datetime(value: Any) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except Exception:
        pass
    for candidate in (text, text[:19], text[:16]):
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"):
            try:
                return datetime.strptime(candidate, fmt)
            except Exception:
                continue
    base = _parse_any_date(text)
    if base is not None:
        return datetime.combine(base, datetime.min.time())
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
