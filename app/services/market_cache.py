from __future__ import annotations

import hashlib
import json
import threading
import time
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Callable

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import MarketplaceApiCache


_CACHE_LOCKS: dict[str, threading.Lock] = {}
_CACHE_LOCKS_GUARD = threading.Lock()
_STATS_CACHE: dict[str, tuple[float, dict[str, int]]] = {}
_STATS_CACHE_LOCK = threading.Lock()
_STATS_CACHE_TTL_SEC = 20.0


def build_market_cache_key(payload: dict[str, Any]) -> str:
    raw = _safe_json_dumps(payload)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    return digest[:40]


def get_or_refresh_market_cache(
    db: Session,
    *,
    user_id: int,
    module_code: str,
    marketplace: str,
    cache_key: str,
    ttl_sec: int,
    fetcher: Callable[[], Any],
    stale_if_error_sec: int = 20 * 60,
    prefer_stale_sec: int = 0,
) -> tuple[Any, dict[str, Any]]:
    now = datetime.utcnow()
    row = _get_cache_row(db, user_id=user_id, module_code=module_code, marketplace=marketplace, cache_key=cache_key)
    cached = _safe_json_loads(str(row.payload_json or "")) if row else None
    if row and cached is not None and row.expires_at and row.expires_at > now:
        return cached, _cache_meta("db-hit", now=now, row=row)
    if (
        row
        and cached is not None
        and row.fetched_at
        and int(prefer_stale_sec or 0) > 0
        and max(0, int((now - row.fetched_at).total_seconds())) <= max(60, int(prefer_stale_sec or 0))
    ):
        return cached, _cache_meta("db-stale-fastpath", now=now, row=row, stale=True)

    lock_id = f"{int(user_id)}:{module_code}:{marketplace}:{cache_key}"
    with _lock_for_key(lock_id):
        now = datetime.utcnow()
        row = _get_cache_row(db, user_id=user_id, module_code=module_code, marketplace=marketplace, cache_key=cache_key)
        cached = _safe_json_loads(str(row.payload_json or "")) if row else None
        if row and cached is not None and row.expires_at and row.expires_at > now:
            return cached, _cache_meta("db-hit-race", now=now, row=row)
        if (
            row
            and cached is not None
            and row.fetched_at
            and int(prefer_stale_sec or 0) > 0
            and max(0, int((now - row.fetched_at).total_seconds())) <= max(60, int(prefer_stale_sec or 0))
        ):
            return cached, _cache_meta("db-stale-fastpath-race", now=now, row=row, stale=True)

        try:
            payload = fetcher()
        except Exception as exc:
            if row and cached is not None and row.fetched_at:
                age_sec = max(0, int((now - row.fetched_at).total_seconds()))
                if age_sec <= max(60, int(stale_if_error_sec or 0)):
                    return cached, _cache_meta("db-stale-fallback", now=now, row=row, stale=True, error=str(exc or ""))
            raise

        _upsert_cache_row(
            db,
            user_id=user_id,
            module_code=module_code,
            marketplace=marketplace,
            cache_key=cache_key,
            payload=payload,
            now=now,
            ttl_sec=ttl_sec,
        )
        return payload, {
            "source": "api-live",
            "stale": False,
            "age_sec": 0,
            "ttl_sec": max(30, int(ttl_sec or 0)),
        }


def get_market_cache_stats(
    db: Session,
    *,
    user_id: int | None = None,
    module_code: str = "",
    marketplace: str = "",
) -> dict[str, int]:
    cache_key = _stats_cache_key(user_id=user_id, module_code=module_code, marketplace=marketplace)
    now_ts = time.monotonic()
    with _STATS_CACHE_LOCK:
        cached = _STATS_CACHE.get(cache_key)
        if cached and (now_ts - float(cached[0] or 0.0)) <= _STATS_CACHE_TTL_SEC:
            return dict(cached[1])
    query = select(
        func.count(MarketplaceApiCache.id),
        func.coalesce(func.sum(MarketplaceApiCache.hit_count), 0),
        func.coalesce(func.sum(MarketplaceApiCache.refresh_count), 0),
        func.coalesce(
            func.sum(
                case(
                    (MarketplaceApiCache.expires_at < datetime.utcnow(), 1),
                    else_=0,
                )
            ),
            0,
        ),
    )
    if user_id is not None:
        query = query.where(MarketplaceApiCache.user_id == int(user_id))
    safe_module = str(module_code or "").strip()
    if safe_module:
        query = query.where(MarketplaceApiCache.module_code == safe_module)
    safe_market = str(marketplace or "").strip()
    if safe_market:
        query = query.where(MarketplaceApiCache.marketplace == safe_market[:30])
    entries, hits, refreshes, expired = db.execute(query).one()
    safe_entries = int(entries or 0)
    safe_hits = int(hits or 0)
    safe_refreshes = int(refreshes or 0)
    safe_expired = int(expired or 0)
    payload = {
        "entries": safe_entries,
        "hits": safe_hits,
        "refreshes": safe_refreshes,
        "expired": safe_expired,
        "api_calls_saved": max(0, safe_hits),
    }
    with _STATS_CACHE_LOCK:
        if len(_STATS_CACHE) > 256:
            _STATS_CACHE.clear()
        _STATS_CACHE[cache_key] = (now_ts, dict(payload))
    return payload


