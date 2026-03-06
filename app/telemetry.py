from __future__ import annotations

import math
import re
import threading
import time
from collections import deque
from typing import Any


_API_SAMPLE_LIMIT = 6000
_SQL_SAMPLE_LIMIT = 10000
_API_SAMPLES: deque[tuple[float, str, float]] = deque(maxlen=_API_SAMPLE_LIMIT)
_SQL_SAMPLES: deque[tuple[float, str, float]] = deque(maxlen=_SQL_SAMPLE_LIMIT)
_LOCK = threading.Lock()
_SPACE_RE = re.compile(r"\s+")
_NUM_RE = re.compile(r"\b\d+\b")
_SQ_RE = re.compile(r"'[^']*'")
_DQ_RE = re.compile(r'"[^"]*"')


def record_api_timing(method: str, route: str, duration_ms: float) -> None:
    safe_method = str(method or "GET").strip().upper()[:12]
    safe_route = str(route or "/").strip()[:220] or "/"
    safe_duration = _safe_duration(duration_ms)
    now = time.time()
    with _LOCK:
        _API_SAMPLES.append((now, f"{safe_method} {safe_route}", safe_duration))


def record_sql_timing(statement: str, duration_ms: float) -> None:
    fingerprint = _sql_fingerprint(statement)
    safe_duration = _safe_duration(duration_ms)
    now = time.time()
    with _LOCK:
        _SQL_SAMPLES.append((now, fingerprint, safe_duration))


def collect_perf_metrics(window_sec: int = 15 * 60) -> dict[str, Any]:
    safe_window = max(60, min(int(window_sec or 0), 6 * 60 * 60))
    since_ts = time.time() - safe_window
    with _LOCK:
        api_rows = [row for row in _API_SAMPLES if row[0] >= since_ts]
        sql_rows = [row for row in _SQL_SAMPLES if row[0] >= since_ts]
    return {
        "window_sec": safe_window,
        "api": _build_metric_payload(api_rows),
        "sql": _build_metric_payload(sql_rows),
    }


def _build_metric_payload(rows: list[tuple[float, str, float]]) -> dict[str, Any]:
    if not rows:
        return {
            "count": 0,
            "avg_ms": 0.0,
            "p95_ms": 0.0,
            "p99_ms": 0.0,
            "top_slowest": [],
        }
    values = [float(row[2]) for row in rows]
    grouped: dict[str, list[float]] = {}
    for _, key, duration in rows:
        grouped.setdefault(str(key), []).append(float(duration))
    top_slowest = sorted(
        (
            {
                "key": key,
                "count": len(samples),
                "avg_ms": round(sum(samples) / max(1, len(samples)), 2),
                "p95_ms": _percentile(samples, 95),
                "p99_ms": _percentile(samples, 99),
            }
            for key, samples in grouped.items()
        ),
        key=lambda row: (row.get("p95_ms", 0.0), row.get("avg_ms", 0.0), row.get("count", 0)),
        reverse=True,
    )[:8]
    return {
        "count": len(values),
        "avg_ms": round(sum(values) / max(1, len(values)), 2),
        "p95_ms": _percentile(values, 95),
        "p99_ms": _percentile(values, 99),
        "top_slowest": top_slowest,
    }


def _percentile(values: list[float], p: int) -> float:
    if not values:
        return 0.0
    safe_p = min(99, max(1, int(p or 0)))
    sorted_values = sorted(float(v) for v in values)
    if len(sorted_values) == 1:
        return round(sorted_values[0], 2)
    rank = (safe_p / 100.0) * (len(sorted_values) - 1)
    low = int(math.floor(rank))
    high = int(math.ceil(rank))
    if low == high:
        return round(sorted_values[low], 2)
    weight = rank - low
    value = sorted_values[low] * (1.0 - weight) + sorted_values[high] * weight
    return round(value, 2)


def _sql_fingerprint(statement: str) -> str:
    raw = str(statement or "").strip()
    if not raw:
        return "unknown"
    compact = _SPACE_RE.sub(" ", raw)
    compact = _SQ_RE.sub("?", compact)
    compact = _DQ_RE.sub("?", compact)
    compact = _NUM_RE.sub("?", compact)
    return compact[:320]


def _safe_duration(duration_ms: float) -> float:
    raw = float(duration_ms or 0.0)
    if not math.isfinite(raw):
        return 0.0
    return max(0.0, round(raw, 3))
