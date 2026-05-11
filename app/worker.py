from __future__ import annotations

import json
import signal
import time
from datetime import date, datetime
import hashlib
from typing import Any

from sqlalchemy import desc, select

from app.db import SessionLocal
from app.models import ApiCredential, AuditLog, FeedbackAutoReplyLog, SystemSetting, UserAiSettings
from app.services.ads_cache import sync_wb_campaign_snapshots
from app.services.market_cache import build_market_cache_key, get_or_refresh_market_cache
from app.services.sales import build_sales_report
from app.services.task_queue import compact_queue, dequeue_task, queue_available, queue_depth
from app.services.wb_bidder import run_bidder_rules
from app.services.wb_modules import (
    fetch_ozon_ads_campaigns,
    fetch_wb_campaigns,
    generate_review_reply,
    post_ozon_review_reply,
    post_wb_review_reply,
    sanitize_marketplace_reply_text,
    wait_wb_feedback_auto_reply_slot,
    wb_feedback_auto_reply_wait_left_sec,
)


_RUNNING = True
_IDLE_SLEEP_SEC = 2
_TASK_MAX_AGE_SEC = {
    "warm_sales_cache": 6 * 60,
    "warm_wb_campaigns": 6 * 60,
    "warm_ozon_campaigns": 6 * 60,
    "sync_wb_snapshots": 12 * 60,
    "wb_bidder_run": 5 * 60,
    "feedback_auto_replies": 30 * 60,
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


def _feedback_auto_reply_kill_switch_enabled(db, user_id: int) -> bool:
    row = db.scalar(
        select(SystemSetting).where(SystemSetting.key == f"feedback_auto_reply_kill_switch:{int(user_id)}")
    )
    raw = str(row.value or "").strip() if row else ""
    if not raw:
        return False
    try:
        payload = json.loads(raw)
    except Exception:
        return raw.lower() in {"1", "true", "yes", "on"}
    return bool(payload.get("enabled")) if isinstance(payload, dict) else False


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
        sync_wb_campaign_snapshots(db, user_id, wb_key, background=True)
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


def _handle_feedback_auto_replies(payload: dict[str, Any]) -> None:
    user_id = int(payload.get("user_id") or 0)
    if user_id <= 0:
        return
    raw_candidates = payload.get("candidates")
    if not isinstance(raw_candidates, list):
        return
    try:
        limit = int(payload.get("limit") or 20)
    except Exception:
        limit = 20
    limit = max(1, min(limit, 50))
    candidates = [x for x in raw_candidates if isinstance(x, dict)][:limit]
    if not candidates:
        return

    db = SessionLocal()
    try:
        wb_key = _active_key(db, user_id, "wb")
        ozon_key = _active_key(db, user_id, "ozon")
        settings_row = db.scalar(select(UserAiSettings).where(UserAiSettings.user_id == user_id))
        prompt = str(settings_row.prompt or "").strip() if settings_row else ""
        stop_marketplaces: set[str] = set()

        for candidate in candidates:
            marketplace = str(candidate.get("marketplace") or "").strip().lower()
            item_id = str(candidate.get("item_external_id") or "").strip()
            if marketplace not in {"wb", "ozon"} or not item_id:
                continue
            log = db.scalar(
                select(FeedbackAutoReplyLog).where(
                    FeedbackAutoReplyLog.user_id == user_id,
                    FeedbackAutoReplyLog.marketplace == marketplace,
                    FeedbackAutoReplyLog.item_type == "review",
                    FeedbackAutoReplyLog.item_external_id == item_id,
                )
            )
            if not log:
                log = FeedbackAutoReplyLog(
                    user_id=user_id,
                    marketplace=marketplace,
                    item_type="review",
                    item_external_id=item_id,
                    rating=int(candidate.get("rating") or 0),
                    status="planned",
                    payload_json=json.dumps(candidate, ensure_ascii=False),
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(log)
                db.flush()
            if str(log.status or "").strip().lower() == "sent":
                continue
            if _feedback_auto_reply_kill_switch_enabled(db, user_id):
                log.status = "skipped"
                log.error = "Automatic feedback replies stopped by emergency switch"
                log.updated_at = datetime.utcnow()
                db.add(log)
                db.commit()
                continue
            if marketplace in stop_marketplaces:
                log.status = "queued"
                log.error = "Queued because marketplace rate limit was hit earlier in this run"
                log.updated_at = datetime.utcnow()
                db.add(log)
                db.commit()
                continue

            api_key = wb_key if marketplace == "wb" else ozon_key
            if not api_key:
                log.status = "error"
                log.error = f"{marketplace.upper()} API key is missing"
                log.updated_at = datetime.utcnow()
                db.add(log)
                db.commit()
                continue

            try:
                log.status = "sending"
                log.error = ""
                log.updated_at = datetime.utcnow()
                db.add(log)
                db.commit()

                manual_reply = bool(candidate.get("manual_reply")) or bool(str(candidate.get("reply_text") or log.reply_text or "").strip())
                if manual_reply:
                    reply = sanitize_marketplace_reply_text(candidate.get("reply_text") or log.reply_text)
                else:
                    reply = generate_review_reply(
                        review_text=str(candidate.get("text") or ""),
                        product_name=str(candidate.get("product") or ""),
                        stars=int(candidate.get("rating") or 0),
                        prompt=prompt,
                        reviewer_name=str(candidate.get("reviewer_name") or ""),
                        marketplace=marketplace,
                        content_kind="review",
                        previous_replies=[
                            str(text or "")
                            for text in db.scalars(
                                select(FeedbackAutoReplyLog.reply_text)
                                .where(
                                    FeedbackAutoReplyLog.user_id == user_id,
                                    FeedbackAutoReplyLog.marketplace == marketplace,
                                    FeedbackAutoReplyLog.status == "sent",
                                    FeedbackAutoReplyLog.reply_text != "",
                                )
                                .order_by(desc(FeedbackAutoReplyLog.sent_at), desc(FeedbackAutoReplyLog.id))
                                .limit(8)
                            ).all()
                        ],
                    )
                reply = sanitize_marketplace_reply_text(reply)
                if len(reply) < 2:
                    raise RuntimeError("Generated reply is empty")
                log.reply_text = reply[:3000]
                log.updated_at = datetime.utcnow()
                db.add(log)
                db.commit()

                if marketplace == "wb":
                    wait_left = wb_feedback_auto_reply_wait_left_sec(api_key)
                    if wait_left > 5:
                        wait_minutes = max(1, int((wait_left + 59) // 60))
                        log.status = "queued"
                        log.error = f"Waiting for WB rate-limit window, about {wait_minutes} min left"
                        log.updated_at = datetime.utcnow()
                        db.add(log)
                        db.commit()
                        wait_wb_feedback_auto_reply_slot(api_key)
                        log.status = "sending"
                        log.error = ""
                        log.updated_at = datetime.utcnow()
                        db.add(log)
                        db.commit()
                    ok, message = post_wb_review_reply(api_key, item_id, reply)
                else:
                    ok, message = post_ozon_review_reply(api_key, item_id, reply)
                if not ok:
                    msg = str(message or "Marketplace API rejected reply")[:1000]
                    if "429" in msg:
                        stop_marketplaces.add(marketplace)
                    raise RuntimeError(msg)

                log.status = "sent"
                log.reply_text = reply[:3000]
                log.error = ""
                log.sent_at = datetime.utcnow()
                log.updated_at = datetime.utcnow()
                db.add(
                    AuditLog(
                        user_id=user_id,
                        action=f"{marketplace}_review_auto_reply_sent",
                        details=json.dumps({"review_id": item_id, "rating": int(candidate.get("rating") or 0)}, ensure_ascii=False)[:1200],
                        module_code="wb_reviews_ai",
                        entity_type="review",
                        entity_id=item_id[:120],
                        status="ok",
                    )
                )
                db.add(log)
                db.commit()
            except Exception as exc:
                is_rate_limited = "429" in str(exc or "") or "too many requests" in str(exc or "").lower()
                log.status = "queued" if is_rate_limited else "error"
                log.error = str(exc or "auto reply failed")[:1000]
                log.updated_at = datetime.utcnow()
                db.add(
                    AuditLog(
                        user_id=user_id,
                        action=f"{marketplace}_review_auto_reply_failed",
                        details=json.dumps({"review_id": item_id, "error": log.error}, ensure_ascii=False)[:1200],
                        module_code="wb_reviews_ai",
                        entity_type="review",
                        entity_id=item_id[:120],
                        status="error",
                    )
                )
                db.add(log)
                db.commit()
            time.sleep(1.2 if marketplace == "wb" else 0.7)
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
    if depth > 400 and task_type in {"warm_sales_cache", "warm_wb_campaigns", "warm_ozon_campaigns"} and age_sec > 20:
        return True
    if depth > 600 and task_type in {"warm_sales_cache", "warm_wb_campaigns", "warm_ozon_campaigns"} and age_sec > 45:
        return True
    # Snapshot/bidder tasks are useful only when fresh; when queue is deep keep latest jobs.
    if depth > 700 and task_type in {"sync_wb_snapshots", "wb_bidder_run"} and age_sec > 60:
        return True
    if depth > 900 and task_type == "sync_wb_snapshots" and age_sec > 75:
        return True
    if depth > 1100 and task_type in {"sync_wb_snapshots", "wb_bidder_run"} and age_sec > 25:
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
    if task_type == "feedback_auto_replies":
        _handle_feedback_auto_replies(payload)
        return


def run_worker() -> None:
    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)
    while _RUNNING:
        if not queue_available():
            time.sleep(_IDLE_SLEEP_SEC)
            continue
        if queue_depth() > 80:
            compact_queue(max_age_sec=20 * 60)
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
