from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ApiCredential, ModuleAccess, User, WbAdsCampaignSnapshot
from app.services.wb_modules import fetch_wb_campaigns


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
    latest = db.scalar(
        select(WbAdsCampaignSnapshot)
        .where(WbAdsCampaignSnapshot.user_id == user_id)
        .order_by(WbAdsCampaignSnapshot.synced_at.desc(), WbAdsCampaignSnapshot.id.desc())
    )
    if not latest or not latest.synced_at:
        return True
    return (datetime.utcnow() - latest.synced_at).total_seconds() > WB_ADS_SNAPSHOT_TTL_SEC


def sync_wb_campaign_snapshots(db: Session, user_id: int, wb_api_key: str) -> dict[str, Any]:
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
        fast_mode=True,
        max_attempts=1,
    )
    if not isinstance(fetched, list):
        fetched = []
    seen_ids: set[int] = set()
    ts = datetime.utcnow()
    changed = 0
    for item in fetched:
        if not isinstance(item, dict):
            continue
        cid = _campaign_id_from_row(item)
        if cid <= 0:
            continue
        seen_ids.add(cid)
        payload = json.dumps(item, ensure_ascii=False, sort_keys=True)
        payload_hash = hashlib.sha1(payload.encode("utf-8")).hexdigest()
        row = db.scalar(
            select(WbAdsCampaignSnapshot).where(
                WbAdsCampaignSnapshot.user_id == user_id,
                WbAdsCampaignSnapshot.campaign_id == cid,
            )
        )
        status = str(item.get("status") or "")
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

