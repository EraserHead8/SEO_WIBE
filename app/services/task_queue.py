from __future__ import annotations

import hashlib
import json
import threading
import time
from typing import Any

from app.config import settings

try:  # pragma: no cover - import guard for local environments without redis client
    import redis
except Exception:  # pragma: no cover
    redis = None


_REDIS_CLIENT = None
_REDIS_LOCK = threading.Lock()


def queue_enabled() -> bool:
    return bool(getattr(settings, "task_queue_enabled", True))


def queue_name() -> str:
    raw = str(getattr(settings, "task_queue_name", "") or "").strip()
    return raw or "seo_wibe:tasks"


def queue_available() -> bool:
    if not queue_enabled():
        return False
    client = _get_client()
    if client is None:
        return False
    try:
        return bool(client.ping())
    except Exception:
        return False


def queue_depth() -> int:
    client = _get_client()
    if client is None:
        return 0
    try:
        return max(0, int(client.llen(queue_name()) or 0))
    except Exception:
        return 0


def enqueue_task(
    task_type: str,
    payload: dict[str, Any] | None = None,
    *,
    dedupe_key: str = "",
    dedupe_ttl_sec: int = 120,
) -> dict[str, Any]:
    safe_type = str(task_type or "").strip().lower()[:60]
    if not safe_type:
        return {"ok": False, "queued": False, "reason": "empty_type"}
    if not queue_enabled():
        return {"ok": False, "queued": False, "reason": "disabled"}
    client = _get_client()
    if client is None:
        return {"ok": False, "queued": False, "reason": "redis_unavailable"}

    safe_payload = payload if isinstance(payload, dict) else {}
    item = {
        "type": safe_type,
        "payload": safe_payload,
        "queued_at": time.time(),
    }
    dedupe_value = str(dedupe_key or "").strip()
    dedupe_name = ""
    try:
        if dedupe_value:
            dedupe_name = _dedupe_cache_name(safe_type, dedupe_value)
            inserted = client.set(
                dedupe_name,
                "1",
                nx=True,
                ex=max(15, int(dedupe_ttl_sec or 0)),
            )
            if not inserted:
                return {"ok": True, "queued": False, "reason": "duplicate", "depth": queue_depth()}
        client.lpush(queue_name(), json.dumps(item, ensure_ascii=False))
        return {"ok": True, "queued": True, "depth": queue_depth()}
    except Exception as exc:
        if dedupe_name:
            try:
                client.delete(dedupe_name)
            except Exception:
                pass
        return {"ok": False, "queued": False, "reason": str(exc or "enqueue_failed")[:160]}


def dequeue_task(timeout_sec: int = 10) -> dict[str, Any] | None:
    if not queue_enabled():
        return None
    client = _get_client()
    if client is None:
        return None
    safe_timeout = max(1, min(int(timeout_sec or 0), 60))
    try:
        row = client.brpop(queue_name(), timeout=safe_timeout)
    except Exception:
        return None
    if not row or len(row) < 2:
        return None
    raw_payload = row[1]
    try:
        parsed = json.loads(str(raw_payload or ""))
    except Exception:
        return None
    if not isinstance(parsed, dict):
        return None
    parsed["dequeued_at"] = time.time()
    return parsed


def _get_client():
    global _REDIS_CLIENT
    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT
    if redis is None:
        return None
    with _REDIS_LOCK:
        if _REDIS_CLIENT is not None:
            return _REDIS_CLIENT
        url = str(getattr(settings, "redis_url", "") or "").strip() or "redis://127.0.0.1:6379/0"
        try:
            _REDIS_CLIENT = redis.Redis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=1.5,
                socket_timeout=3.0,
                retry_on_timeout=False,
            )
        except Exception:
            _REDIS_CLIENT = None
        return _REDIS_CLIENT


def _dedupe_cache_name(task_type: str, dedupe_key: str) -> str:
    prefix = str(getattr(settings, "task_queue_dedupe_prefix", "") or "").strip() or "seo_wibe:task_dedupe"
    raw = f"{task_type}:{dedupe_key}"
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:24]
    return f"{prefix}:{task_type}:{digest}"
