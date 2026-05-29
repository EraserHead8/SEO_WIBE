from __future__ import annotations

import copy
from datetime import date, datetime
from pathlib import Path
import sys
import time
import types
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class _FakeTimeout:
    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs


_httpx = types.ModuleType("httpx")
_httpx.Timeout = _FakeTimeout
sys.modules.setdefault("httpx", _httpx)

_sales = types.ModuleType("app.services.sales")
_CURRENT_REPORT: dict = {}


def _fake_build_sales_report(**_kwargs):
    return copy.deepcopy(_CURRENT_REPORT)


_sales.build_sales_report = _fake_build_sales_report
sys.modules["app.services.sales"] = _sales

from app.services import accounting  # noqa: E402
from app.services.marketplace import _dedupe_photo_urls  # noqa: E402


def _assert_close(actual: float, expected: float, label: str) -> None:
    if abs(float(actual) - float(expected)) > 0.01:
        raise AssertionError(f"{label}: expected {expected}, got {actual}")


def _base_finance_row(article: str = "A-1", idx: int = 1) -> dict:
    return {
        "date": "2026-05-10",
        "marketplace": "wb",
        "article": article,
        "external_id": f"10{idx}",
        "name": f"Product {idx}",
        "sold_units": 2,
        "returns": 0,
        "revenue": 1000.0,
        "income": 1000.0,
        "expense": 160.0,
        "commission": 100.0,
        "acquiring": 10.0,
        "logistics": 50.0,
        "storage": 0.0,
        "deductions": 0.0,
        "acceptance": 0.0,
        "penalties": 0.0,
        "other_expense": 0.0,
        "ad_spend": 0.0,
    }


def _settings() -> dict:
    return {
        "vat_rate": 20.0,
        "tax_rate": 10.0,
        "additional_rate": 5.0,
        "fixed_cost_per_month": 50.0,
    }


def _expenses() -> list[dict]:
    return [
        {
            "marketplace": "all",
            "category": "office",
            "amount": 100.0,
            "recurrence": "monthly",
            "start_date": "2026-05-01",
            "end_date": "2026-05-31",
            "is_active": True,
        }
    ]


def _products(count: int = 1) -> list[dict]:
    return [
        {
            "marketplace": "wb",
            "article": f"A-{idx}",
            "external_id": f"10{idx}",
            "barcode": "",
            "name": f"Product {idx}",
            "purchase_price": 200.0,
        }
        for idx in range(1, count + 1)
    ]


def _patch_finance_rows(rows: list[dict]) -> None:
    accounting._fetch_wb_product_finance_rows = lambda **_kwargs: (copy.deepcopy(rows), [])
    accounting._fetch_ozon_product_finance_rows = lambda **_kwargs: ([], [])


def _set_sales_totals(revenue: float, *, rows: list[dict] | None = None) -> None:
    global _CURRENT_REPORT
    _CURRENT_REPORT = {
        "totals": {
            "orders": 2 if revenue else 0,
            "units": 2 if revenue else 0,
            "buyouts": 2 if revenue else 0,
            "returns": 0,
            "revenue": revenue,
            "commission": 0.0,
            "acquiring": 0.0,
            "logistics": 0.0,
            "storage": 0.0,
            "deductions": 0.0,
            "acceptance": 0.0,
            "penalties": 0.0,
            "other_expense": 0.0,
            "ad_spend": 0.0,
            "wb_revenue": revenue,
            "wb_orders": 2 if revenue else 0,
            "wb_units": 2 if revenue else 0,
            "wb_buyouts": 2 if revenue else 0,
            "wb_returns": 0,
        },
        "chart": [],
        "rows": copy.deepcopy(rows or []),
        "warnings": [],
    }


def test_photo_dedupe() -> None:
    ozon = _dedupe_photo_urls(
        [
            "https://cdn1.ozone.ru/s3/multimedia-a/wc50/image.jpg",
            "https://cdn1.ozone.ru/s3/multimedia-a/wc1000/image.jpg",
        ]
    )
    wb = _dedupe_photo_urls(
        [
            "https://basket-01.wbbasket.ru/vol1/part1/123/images/tm/1.webp",
            "https://basket-01.wbbasket.ru/vol1/part1/123/images/c516x688/1.webp",
            "https://basket-01.wbbasket.ru/vol1/part1/123/images/big/1.webp",
        ]
    )
    assert ozon == ["https://cdn1.ozone.ru/s3/multimedia-a/wc1000/image.jpg"]
    assert wb == ["https://basket-01.wbbasket.ru/vol1/part1/123/images/big/1.webp"]