def _cache_meta(source: str, *, now: datetime, row: MarketplaceApiCache, stale: bool = False, error: str = "") -> dict[str, Any]:
    age_sec = 0
    if row.fetched_at:
        age_sec = max(0, int((now - row.fetched_at).total_seconds()))
    ttl_sec = 0
    if row.fetched_at and row.expires_at:
        ttl_sec = max(0, int((row.expires_at - row.fetched_at).total_seconds()))
    return {
        "source": source,
        "stale": bool(stale),
        "age_sec": int(age_sec),
        "ttl_sec": int(ttl_sec),
        "error": str(error or "")[:500],
    }


def _upsert_cache_row(
    db: Session,
    *,
    user_id: int,
    module_code: str,
    marketplace: str,
    cache_key: str,
    payload: Any,
    now: datetime,
    ttl_sec: int,
) -> None:
    payload_json = _safe_json_dumps(payload)
    payload_hash = hashlib.sha1(payload_json.encode("utf-8")).hexdigest()
    row = _get_cache_row(db, user_id=user_id, module_code=module_code, marketplace=marketplace, cache_key=cache_key)
    safe_ttl = max(30, int(ttl_sec or 0))
    expires_at = now + timedelta(seconds=safe_ttl)
    if not row:
        row = MarketplaceApiCache(
            user_id=int(user_id),
            module_code=str(module_code or "")[:80],
            marketplace=str(marketplace or "")[:30],
            cache_key=str(cache_key or "")[:120],
            payload_json=payload_json,
            payload_hash=payload_hash,
            refresh_count=1,
            fetched_at=now,
            expires_at=expires_at,
            last_hit_at=now,
        )
        db.add(row)
        db.flush()
        _invalidate_stats_cache()
        return
    row.payload_json = payload_json
    row.payload_hash = payload_hash
    row.refresh_count = int(row.refresh_count or 0) + 1
    row.fetched_at = now
    row.expires_at = expires_at
    row.last_error = ""
    row.last_hit_at = now
    _invalidate_stats_cache()


def _get_cache_row(
    db: Session,
    *,
    user_id: int,
    module_code: str,
    marketplace: str,
    cache_key: str,
) -> MarketplaceApiCache | None:
    return db.scalar(
        select(MarketplaceApiCache).where(
            MarketplaceApiCache.user_id == int(user_id),
            MarketplaceApiCache.module_code == str(module_code or "")[:80],
            MarketplaceApiCache.marketplace == str(marketplace or "")[:30],
            MarketplaceApiCache.cache_key == str(cache_key or "")[:120],
        )
    )


def _lock_for_key(cache_key: str) -> threading.Lock:
    with _CACHE_LOCKS_GUARD:
        lock = _CACHE_LOCKS.get(cache_key)
        if lock is None:
            lock = threading.Lock()
            _CACHE_LOCKS[cache_key] = lock
        return lock


def _safe_json_loads(raw: str) -> Any:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        return None


def _safe_json_dumps(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, default=_json_default)


def _json_default(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return str(value)


def _stats_cache_key(*, user_id: int | None, module_code: str, marketplace: str) -> str:
    return "|".join(
        [
            str(int(user_id)) if user_id is not None else "*",
            str(module_code or "").strip()[:80],
            str(marketplace or "").strip()[:30],
        ]
    )


def _invalidate_stats_cache() -> None:
    with _STATS_CACHE_LOCK:
        _STATS_CACHE.clear()
