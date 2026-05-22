from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ApiCredential, ModuleAccess, User, WbAdsCampaignSnapshot
from app.services.wb_modules import (
    fetch_wb_campaign_stats_bulk,
    fetch_wb_campaign_summaries,
    fetch_wb_campaigns,
)


WB_ADS_SNAPSHOT_TTL_SEC = 55 * 60
_WB_SYNC_LOCK: dict[int, float] = {}


def get_wb_snapshot_rows(db: Session, user_id: int) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(WbAdsCampaignSnapshot)
        .where(
            WbAdsCampaignSnapshot.user_id == user_id,
            WbAdsCampaignSnapshot.is_deleted.is_(False),
        )
        .order_by(WbAdsCampaignSnapshot.campaign_id.desc())
    ).all()
    out: list[dict[str, Any]] = []
    for row in rows:
        payload = _safe_json_loads(row.payload_json)
        if isinstance(payload, dict):
            out.append(payload)
    return out


def is_wb_snapshot_stale(db: Session, user_id: int) -> bool:
    return bool(get_wb_snapshot_meta(db, user_id).get("stale"))


def get_wb_snapshot_meta(db: Session, user_id: int) -> dict[str, Any]:
    latest = db.scalar(
        select(WbAdsCampaignSnapshot)
        .where(WbAdsCampaignSnapshot.user_id == user_id)
        .order_by(WbAdsCampaignSnapshot.synced_at.desc(), WbAdsCampaignSnapshot.id.desc())
    )
    if not latest or not latest.synced_at:
        return {"stale": True, "age_sec": None, "synced_at": ""}
    age_sec = max(0, int((datetime.utcnow() - latest.synced_at).total_seconds()))
    return {
        "stale": age_sec > WB_ADS_SNAPSHOT_TTL_SEC,
        "age_sec": age_sec,
        "synced_at": latest.synced_at.isoformat(),
        "ttl_sec": WB_ADS_SNAPSHOT_TTL_SEC,
    }


def sync_wb_campaign_snapshots(
    db: Session,
    user_id: int,
    wb_api_key: str,
    *,
    background: bool = False,
) -> dict[str, Any]:
    if not (wb_api_key or "").strip():
        return {"ok": False, "count": 0, "error": "WB API key is empty"}
    now = time.monotonic()
    lock_until = _WB_SYNC_LOCK.get(user_id, 0.0)
    if now < lock_until:
        return {"ok": True, "count": len(get_wb_snapshot_rows(db, user_id)), "throttled": True}
    _WB_SYNC_LOCK[user_id] = now + 8.0

    fetched = fetch_wb_campaigns(
        wb_api_key.strip(),
        enrich=False,
        fast_mode=bool(background),
        max_attempts=3 if background else 12,
    )
    if not isinstance(fetched, list):
        fetched = []
    if fetched and not background:
        fetched = _hydrate_campaign_rows_with_summaries(wb_api_key.strip(), fetched)
        fetched = _hydrate_campaign_rows_with_stats(wb_api_key.strip(), fetched)
    seen_ids: set[int] = set()
    ts = datetime.utcnow()
    changed = 0
    for item in fetched:
        if not isinstance(item, dict):
            continue
        incoming_row = dict(item)
        cid = _campaign_id_from_row(incoming_row)
        if cid <= 0:
            continue
        seen_ids.add(cid)
        row = db.scalar(
            select(WbAdsCampaignSnapshot).where(
                WbAdsCampaignSnapshot.user_id == user_id,
                WbAdsCampaignSnapshot.campaign_id == cid,
            )
        )
        merged_row = incoming_row
        if row and row.payload_json:
            previous_payload = _safe_json_loads(row.payload_json)
            if isinstance(previous_payload, dict):
                merged_row = _merge_snapshot_payload(previous_payload, incoming_row, campaign_id=cid)
        payload = json.dumps(merged_row, ensure_ascii=False, sort_keys=True)
        payload_hash = hashlib.sha1(payload.encode("utf-8")).hexdigest()
        status = str(merged_row.get("status") or "")
        if not row:
            row = WbAdsCampaignSnapshot(
                user_id=user_id,
                campaign_id=cid,
                payload_json=payload,
                payload_hash=payload_hash,
                status=status,
                is_deleted=False,
                last_seen_at=ts,
                synced_at=ts,
            )
            db.add(row)
            changed += 1
            continue
        if row.payload_hash != payload_hash or row.is_deleted:
            row.payload_json = payload
            row.payload_hash = payload_hash
            row.status = status
            row.is_deleted = False
            changed += 1
        row.last_seen_at = ts
        row.synced_at = ts

    if seen_ids:
        stale_rows = db.scalars(
            select(WbAdsCampaignSnapshot).where(
                WbAdsCampaignSnapshot.user_id == user_id,
                WbAdsCampaignSnapshot.campaign_id.not_in(seen_ids),
                WbAdsCampaignSnapshot.is_deleted.is_(False),
            )
        ).all()
        for row in stale_rows:
            row.is_deleted = True
            row.synced_at = ts
            changed += 1

    db.commit()
    return {
        "ok": True,
        "count": len(seen_ids),
        "changed": changed,
        "synced_at": ts.isoformat(),
    }