def test_accounting_payload_math() -> None:
    row = _base_finance_row()
    _patch_finance_rows([row])
    _set_sales_totals(1000.0)
    payload = accounting.build_accounting_payload(
        marketplace="wb",
        date_from=date(2026, 5, 1),
        date_to=date(2026, 5, 31),
        wb_api_key="token",
        ozon_api_key="",
        products=_products(),
        expenses=_expenses(),
        settings=_settings(),
    )
    overview = payload["overview"]
    _assert_close(overview["revenue"], 1000.0, "revenue")
    _assert_close(overview["cogs"], 400.0, "cogs")
    _assert_close(overview["marketplace_expense"], 160.0, "marketplace expense")
    _assert_close(overview["operating_profit"], 340.0, "operating profit")
    _assert_close(overview["additional_cost"], 100.0, "additional cost")
    _assert_close(overview["vat_amount"], 200.0, "vat")
    _assert_close(overview["tax_amount"], 24.0, "tax")
    _assert_close(overview["net_profit"], 16.0, "net profit")
    _assert_close(payload["analysis_rows"][0]["net_profit"], 16.0, "row net profit")


def test_accounting_payload_falls_back_to_product_finance() -> None:
    row = _base_finance_row()
    _patch_finance_rows([row])
    _set_sales_totals(0.0)
    payload = accounting.build_accounting_payload(
        marketplace="wb",
        date_from=date(2026, 5, 1),
        date_to=date(2026, 5, 31),
        wb_api_key="token",
        ozon_api_key="",
        products=_products(),
        expenses=_expenses(),
        settings=_settings(),
    )
    overview = payload["overview"]
    _assert_close(overview["revenue"], 1000.0, "fallback revenue")
    _assert_close(overview["additional_cost"], 100.0, "fallback additional cost")
    _assert_close(overview["vat_amount"], 200.0, "fallback vat")
    _assert_close(overview["net_profit"], 16.0, "fallback net profit")
    if int(overview["buyouts"]) != 2:
        raise AssertionError(f"fallback buyouts expected 2, got {overview['buyouts']}")


def test_monthly_summary_product_fallback() -> None:
    today = datetime.now(ZoneInfo("Europe/Moscow")).date()
    row = _base_finance_row()
    row["date"] = today.replace(day=10 if today.day >= 10 else 1).isoformat()
    _patch_finance_rows([row])
    _set_sales_totals(0.0, rows=[])
    payload = accounting.build_accounting_monthly_summary(
        months=1,
        tz_name="Europe/Moscow",
        wb_api_key="token",
        ozon_api_key="",
        products=_products(),
        expenses=[],
        settings={"vat_rate": 0, "tax_rate": 0, "additional_rate": 0, "fixed_cost_per_month": 0},
    )
    total = payload["months"][0]["total"]
    _assert_close(total["turnover"], 1000.0, "monthly turnover")
    _assert_close(total["cogs"], 400.0, "monthly cogs")
    _assert_close(total["marketplace_expense"], 160.0, "monthly marketplace expense")
    _assert_close(total["net_profit"], 440.0, "monthly net profit")


def test_accounting_payload_speed() -> None:
    count = 5000
    rows = [_base_finance_row(article=f"A-{idx}", idx=idx) for idx in range(1, count + 1)]
    _patch_finance_rows(rows)
    _set_sales_totals(float(count * 1000))
    started = time.perf_counter()
    payload = accounting.build_accounting_payload(
        marketplace="wb",
        date_from=date(2026, 5, 1),
        date_to=date(2026, 5, 31),
        wb_api_key="token",
        ozon_api_key="",
        products=_products(count),
        expenses=[],
        settings={"vat_rate": 0, "tax_rate": 0, "additional_rate": 0, "fixed_cost_per_month": 0},
    )
    elapsed = time.perf_counter() - started
    if len(payload["analysis_rows"]) != count:
        raise AssertionError(f"expected {count} rows, got {len(payload['analysis_rows'])}")
    if elapsed > 2.5:
        raise AssertionError(f"accounting payload is too slow: {elapsed:.3f}s for {count} rows")
    print(f"Performance: {count} rows in {elapsed:.3f}s")


def main() -> int:
    tests = [
        test_photo_dedupe,
        test_accounting_payload_math,
        test_accounting_payload_falls_back_to_product_finance,
        test_monthly_summary_product_fallback,
        test_accounting_payload_speed,
    ]
    for test in tests:
        test()
        print(f"OK {test.__name__}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
