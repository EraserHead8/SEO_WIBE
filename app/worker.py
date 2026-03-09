from __future__ import annotations

import signal
import time
from datetime import date
import hashlib
from typing import Any

from sqlalchemy import select

from app.db import SessionLocal
from app.models import ApiCredential
from app.services.ads_cache import sync_wb_campaign_snapshots
from app.services.market_cache import build_market_cache_key, get_or_refresh_market_cache
from app.services.sales import build_sales_report
from app.services.task_queue import dequeue_task, queue_available, queue_depth
from app.services.wb_bidder import run_bidder_rules
from app.services.wb_modules import fetch_ozon_ads_campaigns, fetch_wb_campaigns


_RUNNING = True
_IDLE_SLEEP_SEC = 2
_TASK_MAX_AGE_SEC = {
    "warm_sales_cache": 6 * 60,
    "warm_wb_campaigns": 6 * 60,
    "warm_ozon_campaigns": 6 * 60,
    "sync_wb_snapshots": 12 * 60,
    "wb_bidder_run": 5 * 60,
}
_MARKET_CACHE_TTL_SEC = {
    "sales_stats": 120,
    "wb_ads": 120,
}


def _shutdown(*_args) -> None:
    global _RUNNING
    _RUNNING = False


def _secret_revision(*values: str) -> str:
    raw = "|".join(str(v or "").strip() for v in values)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]


def _market_cache_ttl(module_code: str) -> int:
    safe_module = str(module_code or "").strip()
    return max(30, min(120, int(_MARKET_CACHE_TTL_SEC.get(safe_module, 90))))


def _active_key(db, user_id: int, marketplace: str) -> str:
    key = db.scalar(
        select(ApiCredential.api_key).where(
            ApiCredential.user_id == int(user_id),
            ApiCredential.marketplace == str(marketplace or "").strip().lower(),
            ApiCredential.active.is_(True),
        )
    )
    return str(key or "").strip()


def _handle_sync_wb_snapshots(payload: dict[str, Any]) -> None:
    user_id = int(payload.get("user_id") or 0)
    if user_id <= 0:
        return
    db = SessionLocal()
    try:
        wb_key = _active_key(db, user_id, "wb")
        if not wb_key:
            return
        sync_wb_campaign_snapshots(db, user_id, wb_key)
    finally:
        db.close()