def _hydrate_campaign_rows_with_summaries(wb_api_key: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ids = sorted({_campaign_id_from_row(row) for row in rows if _campaign_id_from_row(row) > 0})
    if not ids:
        return rows
    fallback_cap = max(16, min(80, len(ids) // 4 + 16))
    try:
        summary_map = fetch_wb_campaign_summaries(wb_api_key, ids, fallback_limit=fallback_cap)
    except Exception:
        summary_map = {}
    if not isinstance(summary_map, dict) or not summary_map:
        return rows
    out: list[dict[str, Any]] = []
    for row in rows:
        cid = _campaign_id_from_row(row)
        summary = summary_map.get(str(cid)) if cid > 0 else None
        if not isinstance(summary, dict):
            out.append(row)
            continue
        next_row = dict(row)
        name = str(next_row.get("name") or "").strip()
        status = str(next_row.get("status") or "").strip()
        ctype = str(next_row.get("type") or "").strip()
        budget = str(next_row.get("budget") or "").strip()
        summary_name = str(summary.get("name") or "").strip()
        summary_status = str(summary.get("status") or "").strip()
        summary_type = str(summary.get("type") or "").strip()
        summary_budget = str(summary.get("budget") or "").strip()
        if (not name or _is_placeholder_name(name, cid)) and summary_name:
            next_row["name"] = summary_name
        if (not status or status in {"-", "—"}) and summary_status:
            next_row["status"] = summary_status
        if (not ctype or ctype in {"-", "—"}) and summary_type:
            next_row["type"] = summary_type
        if (not budget or budget in {"-", "—"}) and summary_budget:
            next_row["budget"] = summary_budget
        out.append(next_row)
    return out


def _hydrate_campaign_rows_with_stats(wb_api_key: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ids = sorted({_campaign_id_from_row(row) for row in rows if _campaign_id_from_row(row) > 0})
    if not ids:
        return rows
    try:
        stats_map = fetch_wb_campaign_stats_bulk(
            wb_api_key,
            ids,
            date_from=None,
            date_to=None,
            retry_unresolved=False,
            fast_mode=True,
        )
    except Exception:
        stats_map = {}
    if not isinstance(stats_map, dict):
        stats_map = {}
    unresolved_ids = []
    for cid in ids:
        stat = stats_map.get(str(cid))
        if not isinstance(stat, dict):
            unresolved_ids.append(cid)
            continue
        if not bool(stat.get("stat_has_context")):
            unresolved_ids.append(cid)
    if unresolved_ids:
        retry_cap = 0 if len(ids) > 120 else (8 if len(ids) > 48 else 16)
        for cid in unresolved_ids[:retry_cap]:
            try:
                one_map = fetch_wb_campaign_stats_bulk(
                    wb_api_key,
                    [cid],
                    date_from=None,
                    date_to=None,
                    retry_unresolved=False,
                    fast_mode=True,
                )
            except Exception:
                one_map = {}
            one_stat = one_map.get(str(cid)) if isinstance(one_map, dict) else None
            if isinstance(one_stat, dict):
                stats_map[str(cid)] = one_stat
    if not stats_map:
        return rows
    metric_keys = ("views", "clicks", "orders", "spent", "ctr", "cr", "cpc", "cpo", "add_to_cart")
    out: list[dict[str, Any]] = []
    for row in rows:
        cid = _campaign_id_from_row(row)
        stat = stats_map.get(str(cid)) if cid > 0 else None
        if not isinstance(stat, dict) or not stat:
            out.append(row)
            continue
        next_row = dict(row)
        for key in metric_keys:
            if key in stat:
                next_row[key] = stat.get(key)
        out.append(next_row)
    return out


def _is_placeholder_name(value: str, campaign_id: int) -> bool:
    text = str(value or "").strip().lower()
    if not text:
        return True
    if text.startswith("кампания ") or text.startswith("campaign "):
        if campaign_id <= 0:
            return True
        return text in {f"кампания {campaign_id}", f"campaign {campaign_id}"}
    return False


def _merge_snapshot_payload(existing: dict[str, Any], incoming: dict[str, Any], *, campaign_id: int) -> dict[str, Any]:
    # Keep richer context from previous successful syncs when WB returns partial payloads.
    out = dict(incoming or {})
    prev = existing if isinstance(existing, dict) else {}

    def _pick_text(row: dict[str, Any], *keys: str) -> str:
        for key in keys:
            val = str((row or {}).get(key) or "").strip()
            if val and val not in {"-", "—"}:
                return val
        return ""

    def _copy_if_missing(*keys: str) -> None:
        cur = _pick_text(out, *keys)
        if cur:
            return
        fallback = _pick_text(prev, *keys)
        if not fallback:
            return
        for key in keys:
            if key in prev:
                out[key] = prev.get(key)
                break

    def _copy_if_name_placeholder(*keys: str) -> None:
        cur = _pick_text(out, *keys)
        fallback = _pick_text(prev, *keys)
        if not fallback:
            return
        if not cur or _is_placeholder_name(cur, campaign_id):
            if not _is_placeholder_name(fallback, campaign_id):
                for key in keys:
                    if key in prev:
                        out[key] = prev.get(key)
                        break

    def _copy_metric_if_missing(*keys: str) -> None:
        for key in keys:
            if key in out and out.get(key) not in (None, "", "-", "—"):
                return
        for key in keys:
            if key in prev and prev.get(key) not in (None, "", "-", "—"):
                out[key] = prev.get(key)
                return

    _copy_if_name_placeholder("name", "campaignName", "campaign_name", "subject", "title")
    _copy_if_missing("status", "state")
    _copy_if_missing("type", "adType", "campaignType", "typeId")
    _copy_if_missing("budget", "dailyBudget", "sum", "money")

    for metric_keys in (
        ("views", "impressions", "shows", "view_count"),
        ("clicks", "click_count"),
        ("orders", "orders_count", "order_count", "orders_sum"),
        ("spent", "sum", "cost", "expense", "total_spent"),
        ("ctr",),
        ("cr", "cvr", "conversion"),
        ("cpc",),
        ("cpo", "cpa"),
    ):
        _copy_metric_if_missing(*metric_keys)

    return out


def sync_wb_campaign_snapshots_for_all_users(db: Session) -> dict[str, int]:
    user_ids = db.scalars(
        select(User.id)
        .join(ModuleAccess, ModuleAccess.user_id == User.id)
        .where(
            ModuleAccess.module_code == "wb_ads",
            ModuleAccess.enabled.is_(True),
        )
    ).all()
    total = 0
    synced = 0
    errors = 0
    for uid in user_ids:
        total += 1
        key = db.scalar(
            select(ApiCredential.api_key).where(
                ApiCredential.user_id == uid,
                ApiCredential.marketplace == "wb",
                ApiCredential.active.is_(True),
            )
        ) or ""
        if not key:
            continue
        try:
            sync_wb_campaign_snapshots(db, int(uid), str(key))
            synced += 1
        except Exception:
            errors += 1
            db.rollback()
    return {"total": total, "synced": synced, "errors": errors}


def _campaign_id_from_row(row: dict[str, Any]) -> int:
    for key in ("advertId", "advert_id", "campaignId", "campaign_id", "id", "adId"):
        value = row.get(key)
        try:
            num = int(str(value).strip())
        except Exception:
            continue
        if num > 0:
            return num
    return 0


def _safe_json_loads(raw: str) -> Any:
    try:
        return json.loads(raw or "")
    except Exception:
        return None

