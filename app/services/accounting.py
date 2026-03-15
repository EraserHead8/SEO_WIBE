from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import json
import math
import time
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from app.services.sales import build_sales_report


WB_TIMEOUT = httpx.Timeout(connect=5.0, read=18.0, write=18.0, pool=18.0)
OZON_TIMEOUT = httpx.Timeout(connect=6.0, read=22.0, write=22.0, pool=22.0)
WB_REPORT_DETAIL_LIMIT = 50_000
WB_REPORT_DETAIL_MAX_PAGES = 3
OZON_FINANCE_PAGE_SIZE = 500
OZON_FINANCE_MAX_PAGES = 8

RU_MONTH_NAMES = ('', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь')
def _ozon_month_chunk_end(day: date) -> date:
    next_month = (day.replace(day=28) + timedelta(days=4)).replace(day=1)
    return next_month - timedelta(days=1)


def build_accounting_payload(
    *,
    marketplace: str,
    date_from: date,
    date_to: date,
    wb_api_key: str,
    ozon_api_key: str,
    products: list[dict[str, Any]],
    expenses: list[dict[str, Any]],
    settings: dict[str, Any],
    granularity: str = "auto",
    tz_name: str = "UTC",
    search: str = "",
    sort_by: str = "net_profit_desc",
) -> dict[str, Any]:
    selected_market = str(marketplace or "all").strip().lower()
    if selected_market not in {"all", "wb", "ozon"}:
        selected_market = "all"

    report = build_sales_report(
        marketplace=selected_market,
        date_from=date_from,
        date_to=date_to,
        wb_api_key=wb_api_key,
        ozon_api_key=ozon_api_key,
        granularity=granularity,
        timezone=tz_name,
    )
    warnings = list(report.get("warnings") or [])
    sales_totals = dict(report.get("totals") or {})
    sales_chart = list(report.get("chart") or [])

    product_rows: list[dict[str, Any]] = []
    if selected_market in {"all", "wb"} and wb_api_key.strip():
        wb_rows, wb_warn = _fetch_wb_product_finance_rows(
            api_key=wb_api_key.strip(),
            date_from=date_from,
            date_to=date_to,
        )
        product_rows.extend(wb_rows)
        warnings.extend(wb_warn)
    if selected_market in {"all", "ozon"} and ozon_api_key.strip():
        oz_rows, oz_warn = _fetch_ozon_product_finance_rows(
            api_key=ozon_api_key.strip(),
            date_from=date_from,
            date_to=date_to,
        )
        product_rows.extend(oz_rows)
        warnings.extend(oz_warn)

    merged_rows = _merge_product_rows(product_rows, products)
    adjustments = _calc_adjustments(
        date_from=date_from,
        date_to=date_to,
        marketplace=selected_market,
        expenses=expenses,
        settings=settings,
        revenue=float(sales_totals.get("revenue") or 0.0),
    )
    rows = _apply_profit_math(
        merged_rows,
        adjustments=adjustments,
        sales_totals=sales_totals,
    )
    rows = _filter_and_sort_rows(rows, search=search, sort_by=sort_by)
    overview = _build_overview_payload(
        rows=rows,
        sales_totals=sales_totals,
        adjustments=adjustments,
        settings=settings,
    )
    chart = _build_profit_chart(
        sales_chart=sales_chart,
        sales_totals=sales_totals,
        overview=overview,
        adjustments=adjustments,
    )
    normalized_warnings = _normalize_accounting_warnings(warnings)
    return {
        "overview": overview,
        "analysis_rows": rows,
        "chart": chart,
        "warnings": normalized_warnings,
    }


def _fetch_wb_product_finance_rows(
    *,
    api_key: str,
    date_from: date,
    date_to: date,
    aggregate: bool = True,
) -> tuple[list[dict[str, Any]], list[str]]:
    endpoint = "https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod"
    rrdid = 0
    source_rows: list[dict[str, Any]] = []
    report_from = f"{date_from.isoformat()}T00:00:00+03:00"
    report_to = (date_to + timedelta(days=1)).isoformat()
    warnings: list[str] = []

    for _ in range(WB_REPORT_DETAIL_MAX_PAGES):
        params = {
            "dateFrom": report_from,
            "dateTo": report_to,
            "limit": WB_REPORT_DETAIL_LIMIT,
            "rrdid": rrdid,
        }
        payload, status = _request_wb_list(api_key=api_key, endpoint=endpoint, params=params)
        if payload is None:
            if status:
                if str(status) == "429":
                    warnings.append("WB accounting API временно ограничил запросы (429).")
                else:
                    warnings.append(f"WB accounting API недоступен ({status}).")
            break
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
        return [], warnings

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
                str(item.get("supplier_article") or item.get("sa_name") or ""),
            ]
        )
        if marker in dedupe_keys:
            continue
        dedupe_keys.add(marker)

        op_name = str(item.get("supplier_oper_name") or item.get("doc_type_name") or "").strip().lower()
        article = str(item.get("supplier_article") or item.get("sa_name") or "").strip()
        external_id = str(item.get("nm_id") or item.get("nmId") or "").strip()
        name = str(item.get("subject_name") or item.get("brand_name") or article or external_id or "WB товар").strip()
        quantity = int(round(abs(_to_float(item.get("quantity") or 0.0))))
        if quantity <= 0:
            quantity = 1
        sale_amount = abs(
            float(
                round(
                    _to_float(
                        item.get("retail_amount")
                        or item.get("retailAmount")
                        or item.get("retail_price_withdisc_rub")
                        or item.get("retailPriceWithDiscRub")
                        or item.get("sale_amount")
                        or item.get("saleAmount")
                        or item.get("ppvz_for_pay")
                        or item.get("ppvzForPay")
                        or item.get("forPay")
                        or item.get("for_pay")
                        or 0.0
                    ),
                    2,
                )
            )
        )
        return_amount = abs(
            float(
                round(
                    _to_float(
                        item.get("return_amount")
                        or item.get("returnAmount")
                        or item.get("return_sum")
                        or item.get("returnSum")
                        or 0.0
                    ),
                    2,
                )
            )
        )
        additional_payment = float(round(_to_float(item.get("additional_payment") or item.get("additionalPayment") or 0.0), 2))
        acquiring = abs(_to_float(item.get("acquiring_fee") or item.get("acquiringFee") or 0.0))
        commission = (
            abs(_to_float(item.get("ppvz_sales_commission") or item.get("ppvzSalesCommission") or 0.0))
            + abs(_to_float(item.get("ppvz_vw") or item.get("ppvzVw") or 0.0))
            + abs(_to_float(item.get("ppvz_vw_nds") or item.get("ppvzVwNds") or 0.0))
            + abs(_to_float(item.get("commission") or item.get("commission_amount") or item.get("commissionAmount") or 0.0))
        )
        logistics = (
            abs(_to_float(item.get("delivery_rub") or item.get("deliveryRub") or 0.0))
            + abs(_to_float(item.get("delivery_amount") or item.get("deliveryAmount") or 0.0))
            + abs(_to_float(item.get("rebill_logistic_cost") or item.get("rebillLogisticCost") or 0.0))
            + return_amount
        )
        storage = abs(_to_float(item.get("storage_fee") or item.get("storageFee") or item.get("storage") or 0.0))
        deductions = (
            abs(_to_float(item.get("deduction") or 0.0))
            + abs(_to_float(item.get("holding") or item.get("holds") or 0.0))
        )
        acceptance = abs(_to_float(item.get("acceptance") or item.get("acceptance_payment") or item.get("acceptancePayment") or 0.0))
        penalties = abs(_to_float(item.get("penalty") or item.get("fine") or item.get("fines") or 0.0))
        other_expense = max(0.0, -additional_payment)
        is_return = bool(return_amount > 0 or "возврат" in op_name or "return" in op_name)
        sold_units = 0 if is_return else quantity
        returns = quantity if is_return else 0
        revenue = sale_amount if not is_return else 0.0
        income = 0.0
        if revenue > 0:
            income += revenue
        if additional_payment > 0:
            income += additional_payment
        expense = commission + acquiring + logistics + storage + deductions + acceptance + penalties + other_expense
        rows.append(
            {
                "date": day.isoformat(),
                "marketplace": "wb",
                "article": article or external_id,
                "external_id": external_id,
                "name": name,
                "sold_units": sold_units,
                "returns": returns,
                "revenue": float(round(revenue, 2)),
                "income": float(round(income, 2)),
                "expense": float(round(expense, 2)),
                "commission": float(round(commission, 2)),
                "acquiring": float(round(acquiring, 2)),
                "logistics": float(round(logistics, 2)),
                "storage": float(round(storage, 2)),
                "deductions": float(round(deductions, 2)),
                "acceptance": float(round(acceptance, 2)),
                "penalties": float(round(penalties, 2)),
                "other_expense": float(round(other_expense, 2)),
                "ad_spend": 0.0,
            }
        )
    return (_aggregate_rows(rows) if aggregate else rows), warnings