def _handle_warm_sales_cache(payload: dict[str, Any]) -> None:
    user_id = int(payload.get("user_id") or 0)
    if user_id <= 0:
        return
    selected_market = str(payload.get("marketplace") or "all").strip().lower()
    if selected_market not in {"all", "wb", "ozon"}:
        selected_market = "all"
    date_from_raw = str(payload.get("date_from") or "").strip()
    date_to_raw = str(payload.get("date_to") or "").strip()
    granularity = str(payload.get("granularity") or "auto").strip().lower()
    if granularity not in {"auto", "hour", "day"}:
        granularity = "auto"
    tz_name = str(payload.get("tz") or "UTC").strip() or "UTC"
    today = date.today()
    left = _parse_iso_date(date_from_raw) or today
    right = _parse_iso_date(date_to_raw) or left
    if left > right:
        left, right = right, left

    db = SessionLocal()
    try:
        wb_key = _active_key(db, user_id, "wb")
        ozon_key = _active_key(db, user_id, "ozon")
        key_rev = _secret_revision(wb_key, ozon_key)
        cache_key = build_market_cache_key(
            {
                "marketplace": selected_market,
                "date_from": left.isoformat(),
                "date_to": right.isoformat(),
                "granularity": granularity,
                "tz": tz_name,
                "key_rev": key_rev,
            }
        )
        get_or_refresh_market_cache(
            db,
            user_id=int(user_id),
            module_code="sales_stats",
            marketplace=selected_market,
            cache_key=cache_key,
            ttl_sec=_market_cache_ttl("sales_stats"),
            fetcher=lambda: build_sales_report(
                marketplace=selected_market,
                date_from=left,
                date_to=right,
                wb_api_key=wb_key,
                ozon_api_key=ozon_key,
                granularity=granularity,
                timezone=tz_name,
            ),
            stale_if_error_sec=45 * 60,
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _handle_warm_wb_campaigns(payload: dict[str, Any]) -> None:
    user_id = int(payload.get("user_id") or 0)
    if user_id <= 0:
        return
    db = SessionLocal()
    try:
        wb_key = _active_key(db, user_id, "wb")
        if not wb_key:
            return
        cache_key = build_market_cache_key(
            {"kind": "wb_campaigns_base", "key_rev": _secret_revision(wb_key)}
        )
        get_or_refresh_market_cache(
            db,
            user_id=int(user_id),
            module_code="wb_ads",
            marketplace="wb",
            cache_key=cache_key,
            ttl_sec=_market_cache_ttl("wb_ads"),
            fetcher=lambda: fetch_wb_campaigns(wb_key, enrich=False),
            stale_if_error_sec=30 * 60,
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _handle_warm_ozon_campaigns(payload: dict[str, Any]) -> None:
    user_id = int(payload.get("user_id") or 0)
    if user_id <= 0:
        return
    db = SessionLocal()
    try:
        ozon_key = _active_key(db, user_id, "ozon")
        if not ozon_key:
            return
        cache_key = build_market_cache_key(
            {"kind": "ozon_campaigns", "key_rev": _secret_revision(ozon_key)}
        )
        get_or_refresh_market_cache(
            db,
            user_id=int(user_id),
            module_code="wb_ads",
            marketplace="ozon",
            cache_key=cache_key,
            ttl_sec=_market_cache_ttl("wb_ads"),
            fetcher=lambda: fetch_ozon_ads_campaigns(ozon_key),
            stale_if_error_sec=30 * 60,
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _handle_wb_bidder_run(payload: dict[str, Any]) -> None:
    user_id = int(payload.get("user_id") or 0)
    if user_id <= 0:
        return
    raw_ids = payload.get("rule_ids")
    rule_ids = [int(x) for x in raw_ids] if isinstance(raw_ids, list) else []
    force = bool(payload.get("force"))
    db = SessionLocal()
    try:
        wb_key = _active_key(db, user_id, "wb")
        if not wb_key:
            return
        run_bidder_rules(
            db,
            user_id=int(user_id),
            wb_api_key=wb_key,
            rule_ids=rule_ids,
            force=force,
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _parse_iso_date(raw: str) -> date | None:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except Exception:
        return None


def _task_age_sec(task: dict[str, Any]) -> int:
    queued_at = float(task.get("queued_at") or 0.0)
    if queued_at <= 0:
        return 0
    return max(0, int(time.time() - queued_at))


def _should_drop_task(task: dict[str, Any]) -> bool:
    task_type = str(task.get("type") or "").strip().lower()
    if not task_type:
        return True
    age_sec = _task_age_sec(task)
    max_age = int(_TASK_MAX_AGE_SEC.get(task_type, 0) or 0)
    if max_age > 0 and age_sec > max_age:
        return True
    depth = max(0, int(queue_depth() or 0))
    # Keep worker responsive under burst load: stale warmup jobs are safe to drop.
    if depth > 600 and task_type in {"warm_sales_cache", "warm_wb_campaigns", "warm_ozon_campaigns"} and age_sec > 45:
        return True
    if depth > 900 and task_type == "sync_wb_snapshots" and age_sec > 75:
        return True
    return False


def process_task(task: dict[str, Any]) -> None:
    task_type = str(task.get("type") or "").strip().lower()
    payload = task.get("payload") if isinstance(task.get("payload"), dict) else {}
    if task_type == "sync_wb_snapshots":
        _handle_sync_wb_snapshots(payload)
        return
    if task_type == "warm_sales_cache":
        _handle_warm_sales_cache(payload)
        return
    if task_type == "warm_wb_campaigns":
        _handle_warm_wb_campaigns(payload)
        return
    if task_type == "warm_ozon_campaigns":
        _handle_warm_ozon_campaigns(payload)
        return
    if task_type == "wb_bidder_run":
        _handle_wb_bidder_run(payload)
        return


def run_worker() -> None:
    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)
    while _RUNNING:
        if not queue_available():
            time.sleep(_IDLE_SLEEP_SEC)
            continue
        task = dequeue_task(timeout_sec=10)
        if not task:
            continue
        if _should_drop_task(task):
            continue
        try:
            process_task(task)
        except Exception:
            # Worker should stay alive on malformed tasks.
            continue


if __name__ == "__main__":
    run_worker()