def _fetch_ozon_product_finance_rows(
    *,
    api_key: str,
    date_from: date,
    date_to: date,
    aggregate: bool = True,
) -> tuple[list[dict[str, Any]], list[str]]:
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
    headers = {"Client-Id": client_id, "Api-Key": token, "Content-Type": "application/json"}
    endpoint = "https://api-seller.ozon.ru/v3/finance/transaction/list"

    rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    chunk_from = date_from
    with httpx.Client(timeout=OZON_TIMEOUT, follow_redirects=True) as client:
        while chunk_from <= date_to:
            # Ozon v3 finance validates date window by calendar month.
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
                for request_attempt in range(5):
                    try:
                        response = client.post(endpoint, headers=headers, json=payload)
                    except Exception:
                        response = None
                    if response is None:
                        if request_attempt < 4:
                            time.sleep(0.35 * (request_attempt + 1))
                            continue
                        warnings.append("Ozon accounting API недоступен.")
                        break
                    status_code = int(response.status_code)
                    if status_code == 429:
                        if request_attempt < 4:
                            time.sleep(min(8.0, 1.1 * (request_attempt + 1)))
                            continue
                        warnings.append("Ozon accounting API временно ограничил запросы (429).")
                        response = None
                        break
                    if status_code >= 500 and request_attempt < 3:
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
                        warnings.append("Ozon accounting API: период запроса должен быть в пределах одного месяца.")
                    else:
                        warnings.append(f"Ozon accounting API error {response.status_code}.")
                    break
                try:
                    data = response.json()
                except Exception:
                    raw_text = ""
                    try:
                        raw_text = str(response.text or "")
                    except Exception:
                        raw_text = ""
                    try:
                        data = json.loads(raw_text.lstrip("\ufeff"))
                    except Exception:
                        warnings.append("Ozon accounting API вернул некорректный ответ.")
                        break
                result = data.get("result") if isinstance(data, dict) else {}
                operations = result.get("operations") if isinstance(result, dict) else []
                if not isinstance(operations, list):
                    operations = []
                if not operations and isinstance(result, dict):
                    for key in ("items", "rows", "list", "transactions"):
                        candidate = result.get(key)
                        if isinstance(candidate, list):
                            operations = candidate
                            break
                if not operations and isinstance(data, dict):
                    for key in ("operations", "items", "rows", "list", "transactions"):
                        candidate = data.get(key)
                        if isinstance(candidate, list):
                            operations = candidate
                            break
                if not isinstance(operations, list) or not operations:
                    break
                for op in operations:
                    if not isinstance(op, dict):
                        continue
                    day = _parse_any_date(op.get("operation_date") or op.get("operationDate") or op.get("date"))
                    if not day or day < date_from or day > date_to:
                        continue
                    op_name = str(
                        op.get("operation_type_name")
                        or op.get("operationTypeName")
                        or op.get("type_name")
                        or op.get("type")
                        or ""
                    ).strip().lower()
                    amount = float(round(_to_float(op.get("amount") or op.get("operation_amount") or 0.0), 2))
                    commission = abs(
                        _to_float(
                            op.get("sale_commission")
                            or op.get("commission")
                            or op.get("commission_amount")
                            or op.get("services_commission")
                            or 0.0
                        )
                    )
                    logistics = (
                        abs(_to_float(op.get("delivery_charge") or op.get("delivery_amount") or op.get("delivery_service") or 0.0))
                        + abs(_to_float(op.get("return_delivery_charge") or op.get("return_delivery_amount") or 0.0))
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
                    income = max(0.0, amount)
                    expense = max(0.0, -amount)
                    components = commission + logistics + storage + deductions + acceptance + penalties
                    other_expense = max(0.0, expense - components)
                    is_return = bool("возврат" in op_name or "return" in op_name)
                    is_sale = bool("продаж" in op_name or "sale" in op_name or "realization" in op_name)
                    item_rows = _extract_ozon_items(op)
                    if not item_rows:
                        item_rows = [
                            {
                                "article": str(op.get("posting_number") or op.get("postingNumber") or op.get("operation_id") or "ozon-unassigned"),
                                "external_id": str(op.get("sku") or op.get("offer_id") or op.get("offerId") or ""),
                                "name": str(op.get("operation_type_name") or "Ozon операция"),
                                "quantity": 1,
                            }
                        ]
                    total_qty = sum(max(1, int(_to_int(x.get("quantity") or 1))) for x in item_rows)
                    for item in item_rows:
                        qty = max(1, int(_to_int(item.get("quantity") or 1)))
                        share = float(qty) / float(total_qty or 1)
                        sold_units = qty if is_sale and not is_return and income > 0 else 0
                        returned = qty if is_return else 0
                        revenue = max(0.0, income * share) if is_sale and not is_return else 0.0
                        rows.append(
                            {
                                "date": day.isoformat(),
                                "marketplace": "ozon",
                                "article": str(item.get("article") or "").strip(),
                                "external_id": str(item.get("external_id") or "").strip(),
                                "name": str(item.get("name") or "Ozon товар").strip(),
                                "sold_units": sold_units,
                                "returns": returned,
                                "revenue": float(round(revenue, 2)),
                                "income": float(round(income * share, 2)),
                                "expense": float(round(expense * share, 2)),
                                "commission": float(round(commission * share, 2)),
                                "logistics": float(round(logistics * share, 2)),
                                "storage": float(round(storage * share, 2)),
                                "deductions": float(round(deductions * share, 2)),
                                "acceptance": float(round(acceptance * share, 2)),
                                "penalties": float(round(penalties * share, 2)),
                                "other_expense": float(round(other_expense * share, 2)),
                                "ad_spend": 0.0,
                            }
                        )
                if len(operations) < OZON_FINANCE_PAGE_SIZE:
                    break
                page += 1
            chunk_from = chunk_to + timedelta(days=1)
            time.sleep(0.08)
    return (_aggregate_rows(rows) if aggregate else rows), list(dict.fromkeys(warnings))


def _extract_ozon_items(op: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    sources = []
    for key in ("items", "products", "product_list"):
        value = op.get(key)
        if isinstance(value, list):
            sources.extend(value)
    posting = op.get("posting")
    if isinstance(posting, dict):
        value = posting.get("products")
        if isinstance(value, list):
            sources.extend(value)
    for item in sources:
        if not isinstance(item, dict):
            continue
        article = str(item.get("offer_id") or item.get("offerId") or item.get("vendor_code") or item.get("article") or item.get("sku") or "").strip()
        external_id = str(item.get("sku") or item.get("product_id") or item.get("productId") or "").strip()
        name = str(item.get("name") or item.get("title") or article or external_id or "Ozon товар").strip()
        quantity = max(1, int(_to_int(item.get("quantity") or item.get("qty") or item.get("count") or 1)))
        if not article and external_id:
            article = external_id
        out.append(
            {
                "article": article,
                "external_id": external_id,
                "name": name,
                "quantity": quantity,
            }
        )
    return out


def _merge_product_rows(rows: list[dict[str, Any]], products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    index: dict[tuple[str, str], dict[str, Any]] = {}
    for row in products or []:
        mp = str(row.get("marketplace") or "").strip().lower()
        if mp not in {"wb", "ozon"}:
            continue
        article = _norm_key(row.get("article"))
        external_id = _norm_key(row.get("external_id"))
        barcode = _norm_key(row.get("barcode"))
        item = {
            "name": str(row.get("name") or "").strip(),
            "purchase_price": float(round(_to_float(row.get("purchase_price") or 0.0), 2)),
        }
        for key in (article, external_id, barcode):
            if key:
                index[(mp, key)] = item

    out: list[dict[str, Any]] = []
    for row in rows:
        mp = str(row.get("marketplace") or "").strip().lower()
        article = str(row.get("article") or "").strip()
        external_id = str(row.get("external_id") or "").strip()
        name = str(row.get("name") or "").strip()
        mapped = (
            index.get((mp, _norm_key(article)))
            or index.get((mp, _norm_key(external_id)))
            or None
        )
        purchase_price = float(round(_to_float((mapped or {}).get("purchase_price") or 0.0), 2))
        display_name = str((mapped or {}).get("name") or name or article or external_id or "-").strip()
        sold_units = int(_to_int(row.get("sold_units") or 0))
        returns = int(_to_int(row.get("returns") or 0))
        revenue = float(round(_to_float(row.get("revenue") or 0.0), 2))
        ad_spend = float(round(_to_float(row.get("ad_spend") or 0.0), 2))
        commission = float(round(_to_float(row.get("commission") or 0.0), 2))
        acquiring = float(round(_to_float(row.get("acquiring") or 0.0), 2))
        logistics = float(round(_to_float(row.get("logistics") or 0.0), 2))
        storage = float(round(_to_float(row.get("storage") or 0.0), 2))
        deductions = float(round(_to_float(row.get("deductions") or 0.0), 2))
        acceptance = float(round(_to_float(row.get("acceptance") or 0.0), 2))
        penalties = float(round(_to_float(row.get("penalties") or 0.0), 2))
        other_expense = float(round(_to_float(row.get("other_expense") or 0.0), 2))
        marketplace_expense = float(
            round(
                ad_spend + commission + acquiring + logistics + storage + deductions + acceptance + penalties + other_expense,
                2,
            )
        )
        cogs = float(round(max(0, sold_units) * purchase_price, 2))
        gross_profit = float(round(revenue - cogs, 2))
        operating_profit = float(round(gross_profit - marketplace_expense, 2))
        return_rate = round((returns / max(1, sold_units + returns)) * 100.0, 2)
        out.append(
            {
                "marketplace": mp,
                "article": article,
                "external_id": external_id,
                "name": display_name,
                "sold_units": sold_units,
                "returns": returns,
                "return_rate": return_rate,
                "revenue": revenue,
                "purchase_price": purchase_price,
                "cogs": cogs,
                "commission": commission,
                "acquiring": acquiring,
                "logistics": logistics,
                "storage": storage,
                "deductions": deductions,
                "acceptance": acceptance,
                "penalties": penalties,
                "other_expense": other_expense,
                "ad_spend": ad_spend,
                "marketplace_expense": marketplace_expense,
                "gross_profit": gross_profit,
                "operating_profit": operating_profit,
                "extra_expenses": 0.0,
                "additional_cost": 0.0,
                "tax": 0.0,
                "vat": 0.0,
                "net_profit": operating_profit,
                "margin": round((operating_profit / revenue) * 100.0, 2) if revenue > 0 else 0.0,
            }
        )
    return _aggregate_rows(out)


def _aggregate_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    bucket: dict[tuple[str, str, str], dict[str, Any]] = {}
    for row in rows:
        mp = str(row.get("marketplace") or "").strip().lower()
        article = str(row.get("article") or "").strip()
        external_id = str(row.get("external_id") or "").strip()
        name = str(row.get("name") or article or external_id or "-").strip()
        key = (mp, article or external_id or name, external_id)
        agg = bucket.setdefault(
            key,
            {
                "marketplace": mp,
                "article": article or external_id or name,
                "external_id": external_id,
                "name": name,
                "sold_units": 0,
                "returns": 0,
                "return_rate": 0.0,
                "revenue": 0.0,
                "purchase_price": 0.0,
                "cogs": 0.0,
                "commission": 0.0,
                "acquiring": 0.0,
                "logistics": 0.0,
                "storage": 0.0,
                "deductions": 0.0,
                "acceptance": 0.0,
                "penalties": 0.0,
                "other_expense": 0.0,
                "ad_spend": 0.0,
                "marketplace_expense": 0.0,
                "gross_profit": 0.0,
                "operating_profit": 0.0,
                "extra_expenses": 0.0,
                "additional_cost": 0.0,
                "tax": 0.0,
                "vat": 0.0,
                "net_profit": 0.0,
                "margin": 0.0,
            },
        )
        sold_units = int(_to_int(row.get("sold_units") or 0))
        prev_units = int(_to_int(agg.get("sold_units") or 0))
        agg["sold_units"] = prev_units + sold_units
        agg["returns"] = int(_to_int(agg.get("returns") or 0)) + int(_to_int(row.get("returns") or 0))
        for metric in (
            "revenue",
            "cogs",
            "commission",
            "acquiring",
            "logistics",
            "storage",
            "deductions",
            "acceptance",
            "penalties",
            "other_expense",
            "ad_spend",
            "marketplace_expense",
            "gross_profit",
            "operating_profit",
            "extra_expenses",
            "additional_cost",
            "tax",
            "vat",
            "net_profit",
        ):
            agg[metric] = float(round(float(agg.get(metric) or 0.0) + float(row.get(metric) or 0.0), 2))
        price = float(round(_to_float(row.get("purchase_price") or 0.0), 2))
        if sold_units > 0:
            total_cost = float(agg.get("purchase_price") or 0.0) * prev_units + price * sold_units
            agg["purchase_price"] = float(round(total_cost / max(1, agg["sold_units"]), 2))
        elif price > 0 and float(agg.get("purchase_price") or 0.0) <= 0:
            agg["purchase_price"] = price
        agg["margin"] = round((float(agg["net_profit"]) / float(agg["revenue"])) * 100.0, 2) if float(agg["revenue"]) > 0 else 0.0
        agg["return_rate"] = round((int(agg["returns"]) / max(1, int(agg["sold_units"]) + int(agg["returns"]))) * 100.0, 2)
    out = list(bucket.values())
    out.sort(key=lambda x: (str(x.get("marketplace") or ""), str(x.get("name") or ""), str(x.get("article") or "")))
    return out


def _calc_adjustments(
    *,
    date_from: date,
    date_to: date,
    marketplace: str,
    expenses: list[dict[str, Any]],
    settings: dict[str, Any],
    revenue: float,
) -> dict[str, float]:
    expenses_total = 0.0
    for row in expenses or []:
        if not row or not bool(row.get("is_active", True)):
            continue
        row_market = str(row.get("marketplace") or "all").strip().lower()
        if row_market not in {"all", "wb", "ozon"}:
            row_market = "all"
        if marketplace in {"wb", "ozon"} and row_market not in {"all", marketplace}:
            continue
        expenses_total += _expense_amount_for_period(row=row, date_from=date_from, date_to=date_to)

    revenue_safe = max(0.0, float(revenue or 0.0))
    vat_rate = max(0.0, _to_float(settings.get("vat_rate") or 0.0))
    tax_rate = max(0.0, _to_float(settings.get("tax_rate") or 0.0))
    additional_rate = max(0.0, _to_float(settings.get("additional_rate") or 0.0))
    fixed_cost_month = max(0.0, _to_float(settings.get("fixed_cost_per_month") or 0.0))
    fixed_cost_amount = _monthly_amount_for_period(
        amount=fixed_cost_month,
        date_from=date_from,
        date_to=date_to,
    )
    additional_cost = float(round((revenue_safe * additional_rate / 100.0) + fixed_cost_amount, 2))
    vat_amount = float(round(revenue_safe * vat_rate / 100.0, 2))
    return {
        "expenses_total": float(round(expenses_total, 2)),
        "additional_cost": additional_cost,
        "vat_amount": vat_amount,
        "tax_rate": tax_rate,
        "vat_rate": vat_rate,
        "additional_rate": additional_rate,
        "fixed_cost_amount": float(round(fixed_cost_amount, 2)),
    }


def _apply_profit_math(
    rows: list[dict[str, Any]],
    *,
    adjustments: dict[str, float],
    sales_totals: dict[str, Any],
) -> list[dict[str, Any]]:
    if not rows:
        return []
    def _component_total(metric: str) -> float:
        total_from_sales = float(_to_float(sales_totals.get(metric) or 0.0))
        if abs(total_from_sales) > 0.0001:
            return total_from_sales
        return float(round(sum(float(row.get(metric) or 0.0) for row in rows), 2))

    total_revenue = float(round(sum(float(row.get("revenue") or 0.0) for row in rows), 2))
    marketplace_expense_total = float(
        round(
            _component_total("commission")
            + _component_total("acquiring")
            + _component_total("logistics")
            + _component_total("storage")
            + _component_total("deductions")
            + _component_total("acceptance")
            + _component_total("other_expense")
            + _component_total("penalties")
            + _component_total("ad_spend"),
            2,
        )
    )
    cogs_total = float(round(sum(float(row.get("cogs") or 0.0) for row in rows), 2))
    revenue_total = float(sales_totals.get("revenue") or 0.0)
    operating_total = float(round(revenue_total - cogs_total - marketplace_expense_total - float(adjustments.get("expenses_total") or 0.0), 2))
    tax_rate = float(adjustments.get("tax_rate") or 0.0)
    additional_cost = float(adjustments.get("additional_cost") or 0.0)
    vat_amount = float(adjustments.get("vat_amount") or 0.0)
    tax_amount = float(round(max(0.0, operating_total - additional_cost) * tax_rate / 100.0, 2))

    for row in rows:
        revenue = float(row.get("revenue") or 0.0)
        share = (revenue / total_revenue) if total_revenue > 0 else 0.0
        row["extra_expenses"] = float(round(float(adjustments.get("expenses_total") or 0.0) * share, 2))
        row["additional_cost"] = float(round(additional_cost * share, 2))
        row["vat"] = float(round(vat_amount * share, 2))
        row["tax"] = float(round(tax_amount * share, 2))
        row["net_profit"] = float(
            round(
                float(row.get("operating_profit") or 0.0)
                - float(row.get("extra_expenses") or 0.0)
                - float(row.get("additional_cost") or 0.0)
                - float(row.get("vat") or 0.0)
                - float(row.get("tax") or 0.0),
                2,
            )
        )
        row["margin"] = round((float(row["net_profit"]) / revenue) * 100.0, 2) if revenue > 0 else 0.0
    return rows


def _build_overview_payload(
    *,
    rows: list[dict[str, Any]],
    sales_totals: dict[str, Any],
    adjustments: dict[str, float],
    settings: dict[str, Any],
) -> dict[str, Any]:
    def _component_total(metric: str) -> float:
        total_from_sales = float(round(_to_float(sales_totals.get(metric) or 0.0), 2))
        if abs(total_from_sales) > 0.0001:
            return total_from_sales
        return float(round(sum(float(row.get(metric) or 0.0) for row in rows), 2))

    def _component_total_by_market(metric: str, mp: str) -> float:
        key = f"{mp}_{metric}"
        total_from_sales = float(round(_to_float(sales_totals.get(key) or 0.0), 2))
        if abs(total_from_sales) > 0.0001:
            return total_from_sales
        return float(
            round(
                sum(
                    float(row.get(metric) or 0.0)
                    for row in rows
                    if str(row.get("marketplace") or "").strip().lower() == mp
                ),
                2,
            )
        )

    revenue = float(round(_to_float(sales_totals.get("revenue") or 0.0), 2))
    cogs = float(round(sum(float(row.get("cogs") or 0.0) for row in rows), 2))
    marketplace_expense = float(
        round(
            _component_total("commission")
            + _component_total("acquiring")
            + _component_total("logistics")
            + _component_total("storage")
            + _component_total("deductions")
            + _component_total("acceptance")
            + _component_total("other_expense")
            + _component_total("penalties")
            + _component_total("ad_spend"),
            2,
        )
    )
    gross_profit = float(round(revenue - cogs, 2))
    expenses_total = float(round(_to_float(adjustments.get("expenses_total") or 0.0), 2))
    operating_profit = float(round(gross_profit - marketplace_expense - expenses_total, 2))
    additional_cost = float(round(_to_float(adjustments.get("additional_cost") or 0.0), 2))
    vat_amount = float(round(_to_float(adjustments.get("vat_amount") or 0.0), 2))
    tax_rate = max(0.0, _to_float(adjustments.get("tax_rate") or 0.0))
    tax_amount = float(round(max(0.0, operating_profit - additional_cost) * tax_rate / 100.0, 2))
    net_profit = float(round(operating_profit - additional_cost - vat_amount - tax_amount, 2))
    margin = round((net_profit / revenue) * 100.0, 2) if revenue > 0 else 0.0

    by_marketplace: dict[str, dict[str, float | int]] = {}
    for code in ("wb", "ozon"):
        revenue_mp = float(round(_to_float(sales_totals.get(f"{code}_revenue") or 0.0), 2))
        cogs_mp = float(round(sum(float(row.get("cogs") or 0.0) for row in rows if str(row.get("marketplace") or "") == code), 2))
        market_exp_mp = float(
            round(
                _component_total_by_market("commission", code)
                + _component_total_by_market("acquiring", code)
                + _component_total_by_market("logistics", code)
                + _component_total_by_market("storage", code)
                + _component_total_by_market("deductions", code)
                + _component_total_by_market("acceptance", code)
                + _component_total_by_market("other_expense", code)
                + _component_total_by_market("penalties", code)
                + _component_total_by_market("ad_spend", code),
                2,
            )
        )
        gross_mp = float(round(revenue_mp - cogs_mp, 2))
        operating_mp = float(round(gross_mp - market_exp_mp, 2))
        margin_mp = round((operating_mp / revenue_mp) * 100.0, 2) if revenue_mp > 0 else 0.0
        by_marketplace[code] = {
            "orders": int(_to_int(sales_totals.get(f"{code}_orders") or 0)),
            "units": int(_to_int(sales_totals.get(f"{code}_units") or 0)),
            "buyouts": int(_to_int(sales_totals.get(f"{code}_buyouts") or 0)),
            "returns": int(_to_int(sales_totals.get(f"{code}_returns") or 0)),
            "revenue": revenue_mp,
            "cogs": cogs_mp,
            "acquiring": float(round(_component_total_by_market("acquiring", code), 2)),
            "marketplace_expense": market_exp_mp,
            "gross_profit": gross_mp,
            "operating_profit": operating_mp,
            "margin": margin_mp,
        }

    return {
        "orders": int(_to_int(sales_totals.get("orders") or 0)),
        "units": int(_to_int(sales_totals.get("units") or 0)),
        "buyouts": int(_to_int(sales_totals.get("buyouts") or 0)),
        "returns": int(_to_int(sales_totals.get("returns") or 0)),
        "revenue": revenue,
        "cogs": cogs,
        "gross_profit": gross_profit,
        "marketplace_expense": marketplace_expense,
        "operating_profit": operating_profit,
        "custom_expenses": expenses_total,
        "additional_cost": additional_cost,
        "vat_amount": vat_amount,
        "tax_amount": tax_amount,
        "net_profit": net_profit,
        "margin": margin,
        "commission": float(round(_component_total("commission"), 2)),
        "acquiring": float(round(_component_total("acquiring"), 2)),
        "logistics": float(round(_component_total("logistics"), 2)),
        "storage": float(round(_component_total("storage"), 2)),
        "deductions": float(round(_component_total("deductions"), 2)),
        "acceptance": float(round(_component_total("acceptance"), 2)),
        "penalties": float(round(_component_total("penalties"), 2)),
        "other_expense": float(round(_component_total("other_expense"), 2)),
        "ad_spend": float(round(_component_total("ad_spend"), 2)),
        "settings": {
            "vat_rate": float(round(_to_float(settings.get("vat_rate") or 0.0), 2)),
            "tax_rate": float(round(_to_float(settings.get("tax_rate") or 0.0), 2)),
            "additional_rate": float(round(_to_float(settings.get("additional_rate") or 0.0), 2)),
            "fixed_cost_per_month": float(round(_to_float(settings.get("fixed_cost_per_month") or 0.0), 2)),
        },
        "by_marketplace": by_marketplace,
    }


def _build_profit_chart(
    *,
    sales_chart: list[dict[str, Any]],
    sales_totals: dict[str, Any],
    overview: dict[str, Any],
    adjustments: dict[str, float],
) -> list[dict[str, Any]]:
    if not sales_chart:
        return []
    total_revenue = float(_to_float(sales_totals.get("revenue") or 0.0))
    total_buyouts = int(_to_int(sales_totals.get("buyouts") or 0))
    total_cogs = float(_to_float(overview.get("cogs") or 0.0))
    avg_purchase = (total_cogs / total_buyouts) if total_buyouts > 0 else 0.0
    alloc_total = float(
        _to_float(adjustments.get("expenses_total") or 0.0)
        + _to_float(adjustments.get("additional_cost") or 0.0)
        + _to_float(overview.get("tax_amount") or 0.0)
        + _to_float(overview.get("vat_amount") or 0.0)
    )
    out: list[dict[str, Any]] = []
    for point in sales_chart:
        bucket = str(point.get("bucket") or point.get("date") or "").strip()
        revenue = float(round(_to_float(point.get("revenue") or 0.0), 2))
        buyouts = int(_to_int(point.get("buyouts") or 0))
        cogs = float(round(max(0, buyouts) * avg_purchase, 2))
        market_expense = float(
            round(
                _to_float(point.get("commission") or 0.0)
                + _to_float(point.get("acquiring") or 0.0)
                + _to_float(point.get("logistics") or 0.0)
                + _to_float(point.get("storage") or 0.0)
                + _to_float(point.get("deductions") or 0.0)
                + _to_float(point.get("acceptance") or 0.0)
                + _to_float(point.get("other_expense") or 0.0)
                + _to_float(point.get("penalties") or 0.0)
                + _to_float(point.get("ad_spend") or 0.0),
                2,
            )
        )
        gross_profit = float(round(revenue - cogs, 2))
        operating_profit = float(round(gross_profit - market_expense, 2))
        share = (revenue / total_revenue) if total_revenue > 0 else 0.0
        allocation = float(round(alloc_total * share, 2))
        net_profit = float(round(operating_profit - allocation, 2))
        out.append(
            {
                "date": str(point.get("date") or ""),
                "bucket": bucket,
                "revenue": revenue,
                "cogs": cogs,
                "marketplace_expense": market_expense,
                "gross_profit": gross_profit,
                "operating_profit": operating_profit,
                "net_profit": net_profit,
            }
        )
    return out


def _filter_and_sort_rows(rows: list[dict[str, Any]], *, search: str, sort_by: str) -> list[dict[str, Any]]:
    query = str(search or "").strip().lower()
    out = rows
    if query:
        out = [
            row
            for row in out
            if query in str(row.get("name") or "").lower()
            or query in str(row.get("article") or "").lower()
            or query in str(row.get("external_id") or "").lower()
        ]
    mode = str(sort_by or "net_profit_desc").strip().lower()
    sorter: dict[str, tuple[str, bool]] = {
        "net_profit_desc": ("net_profit", True),
        "net_profit_asc": ("net_profit", False),
        "operating_profit_desc": ("operating_profit", True),
        "operating_profit_asc": ("operating_profit", False),
        "revenue_desc": ("revenue", True),
        "revenue_asc": ("revenue", False),
        "sold_units_desc": ("sold_units", True),
        "sold_units_asc": ("sold_units", False),
        "margin_desc": ("margin", True),
        "margin_asc": ("margin", False),
        "return_rate_desc": ("return_rate", True),
        "return_rate_asc": ("return_rate", False),
        "marketplace_expense_desc": ("marketplace_expense", True),
        "marketplace_expense_asc": ("marketplace_expense", False),
    }
    metric, desc = sorter.get(mode, ("net_profit", True))
    out = sorted(
        out,
        key=lambda row: (float(row.get(metric) or 0.0), float(row.get("revenue") or 0.0), str(row.get("name") or "")),
        reverse=desc,
    )
    return out


def build_accounting_monthly_summary(
    *,
    months: int = 12,
    tz_name: str = "Europe/Moscow",
    wb_api_key: str,
    ozon_api_key: str,
    products: list[dict[str, Any]],
    expenses: list[dict[str, Any]],
    settings: dict[str, Any],
) -> dict[str, Any]:
    month_count = max(1, min(12, int(months or 12)))
    tz_code = str(tz_name or "Europe/Moscow").strip() or "Europe/Moscow"
    try:
        tzinfo = ZoneInfo(tz_code)
    except Exception:
        tz_code = "UTC"
        tzinfo = ZoneInfo("UTC")

    periods = _build_month_periods(month_count, tzinfo=tzinfo)
    if not periods:
        return {
            "months": [],
            "meta": {
                "source": "live",
                "partial": False,
                "warnings": [],
                "generated_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
            },
        }

    left = periods[-1]["date_from"]
    right = periods[0]["date_to"]
    sales_report = build_sales_report(
        marketplace="all",
        date_from=left,
        date_to=right,
        wb_api_key=wb_api_key,
        ozon_api_key=ozon_api_key,
        granularity="day",
        timezone=tz_code,
    )
    warnings: list[str] = list(sales_report.get("warnings") or []) if isinstance(sales_report, dict) else []
    sales_rows = list(sales_report.get("rows") or []) if isinstance(sales_report, dict) else []

    monthly_raw: dict[str, dict[str, dict[str, Any]]] = {
        str(period["month_key"]): {"wb": _new_monthly_kpi(), "ozon": _new_monthly_kpi()}
        for period in periods
    }

    for row in sales_rows:
        if not isinstance(row, dict):
            continue
        mp = str(row.get("marketplace") or "").strip().lower()
        if mp not in {"wb", "ozon"}:
            continue
        day = _parse_any_date(row.get("date") or row.get("occurred_at"))
        if day is None:
            continue
        month_key = f"{day.year:04d}-{day.month:02d}"
        slot = monthly_raw.get(month_key)
        if not isinstance(slot, dict):
            continue
        kpi = slot[mp]
        kpi["turnover"] = float(round(float(kpi.get("turnover") or 0.0) + _to_float(row.get("revenue") or 0.0), 2))
        kpi["orders"] = int(_to_int(kpi.get("orders") or 0)) + int(_to_int(row.get("orders") or 0))
        kpi["units"] = int(_to_int(kpi.get("units") or 0)) + int(_to_int(row.get("units") or 0))
        kpi["buyouts"] = int(_to_int(kpi.get("buyouts") or 0)) + int(_to_int(row.get("buyouts") or 0))
        kpi["commission"] = float(round(float(kpi.get("commission") or 0.0) + _to_float(row.get("commission") or 0.0), 2))
        kpi["logistics"] = float(round(float(kpi.get("logistics") or 0.0) + _to_float(row.get("logistics") or 0.0), 2))
        kpi["storage"] = float(round(float(kpi.get("storage") or 0.0) + _to_float(row.get("storage") or 0.0), 2))
        kpi["penalties"] = float(round(float(kpi.get("penalties") or 0.0) + _to_float(row.get("penalties") or 0.0), 2))
        kpi["ad_spend"] = float(round(float(kpi.get("ad_spend") or 0.0) + _to_float(row.get("ad_spend") or 0.0), 2))
        extra_mp = _to_float(row.get("other_expense") or 0.0) + _to_float(row.get("deductions") or 0.0) + _to_float(row.get("acceptance") or 0.0)
        kpi["other_expenses"] = float(round(float(kpi.get("other_expenses") or 0.0) + extra_mp, 2))

    product_rows: list[dict[str, Any]] = []
    wb_rows: list[dict[str, Any]] = []
    ozon_rows: list[dict[str, Any]] = []
    if wb_api_key.strip():
        wb_rows, wb_warn = _fetch_wb_product_finance_rows(
            api_key=wb_api_key.strip(),
            date_from=left,
            date_to=right,
            aggregate=False,
        )
        product_rows.extend(wb_rows)
        warnings.extend(wb_warn)
    if ozon_api_key.strip():
        ozon_rows, ozon_warn = _fetch_ozon_product_finance_rows(
            api_key=ozon_api_key.strip(),
            date_from=left,
            date_to=right,
            aggregate=False,
        )
        product_rows.extend(ozon_rows)
        warnings.extend(ozon_warn)

    product_monthly: dict[str, dict[str, dict[str, Any]]] = {
        str(period["month_key"]): {"wb": _new_monthly_kpi(), "ozon": _new_monthly_kpi()}
        for period in periods
    }
    price_index = _build_purchase_price_index(products)
    wb_acquiring_has_field = False
    for row in product_rows:
        if not isinstance(row, dict):
            continue
        mp = str(row.get("marketplace") or "").strip().lower()
        if mp not in {"wb", "ozon"}:
            continue
        day = _parse_any_date(row.get("date"))
        if day is None:
            continue
        month_key = f"{day.year:04d}-{day.month:02d}"
        slot = product_monthly.get(month_key)
        if not isinstance(slot, dict):
            continue
        kpi = slot[mp]

        revenue = max(0.0, _to_float(row.get("revenue") or 0.0))
        if revenue > 0:
            kpi["turnover"] = float(round(float(kpi.get("turnover") or 0.0) + revenue, 2))

        sold_units = max(0, int(_to_int(row.get("sold_units") or 0)))
        if sold_units > 0:
            kpi["units"] = int(_to_int(kpi.get("units") or 0)) + sold_units
            kpi["buyouts"] = int(_to_int(kpi.get("buyouts") or 0)) + sold_units

        kpi["commission"] = float(round(float(kpi.get("commission") or 0.0) + max(0.0, _to_float(row.get("commission") or 0.0)), 2))
        kpi["logistics"] = float(round(float(kpi.get("logistics") or 0.0) + max(0.0, _to_float(row.get("logistics") or 0.0)), 2))
        kpi["storage"] = float(round(float(kpi.get("storage") or 0.0) + max(0.0, _to_float(row.get("storage") or 0.0)), 2))
        kpi["penalties"] = float(round(float(kpi.get("penalties") or 0.0) + max(0.0, _to_float(row.get("penalties") or 0.0)), 2))
        kpi["ad_spend"] = float(round(float(kpi.get("ad_spend") or 0.0) + max(0.0, _to_float(row.get("ad_spend") or 0.0)), 2))
        extra_mp = (
            max(0.0, _to_float(row.get("other_expense") or 0.0))
            + max(0.0, _to_float(row.get("deductions") or 0.0))
            + max(0.0, _to_float(row.get("acceptance") or 0.0))
        )
        if extra_mp > 0:
            kpi["other_expenses"] = float(round(float(kpi.get("other_expenses") or 0.0) + extra_mp, 2))

        if "acquiring" in row:
            acquiring = max(0.0, _to_float(row.get("acquiring") or 0.0))
            if acquiring > 0:
                if mp == "wb":
                    wb_acquiring_has_field = True
                kpi["acquiring"] = float(round(float(kpi.get("acquiring") or 0.0) + acquiring, 2))

        if sold_units > 0:
            purchase_price = _resolve_purchase_price(
                price_index,
                marketplace=mp,
                article=str(row.get("article") or "").strip(),
                external_id=str(row.get("external_id") or "").strip(),
                barcode=str(row.get("barcode") or "").strip(),
            )
            if purchase_price > 0:
                kpi["cogs"] = float(round(float(kpi.get("cogs") or 0.0) + (purchase_price * sold_units), 2))

    if wb_api_key.strip() and wb_rows and not wb_acquiring_has_field:
        warnings.append("WB API did not provide a separate acquiring field for this period, acquiring is set to 0.")

    vat_rate = max(0.0, _to_float(settings.get("vat_rate") or 0.0))
    tax_rate = max(0.0, _to_float(settings.get("tax_rate") or 0.0))
    additional_rate = max(0.0, _to_float(settings.get("additional_rate") or 0.0))
    fixed_cost_per_month = max(0.0, _to_float(settings.get("fixed_cost_per_month") or 0.0))

    months_out: list[dict[str, Any]] = []
    for period in periods:
        month_key = str(period["month_key"])
        wb_kpi = dict(monthly_raw.get(month_key, {}).get("wb") or _new_monthly_kpi())
        ozon_kpi = dict(monthly_raw.get(month_key, {}).get("ozon") or _new_monthly_kpi())
        wb_product_kpi = dict(product_monthly.get(month_key, {}).get("wb") or _new_monthly_kpi())
        ozon_product_kpi = dict(product_monthly.get(month_key, {}).get("ozon") or _new_monthly_kpi())
        _apply_monthly_fallback_from_product(wb_kpi, wb_product_kpi)
        _apply_monthly_fallback_from_product(ozon_kpi, ozon_product_kpi)

        if float(wb_kpi.get("acquiring") or 0.0) > 0 and float(wb_kpi.get("commission") or 0.0) > 0:
            wb_kpi["commission"] = float(round(max(0.0, float(wb_kpi.get("commission") or 0.0) - float(wb_kpi.get("acquiring") or 0.0)), 2))

        expense_breakdown = _calc_monthly_custom_expense_breakdown(
            expenses=expenses,
            date_from=period["date_from"],
            date_to=period["date_to"],
        )
        wb_turnover = float(wb_kpi.get("turnover") or 0.0)
        ozon_turnover = float(ozon_kpi.get("turnover") or 0.0)
        turnover_total = wb_turnover + ozon_turnover

        wb_weight = 0.5
        if turnover_total > 0:
            wb_weight = wb_turnover / turnover_total
        else:
            wb_activity = int(wb_kpi.get("orders") or 0) + int(wb_kpi.get("units") or 0) + int(wb_kpi.get("buyouts") or 0)
            ozon_activity = int(ozon_kpi.get("orders") or 0) + int(ozon_kpi.get("units") or 0) + int(ozon_kpi.get("buyouts") or 0)
            activity_total = wb_activity + ozon_activity
            if activity_total > 0:
                wb_weight = wb_activity / activity_total

        shared_expense_wb, shared_expense_ozon = _split_amount_by_share(float(expense_breakdown.get("all") or 0.0), wb_weight)
        dynamic_total = float(turnover_total) * additional_rate / 100.0
        dynamic_wb, dynamic_ozon = _split_amount_by_share(dynamic_total, wb_weight)
        fixed_wb, fixed_ozon = _split_amount_by_share(float(fixed_cost_per_month), wb_weight)

        wb_custom = float(expense_breakdown.get("wb") or 0.0) + shared_expense_wb + dynamic_wb + fixed_wb
        ozon_custom = float(expense_breakdown.get("ozon") or 0.0) + shared_expense_ozon + dynamic_ozon + fixed_ozon

        wb_kpi["custom_expenses"] = float(round(wb_custom, 2))
        ozon_kpi["custom_expenses"] = float(round(ozon_custom, 2))
        _finalize_monthly_kpi(wb_kpi, tax_rate=tax_rate, vat_rate=vat_rate)
        _finalize_monthly_kpi(ozon_kpi, tax_rate=tax_rate, vat_rate=vat_rate)

        total_kpi = _sum_monthly_kpi(wb_kpi, ozon_kpi)
        explicit_custom_total = float(expense_breakdown.get("all") or 0.0) + float(expense_breakdown.get("wb") or 0.0) + float(expense_breakdown.get("ozon") or 0.0)
        total_kpi["custom_expenses"] = float(round(explicit_custom_total + dynamic_total + float(fixed_cost_per_month), 2))
        _finalize_monthly_kpi(total_kpi, tax_rate=tax_rate, vat_rate=vat_rate)

        months_out.append(
            {
                "month_key": month_key,
                "label": str(period.get("label") or month_key),
                "date_from": period["date_from"].isoformat(),
                "date_to": period["date_to"].isoformat(),
                "wb": wb_kpi,
                "ozon": ozon_kpi,
                "total": total_kpi,
            }
        )

    normalized_warnings = _normalize_accounting_warnings([str(x or "") for x in warnings if str(x or "").strip()])
    return {
        "months": months_out,
        "meta": {
            "source": "live",
            "partial": bool(normalized_warnings),
            "warnings": normalized_warnings,
            "generated_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        },
    }


def _build_month_periods(months: int, *, tzinfo: ZoneInfo) -> list[dict[str, Any]]:
    today = datetime.now(tzinfo).date()
    start = date(today.year, today.month, 1)
    out: list[dict[str, Any]] = []
    for idx in range(max(1, int(months or 1))):
        month_start = _shift_month_start(start, -idx)
        month_end = _month_end_date(month_start)
        key = f"{month_start.year:04d}-{month_start.month:02d}"
        out.append(
            {
                "month_key": key,
                "label": _format_month_label(month_start),
                "date_from": month_start,
                "date_to": month_end,
            }
        )
    return out


def _format_month_label(month_start: date) -> str:
    month_num = int(month_start.month)
    if 1 <= month_num <= 12:
        return f"{RU_MONTH_NAMES[month_num]} {month_start.year}"
    return f"{month_start.year:04d}-{month_num:02d}"

def _shift_month_start(month_start: date, month_delta: int) -> date:
    current = (month_start.year * 12 + (month_start.month - 1)) + int(month_delta)
    year = current // 12
    month = (current % 12) + 1
    return date(year, month, 1)


def _month_end_date(month_start: date) -> date:
    next_month = _shift_month_start(month_start, 1)
    return next_month - timedelta(days=1)


def _new_monthly_kpi() -> dict[str, Any]:
    return {
        "turnover": 0.0,
        "orders": 0,
        "units": 0,
        "buyouts": 0,
        "cogs": 0.0,
        "commission": 0.0,
        "acquiring": 0.0,
        "logistics": 0.0,
        "storage": 0.0,
        "penalties": 0.0,
        "ad_spend": 0.0,
        "marketplace_expense": 0.0,
        "custom_expenses": 0.0,
        "other_expenses": 0.0,
        "tax_amount": 0.0,
        "vat_amount": 0.0,
        "tax_total": 0.0,
        "operating_profit": 0.0,
        "net_profit": 0.0,
        "margin": 0.0,
    }


def _sum_monthly_kpi(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    out = _new_monthly_kpi()
    for key in ("orders", "units", "buyouts"):
        out[key] = int(_to_int(left.get(key) or 0)) + int(_to_int(right.get(key) or 0))
    for key in (
        "turnover",
        "cogs",
        "commission",
        "acquiring",
        "logistics",
        "storage",
        "penalties",
        "ad_spend",
        "other_expenses",
    ):
        out[key] = float(round(_to_float(left.get(key) or 0.0) + _to_float(right.get(key) or 0.0), 2))
    return out


def _apply_monthly_fallback_from_product(target: dict[str, Any], source: dict[str, Any]) -> None:
    if not isinstance(target, dict) or not isinstance(source, dict):
        return

    for key in ("turnover", "commission", "acquiring", "logistics", "storage", "penalties", "ad_spend", "other_expenses", "cogs"):
        src_value = max(0.0, _to_float(source.get(key) or 0.0))
        if src_value <= 0:
            continue
        dst_value = _to_float(target.get(key) or 0.0)
        if dst_value <= 0:
            target[key] = float(round(src_value, 2))

    src_units = max(0, int(_to_int(source.get("units") or 0)))
    src_buyouts = max(0, int(_to_int(source.get("buyouts") or src_units)))
    src_orders = max(0, int(_to_int(source.get("orders") or 0)))

    if int(_to_int(target.get("units") or 0)) <= 0 and src_units > 0:
        target["units"] = src_units
    if int(_to_int(target.get("buyouts") or 0)) <= 0 and src_buyouts > 0:
        target["buyouts"] = src_buyouts
    if int(_to_int(target.get("orders") or 0)) <= 0:
        fallback_orders = src_orders if src_orders > 0 else src_units
        if fallback_orders > 0:
            target["orders"] = fallback_orders

def _finalize_monthly_kpi(kpi: dict[str, Any], *, tax_rate: float, vat_rate: float) -> None:
    turnover = float(round(_to_float(kpi.get("turnover") or 0.0), 2))
    cogs = float(round(_to_float(kpi.get("cogs") or 0.0), 2))
    commission = float(round(_to_float(kpi.get("commission") or 0.0), 2))
    acquiring = float(round(_to_float(kpi.get("acquiring") or 0.0), 2))
    logistics = float(round(_to_float(kpi.get("logistics") or 0.0), 2))
    storage = float(round(_to_float(kpi.get("storage") or 0.0), 2))
    penalties = float(round(_to_float(kpi.get("penalties") or 0.0), 2))
    ad_spend = float(round(_to_float(kpi.get("ad_spend") or 0.0), 2))
    other_expenses = float(round(_to_float(kpi.get("other_expenses") or 0.0), 2))
    custom_expenses = float(round(_to_float(kpi.get("custom_expenses") or 0.0), 2))

    marketplace_expense = float(round(commission + acquiring + logistics + storage + penalties + ad_spend + other_expenses, 2))
    operating_profit = float(round(turnover - cogs - marketplace_expense - custom_expenses, 2))
    vat_amount = float(round(max(0.0, turnover) * max(0.0, vat_rate) / 100.0, 2))
    tax_amount = float(round(max(0.0, operating_profit) * max(0.0, tax_rate) / 100.0, 2))
    tax_total = float(round(vat_amount + tax_amount, 2))
    net_profit = float(round(operating_profit - tax_total, 2))
    margin = round((net_profit / turnover) * 100.0, 2) if abs(turnover) > 1e-9 else 0.0

    kpi["turnover"] = turnover
    kpi["orders"] = int(_to_int(kpi.get("orders") or 0))
    kpi["units"] = int(_to_int(kpi.get("units") or 0))
    kpi["buyouts"] = int(_to_int(kpi.get("buyouts") or 0))
    kpi["cogs"] = cogs
    kpi["commission"] = commission
    kpi["acquiring"] = acquiring
    kpi["logistics"] = logistics
    kpi["storage"] = storage
    kpi["penalties"] = penalties
    kpi["ad_spend"] = ad_spend
    kpi["other_expenses"] = other_expenses
    kpi["custom_expenses"] = custom_expenses
    kpi["marketplace_expense"] = marketplace_expense
    kpi["operating_profit"] = operating_profit
    kpi["vat_amount"] = vat_amount
    kpi["tax_amount"] = tax_amount
    kpi["tax_total"] = tax_total
    kpi["net_profit"] = net_profit
    kpi["margin"] = margin


def _build_purchase_price_index(products: list[dict[str, Any]]) -> dict[tuple[str, str], float]:
    index: dict[tuple[str, str], float] = {}
    for row in products or []:
        if not isinstance(row, dict):
            continue
        mp = str(row.get("marketplace") or "").strip().lower()
        if mp not in {"wb", "ozon"}:
            continue
        price = max(0.0, float(round(_to_float(row.get("purchase_price") or 0.0), 2)))
        article = _norm_key(row.get("article"))
        external_id = _norm_key(row.get("external_id"))
        barcode = _norm_key(row.get("barcode"))
        for key in (article, external_id, barcode):
            if key:
                index[(mp, key)] = price
    return index


def _resolve_purchase_price(
    index: dict[tuple[str, str], float],
    *,
    marketplace: str,
    article: str,
    external_id: str,
    barcode: str = "",
) -> float:
    mp = str(marketplace or "").strip().lower()
    for raw in (article, external_id, barcode):
        key = _norm_key(raw)
        if not key:
            continue
        value = index.get((mp, key))
        if value is None:
            continue
        return max(0.0, float(round(_to_float(value), 2)))
    return 0.0


def _split_amount_by_share(total: float, primary_share: float) -> tuple[float, float]:
    value = float(round(_to_float(total), 2))
    if abs(value) < 1e-9:
        return 0.0, 0.0
    share = min(1.0, max(0.0, float(primary_share or 0.0)))
    primary = float(round(value * share, 2))
    secondary = float(round(value - primary, 2))
    return primary, secondary


def _calc_monthly_custom_expense_breakdown(
    *,
    expenses: list[dict[str, Any]],
    date_from: date,
    date_to: date,
) -> dict[str, float]:
    totals = {"all": 0.0, "wb": 0.0, "ozon": 0.0}
    for row in expenses or []:
        if not row or not bool(row.get("is_active", True)):
            continue
        row_market = str(row.get("marketplace") or "all").strip().lower()
        if row_market not in {"all", "wb", "ozon"}:
            row_market = "all"
        totals[row_market] = float(
            round(
                float(totals.get(row_market) or 0.0)
                + _expense_amount_for_period(row=row, date_from=date_from, date_to=date_to),
                2,
            )
        )
    return totals

def _calc_monthly_custom_expenses(
    *,
    expenses: list[dict[str, Any]],
    date_from: date,
    date_to: date,
    marketplace: str,
) -> float:
    selected_market = str(marketplace or "all").strip().lower()
    if selected_market not in {"all", "wb", "ozon"}:
        selected_market = "all"
    total = 0.0
    for row in expenses or []:
        if not row or not bool(row.get("is_active", True)):
            continue
        row_market = str(row.get("marketplace") or "all").strip().lower()
        if row_market not in {"all", "wb", "ozon"}:
            row_market = "all"
        if selected_market in {"wb", "ozon"} and row_market not in {"all", selected_market}:
            continue
        total += _expense_amount_for_period(row=row, date_from=date_from, date_to=date_to)
    return float(round(total, 2))

def _normalize_accounting_warnings(warnings: list[Any]) -> list[str]:
    out: list[str] = []
    for raw in warnings or []:
        text = str(raw or "").strip()
        if not text:
            continue
        low = text.lower()
        if "429" in low and "wb" in low:
            out.append("WB API is rate limited (429); showing available partial data.")
            continue
        if "429" in low and "ozon" in low:
            out.append("Ozon API is rate limited (429); showing available partial data.")
            continue
        if "bad_json" in low and "wb" in low:
            out.append("WB API returned unstable JSON; partial statistics are applied.")
            continue
        if ("wb finance api" in low and "unavailable" in low) and ("wb sales api" in low or "bad_json" in low):
            out.append("WB API returned unstable data; partial statistics are applied.")
            continue
        if ("ads api" in low and "unavailable" in low) or ("ad spend" in low and "unavailable" in low):
            out.append("Ads spend is temporarily unavailable from API. Other metrics are calculated.")
            continue
        if "ozon" in low and ("unexpected format" in low or "bad_json" in low or "invalid" in low):
            out.append("Ozon accounting API returned a non-standard response; available data is shown.")
            continue
        if "api unavailable" in low:
            out.append(text)
            continue
        if "unauthorized" in low or "forbidden" in low:
            out.append("Please verify WB/Ozon API keys.")
            continue
        out.append(text)
    return list(dict.fromkeys(out))


def _expense_amount_for_period(*, row: dict[str, Any], date_from: date, date_to: date) -> float:
    amount = max(0.0, _to_float(row.get("amount") or 0.0))
    if amount <= 0:
        return 0.0
    recurrence = str(row.get("recurrence") or "monthly").strip().lower()
    start_date = _parse_any_date(row.get("start_date")) or date_from
    end_date = _parse_any_date(row.get("end_date")) or date_to
    left = max(date_from, start_date)
    right = min(date_to, end_date)
    if left > right:
        return 0.0
    days = (right - left).days + 1
    if recurrence in {"once", "one_time", "single"}:
        return amount if left <= start_date <= right else 0.0
    if recurrence == "daily":
        return float(round(amount * days, 2))
    if recurrence == "weekly":
        weeks = math.ceil(days / 7)
        return float(round(amount * weeks, 2))
    if recurrence == "quarterly":
        months = _month_span(left, right)
        quarters = math.ceil(months / 3)
        return float(round(amount * quarters, 2))
    if recurrence == "yearly":
        years = max(1, math.ceil(_month_span(left, right) / 12))
        return float(round(amount * years, 2))
    months = _month_span(left, right)
    return float(round(amount * months, 2))


def _monthly_amount_for_period(*, amount: float, date_from: date, date_to: date) -> float:
    value = max(0.0, _to_float(amount))
    if value <= 0:
        return 0.0
    months = _month_span(date_from, date_to)
    return float(round(value * months, 2))


def _month_span(left: date, right: date) -> int:
    if left > right:
        left, right = right, left
    months = (right.year - left.year) * 12 + (right.month - left.month) + 1
    return max(1, months)


def _request_wb_list(*, api_key: str, endpoint: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]] | None, str]:
    token = (api_key or "").strip()
    if not token:
        return None, "ключ не задан"
    for auth_value in (token, f"Bearer {token}"):
        headers = {"Authorization": auth_value}
        for attempt in range(5):
            response = None
            try:
                with httpx.Client(timeout=WB_TIMEOUT, follow_redirects=True) as client:
                    response = client.get(endpoint, headers=headers, params=params)
            except Exception:
                response = None
            if response is None:
                if attempt < 4:
                    time.sleep(0.35 * (attempt + 1))
                continue
            if response.status_code in {401, 403}:
                break
            if response.status_code == 429:
                if attempt < 4:
                    time.sleep(_wb_retry_after_sec(response, attempt))
                    continue
                return None, "429"
            if response.status_code >= 400:
                return None, f"{response.status_code}"
            try:
                payload = response.json()
            except Exception:
                if attempt < 4:
                    time.sleep(0.35 * (attempt + 1))
                    continue
                return None, "bad_json"
            dict_rows = _extract_list_payload(payload)
            if dict_rows is not None:
                return dict_rows, "ok"
            if attempt < 4:
                time.sleep(0.25 * (attempt + 1))
                continue
            return None, "bad_format"
    return None, "unauthorized"


def _extract_list_payload(payload: Any) -> list[dict[str, Any]] | None:
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
    # WB can return retry hints in either Retry-After or X-Ratelimit headers.
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
        if not math.isfinite(value):
            continue
        if value <= 0:
            continue
        return max(0.8, min(45.0, value))
    return min(14.0, 0.85 * (attempt + 1))


def _parse_ozon_credentials(api_key: str) -> tuple[str, str] | None:
    raw = (api_key or "").strip()
    if ":" not in raw:
        return None
    left, right = raw.split(":", 1)
    if not left.strip() or not right.strip():
        return None
    return left.strip(), right.strip()


def _norm_key(value: Any) -> str:
    return str(value or "").strip().lower()


def _parse_any_date(value: Any) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
        return dt.date()
    except Exception:
        pass
    chunk = text[:10]
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%Y/%m/%d"):
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
        return int(float(str(value).replace(",", ".").strip()))
    except Exception:
        return 0
