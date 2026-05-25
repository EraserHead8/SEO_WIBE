from __future__ import annotations

from datetime import date, datetime, timedelta
import hashlib
import json
import math
import os
import re
import tempfile
import threading
import time
from typing import Any

import httpx

from app.config import settings


WB_TIMEOUT = httpx.Timeout(connect=6.0, read=18.0, write=18.0, pool=18.0)
WB_FAST_TIMEOUT = httpx.Timeout(connect=3.0, read=6.0, write=6.0, pool=6.0)
OZON_TIMEOUT = httpx.Timeout(connect=6.0, read=22.0, write=22.0, pool=22.0)


class WbRateLimitError(RuntimeError):
    pass


_WB_FEEDBACK_THROTTLE_LOCK = threading.Lock()
_WB_FEEDBACK_LAST_REQUEST_AT: dict[str, float] = {}
_WB_FEEDBACK_MIN_INTERVAL_SEC = 1.4
_WB_FEEDBACK_PAGE_TAKE = 5000
_WB_QUESTION_PAGE_TAKE = 10000
_WB_FEEDBACK_THROTTLE_FILE = os.path.join(tempfile.gettempdir(), "seo_wibe_wb_feedback_throttle_v1.json")


def _is_wb_feedback_api_url(url: str) -> bool:
    return "feedbacks-api.wildberries.ru" in str(url or "").lower()


def _wb_feedback_throttle(api_key: str) -> None:
    token = str(api_key or "").strip()
    if not token:
        return
    # WB has one shared Feedbacks/Questions bucket per seller account.
    # Keep an inter-process guard and honor server-provided 429 cooldowns.
    key = token[-24:] if len(token) > 24 else token
    if _wb_feedback_file_throttle(key):
        return
    _wb_feedback_memory_throttle(key)


def _wb_feedback_memory_throttle(key: str) -> None:
    with _WB_FEEDBACK_THROTTLE_LOCK:
        now = time.monotonic()
        last = float(_WB_FEEDBACK_LAST_REQUEST_AT.get(key) or 0.0)
        wait = _WB_FEEDBACK_MIN_INTERVAL_SEC - (now - last)
        if wait > 0:
            time.sleep(min(3.0, wait))
            now = time.monotonic()
        _WB_FEEDBACK_LAST_REQUEST_AT[key] = now


def _wb_feedback_file_throttle(key: str) -> bool:
    if os.name != "posix":
        return False
    try:
        import fcntl  # type: ignore
    except Exception:
        return False
    try:
        with open(_WB_FEEDBACK_THROTTLE_FILE, "a+", encoding="utf-8") as fh:
            fcntl.flock(fh.fileno(), fcntl.LOCK_EX)
            fh.seek(0)
            raw = fh.read().strip()
            try:
                payload = json.loads(raw) if raw else {}
            except Exception:
                payload = {}
            if not isinstance(payload, dict):
                payload = {}
            now = time.time()
            raw_entry = payload.get(key)
            if isinstance(raw_entry, dict):
                last = float(raw_entry.get("last") or 0.0)
                cooldown_until = float(raw_entry.get("cooldown_until") or 0.0)
            else:
                last = float(raw_entry or 0.0)
                cooldown_until = 0.0
            cooldown_wait = cooldown_until - now
            if cooldown_wait > 0:
                time.sleep(min(5.0, cooldown_wait))
                now = time.time()
            wait = _WB_FEEDBACK_MIN_INTERVAL_SEC - (now - last)
            if wait > 0:
                time.sleep(min(5.0, wait))
                now = time.time()
            payload[key] = {
                "last": now,
                "cooldown_until": cooldown_until if cooldown_until > now else 0.0,
            }
            # Keep the tiny file tidy if several old keys accumulated.
            cutoff = now - 3600
            cleaned: dict[str, Any] = {}
            for raw_key, raw_value in payload.items():
                try:
                    if isinstance(raw_value, dict):
                        value = max(
                            float(raw_value.get("last") or 0),
                            float(raw_value.get("cooldown_until") or 0),
                        )
                    else:
                        value = float(raw_value or 0)
                except Exception:
                    continue
                if value >= cutoff:
                    cleaned[str(raw_key)] = raw_value
            payload = cleaned
            fh.seek(0)
            fh.truncate()
            json.dump(payload, fh, ensure_ascii=False, sort_keys=True)
            fh.flush()
            return True
    except Exception:
        return False


def _wb_feedback_record_rate_limit(api_key: str, retry_after_sec: float) -> None:
    token = str(api_key or "").strip()
    if not token or os.name != "posix":
        return
    key = token[-24:] if len(token) > 24 else token
    retry_after = max(0.0, min(20 * 60.0, float(retry_after_sec or 0.0)))
    if retry_after <= 0:
        return
    try:
        import fcntl  # type: ignore
    except Exception:
        return
    try:
        with open(_WB_FEEDBACK_THROTTLE_FILE, "a+", encoding="utf-8") as fh:
            fcntl.flock(fh.fileno(), fcntl.LOCK_EX)
            fh.seek(0)
            raw = fh.read().strip()
            try:
                payload = json.loads(raw) if raw else {}
            except Exception:
                payload = {}
            if not isinstance(payload, dict):
                payload = {}
            now = time.time()
            raw_entry = payload.get(key)
            if isinstance(raw_entry, dict):
                last = float(raw_entry.get("last") or now)
            else:
                last = float(raw_entry or now)
            payload[key] = {
                "last": last,
                "cooldown_until": max(float((raw_entry or {}).get("cooldown_until") or 0.0) if isinstance(raw_entry, dict) else 0.0, now + retry_after),
            }
            fh.seek(0)
            fh.truncate()
            json.dump(payload, fh, ensure_ascii=False, sort_keys=True)
            fh.flush()
    except Exception:
        return


def wait_wb_feedback_auto_reply_slot(api_key: str, *, interval_sec: float = _WB_FEEDBACK_MIN_INTERVAL_SEC) -> None:
    wait = wb_feedback_auto_reply_wait_left_sec(api_key, interval_sec=interval_sec)
    if wait > 0:
        time.sleep(wait)


def wb_feedback_auto_reply_wait_left_sec(api_key: str, *, interval_sec: float = _WB_FEEDBACK_MIN_INTERVAL_SEC) -> float:
    token = str(api_key or "").strip()
    if not token or os.name != "posix":
        return 0.0
    key = token[-24:] if len(token) > 24 else token
    try:
        with open(_WB_FEEDBACK_THROTTLE_FILE, "a+", encoding="utf-8") as fh:
            fh.seek(0)
            raw = fh.read().strip()
            payload = json.loads(raw) if raw else {}
            if not isinstance(payload, dict):
                payload = {}
            raw_entry = payload.get(key)
            if isinstance(raw_entry, dict):
                last = float(raw_entry.get("last") or 0.0)
                cooldown_until = float(raw_entry.get("cooldown_until") or 0.0)
            else:
                last = float(raw_entry or 0.0)
                cooldown_until = 0.0
    except Exception:
        return 0.0
    now = time.time()
    return max(0.0, float(interval_sec or 0) - (now - last), cooldown_until - now)


def fetch_wb_reviews(
    api_key: str,
    stars: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    max_pages: int = 1,
) -> dict[str, list[dict[str, Any]]]:
    new_rows = _fetch_reviews_by_answer_state(
        api_key,
        is_answered=False,
        stars=stars,
        max_pages=max_pages,
        include_archive=False,
    )
    answered_rows: list[dict[str, Any]] = []
    new_rows = _dedupe_review_rows(new_rows)
    answered_rows = _dedupe_review_rows(answered_rows)
    normalized_new = [_normalize_review_row(item, is_answered=False) for item in new_rows]
    normalized_answered = [_normalize_review_row(item, is_answered=True) for item in answered_rows]
    normalized_new = _filter_rows_by_period(normalized_new, date_from=date_from, date_to=date_to)
    normalized_answered = _filter_rows_by_period(normalized_answered, date_from=date_from, date_to=date_to)
    return {"new": normalized_new, "answered": normalized_answered}


def fetch_wb_reviews_fast(
    api_key: str,
    stars: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, list[dict[str, Any]]]:
    # Load only the actionable unanswered inbox and avoid archive/mixed requests:
    # every Feedbacks/Questions call shares the same WB rate-limit bucket.
    rows = _fetch_reviews_by_answer_state(api_key, is_answered=False, stars=stars, max_pages=1, include_archive=False)
    rows = _dedupe_review_rows(rows)
    normalized_all = [_normalize_review_row(item, is_answered=_looks_answered_feedback(item)) for item in rows]
    normalized_new = [row for row in normalized_all if not row.get("is_answered")]
    normalized_answered: list[dict[str, Any]] = []
    normalized_new = _filter_rows_by_period(normalized_new, date_from=date_from, date_to=date_to)
    normalized_answered = _filter_rows_by_period(normalized_answered, date_from=date_from, date_to=date_to)
    return {"new": normalized_new, "answered": normalized_answered}


def fetch_ozon_reviews(
    api_key: str,
    stars: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    max_pages: int = 12,
    enrich_products: bool = True,
) -> dict[str, list[dict[str, Any]]]:
    rows = _fetch_ozon_reviews(api_key, stars=stars, max_pages=max_pages)
    catalog = _build_ozon_product_catalog(api_key=api_key, rows=rows) if enrich_products else {}
    new_rows: list[dict[str, Any]] = []
    answered_rows: list[dict[str, Any]] = []
    for item in rows:
        normalized = _normalize_ozon_review_row(item, product_catalog=catalog)
        if normalized.get("is_answered"):
            answered_rows.append(normalized)
        else:
            new_rows.append(normalized)
    new_rows = _filter_rows_by_period(new_rows, date_from=date_from, date_to=date_to)
    answered_rows = _filter_rows_by_period(answered_rows, date_from=date_from, date_to=date_to)
    return {"new": new_rows, "answered": answered_rows}


def fetch_wb_questions(
    api_key: str,
    stars: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    max_pages: int = 12,
) -> dict[str, list[dict[str, Any]]]:
    new_rows = _fetch_wb_questions_by_answer_state(api_key, is_answered=False, stars=stars, max_pages=max_pages)
    answered_rows = _fetch_wb_questions_by_answer_state(api_key, is_answered=True, stars=stars, max_pages=max_pages)

    new_rows = _dedupe_review_rows(new_rows)
    answered_rows = _dedupe_review_rows(answered_rows)
    normalized_new = [_normalize_wb_question_row(item, is_answered=False) for item in new_rows]
    normalized_answered = [_normalize_wb_question_row(item, is_answered=True) for item in answered_rows]
    normalized_new = _filter_rows_by_period(normalized_new, date_from=date_from, date_to=date_to)
    normalized_answered = _filter_rows_by_period(normalized_answered, date_from=date_from, date_to=date_to)
    return {"new": normalized_new, "answered": normalized_answered}


def fetch_wb_questions_fast(
    api_key: str,
    stars: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, list[dict[str, Any]]]:
    rows = _fetch_wb_questions_by_answer_state(api_key, is_answered=False, stars=stars, max_pages=1, include_archive=False)
    rows = _dedupe_review_rows(rows)
    normalized_all = [_normalize_wb_question_row(item, is_answered=_looks_answered_feedback(item)) for item in rows]
    normalized_new = [row for row in normalized_all if not row.get("is_answered")]
    normalized_answered: list[dict[str, Any]] = []
    normalized_new = _filter_rows_by_period(normalized_new, date_from=date_from, date_to=date_to)
    normalized_answered = _filter_rows_by_period(normalized_answered, date_from=date_from, date_to=date_to)
    return {"new": normalized_new, "answered": normalized_answered}


def fetch_ozon_questions(
    api_key: str,
    stars: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    max_pages: int = 12,
    enrich_products: bool = True,
) -> dict[str, list[dict[str, Any]]]:
    rows = _fetch_ozon_questions(api_key=api_key, stars=stars, max_pages=max_pages)
    catalog = _build_ozon_product_catalog(api_key=api_key, rows=rows) if enrich_products else {}
    new_rows: list[dict[str, Any]] = []
    answered_rows: list[dict[str, Any]] = []
    for row in rows:
        normalized = _normalize_ozon_question_row(row, product_catalog=catalog)
        if normalized.get("is_answered"):
            answered_rows.append(normalized)
        else:
            new_rows.append(normalized)
    new_rows = _filter_rows_by_period(new_rows, date_from=date_from, date_to=date_to)
    answered_rows = _filter_rows_by_period(answered_rows, date_from=date_from, date_to=date_to)
    return {"new": new_rows, "answered": answered_rows}


def probe_wb_feedback_access(api_key: str, feedback_kind: str = "reviews") -> tuple[bool, str]:
    token = (api_key or "").strip()
    if not token:
        return False, "WB API РєР»СЋС‡ РЅРµ Р·Р°РґР°РЅ."
    kind = (feedback_kind or "reviews").strip().lower()
    endpoint = "https://feedbacks-api.wildberries.ru/api/v1/questions" if kind == "questions" else "https://feedbacks-api.wildberries.ru/api/v1/feedbacks"
    params = {"take": 1, "skip": 0}
    last_error = "WB feedback API РЅРµРґРѕСЃС‚СѓРїРµРЅ."
    for auth_value in (token, f"Bearer {token}"):
        headers = {"Authorization": auth_value, "Content-Type": "application/json"}
        try:
            _wb_feedback_throttle(token)
            with httpx.Client(timeout=WB_TIMEOUT, follow_redirects=True) as client:
                response = client.get(endpoint, headers=headers, params=params)
        except Exception:
            continue
        if response.status_code < 400:
            return True, "ok"
        if response.status_code in {401, 403}:
            last_error = "WB feedback API отклонил ключ (401/403). Проверьте тип ключа и права."
            continue
        if response.status_code in {400, 404, 405, 422}:
            return True, "ok"
        if response.status_code == 429:
            return False, "WB feedback API вернул 429 (лимит запросов). Повторите позже."
        body = _safe_response_text(response)
        if body:
            return False, f"WB feedback API error {response.status_code}: {body}"
        last_error = f"WB feedback API error {response.status_code}."
    return False, last_error


def probe_ozon_feedback_access(api_key: str, feedback_kind: str = "reviews") -> tuple[bool, str]:
    kind = (feedback_kind or "reviews").strip().lower()
    endpoint = "https://api-seller.ozon.ru/v1/question/list" if kind == "questions" else "https://api-seller.ozon.ru/v1/review/list"
    headers = _build_ozon_headers(api_key)
    if not headers:
        return False, "Ozon РєР»СЋС‡ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РІ С„РѕСЂРјР°С‚Рµ client_id:api_key."
    payload = {"limit": 1, "last_id": "", "sort_dir": "DESC", "status": "ALL"}
    try:
        with httpx.Client(timeout=OZON_TIMEOUT, follow_redirects=True) as client:
            response = client.post(endpoint, headers=headers, json=payload)
    except Exception:
        return False, "Ozon API РЅРµРґРѕСЃС‚СѓРїРµРЅ."
    if response.status_code < 400:
        return True, "ok"
    if response.status_code in {401, 403}:
        return False, "Ozon API отклонил ключ (401/403). Проверьте client_id и api_key."
    if response.status_code in {400, 404, 405, 422}:
        return True, "ok"
    if response.status_code == 429:
        return False, "Ozon API вернул 429 (лимит запросов). Повторите позже."
    body = _safe_response_text(response)
    if body:
        return False, f"Ozon API error {response.status_code}: {body}"
    return False, f"Ozon API error {response.status_code}."


def fetch_wb_campaign_details(
    api_key: str,
    campaign_id: int,
    *,
    fast_mode: bool = False,
    deadline_sec: float | None = None,
) -> dict[str, Any]:
    summary: dict[str, Any] = {"campaign_id": campaign_id}
    raw: dict[str, Any] = {}
    started_at = time.monotonic()
    deadline = max(2.0, float(deadline_sec or (10.0 if fast_mode else 45.0)))

    for idx, item in enumerate(_campaign_detail_requests(campaign_id), start=1):
        if (time.monotonic() - started_at) >= deadline:
            break
        method = item.get("method", "GET")
        endpoint = str(item.get("endpoint") or "")
        params = item.get("params")
        payload = item.get("payload")
        if not endpoint:
            continue
        data = _request_wb_json(
            method,
            endpoint,
            api_key=api_key,
            params=params,
            payload=payload,
            max_attempts=1 if fast_mode else 2,
            retry_rate_limit=not fast_mode,
            timeout=WB_FAST_TIMEOUT if fast_mode else WB_TIMEOUT,
        )
        if data is None:
            continue
        raw[f"{idx}:{method}:{endpoint}"] = data
        summary = _merge_campaign_summary(summary, _extract_campaign_summary(data, campaign_id))
        if fast_mode and _has_campaign_context(summary):
            break

    rates: dict[str, Any] = {}
    if (time.monotonic() - started_at) < deadline:
        for campaign_type in ("search", "auto-cpm"):
            if (time.monotonic() - started_at) >= deadline:
                break
            data = fetch_wb_campaign_rates(
                api_key=api_key,
                campaign_id=campaign_id,
                campaign_type=campaign_type,
                fast_mode=fast_mode,
            )
            if data is not None:
                rates[campaign_type] = data

    if summary.get("type") in (None, "", "-"):
        if "search" in rates and "auto-cpm" not in rates:
            summary["type"] = "search"
        elif "auto-cpm" in rates and "search" not in rates:
            summary["type"] = "auto-cpm"
    if summary.get("status") in (None, "", "-") and rates:
        summary["status"] = "available"

    stats = None
    if (time.monotonic() - started_at) < deadline:
        stats = fetch_wb_campaign_stats(
            api_key=api_key,
            campaign_id=campaign_id,
            days=7,
            fast_mode=fast_mode,
        )
    products = _extract_campaign_products(list(raw.values()))
    return {
        "summary": summary,
        "products": products,
        "rates": rates,
        "stats": stats or {},
        "raw": raw,
        "meta": {
            "live_elapsed_sec": round(time.monotonic() - started_at, 3),
            "live_deadline_sec": deadline,
            "live_partial": (time.monotonic() - started_at) >= deadline,
        },
    }


def _legacy_post_wb_review_reply_unused(api_key: str, feedback_id: str, text: str) -> tuple[bool, str]:
    if not feedback_id.strip():
        return False, "РќРµ СѓРєР°Р·Р°РЅ ID РѕС‚Р·С‹РІР°"
    reply = " ".join(text.split())
    if len(reply) < 2:
        return False, "Ответ слишком короткий"
    if len(reply) > 3000:
        return False, "Ответ слишком длинный (максимум 3000 символов)"

    endpoint = "https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer"
    payload = {"id": feedback_id.strip(), "text": reply}

    # WB endpoints могут принимать и plain token, и Bearer token.
    for auth_value in (api_key.strip(), f"Bearer {api_key.strip()}"):
        headers = {"Authorization": auth_value, "Content-Type": "application/json"}
        for attempt in range(3):
            response = None
            try:
                with httpx.Client(timeout=WB_TIMEOUT, follow_redirects=True) as client:
                    response = client.post(endpoint, headers=headers, json=payload)
            except Exception:
                response = None
            if response is None:
                if attempt < 2:
                    time.sleep(0.35 * (attempt + 1))
                    continue
                break
            if response.status_code in {200, 204}:
                return True, "РћС‚РІРµС‚ РѕС‚РїСЂР°РІР»РµРЅ"
            if response.status_code in {401, 403}:
                break
            if response.status_code in {408, 425, 429, 500, 502, 503, 504} and attempt < 2:
                time.sleep(0.45 * (attempt + 1))
                continue
            body = _safe_response_text(response)
            return False, f"WB API РІРµСЂРЅСѓР» {response.status_code}: {body}"
    return False, "Не удалось авторизоваться в WB API"


def post_wb_review_reply(api_key: str, feedback_id: str, text: str) -> tuple[bool, str]:
    if not str(feedback_id or "").strip():
        return False, "Не указан ID отзыва"
    reply = sanitize_marketplace_reply_text(text)
    if len(reply) < 2:
        return False, "Ответ слишком короткий"
    if len(reply) > 3000:
        return False, "Ответ слишком длинный (максимум 3000 символов)"

    endpoint = "https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer"
    payload = {"id": str(feedback_id or "").strip(), "text": reply}
    for auth_value in (str(api_key or "").strip(), f"Bearer {str(api_key or '').strip()}"):
        if not auth_value.strip():
            continue
        headers = {"Authorization": auth_value, "Content-Type": "application/json"}
        for attempt in range(3):
            wait_left = wb_feedback_auto_reply_wait_left_sec(api_key)
            if wait_left > 5:
                retry_sec = int(wait_left + 0.999)
                return False, f"WB rate limit cooldown is active (429). Retry automatically after {retry_sec} sec."
            if wait_left > 0:
                wait_wb_feedback_auto_reply_slot(api_key)
            response = None
            try:
                _wb_feedback_throttle(api_key)
                with httpx.Client(timeout=WB_TIMEOUT, follow_redirects=True) as client:
                    response = client.post(endpoint, headers=headers, json=payload)
            except Exception:
                response = None
            if response is None:
                if attempt < 2:
                    time.sleep(0.35 * (attempt + 1))
                    continue
                break
            if response.status_code in {200, 204}:
                return True, "Ответ отправлен"
            if response.status_code in {401, 403}:
                break
            if response.status_code in {408, 425, 500, 502, 503, 504} and attempt < 2:
                time.sleep(0.45 * (attempt + 1))
                continue
            body = _safe_response_text(response)
            if response.status_code == 429:
                return False, (
                    "WB временно ограничил отправку ответов: слишком много запросов (429). "
                    "Черновик ответа сохранен. Подождите несколько минут и попробуйте отправить снова."
                )
            return False, f"WB API вернул {response.status_code}: {body}"
    return False, "Не удалось авторизоваться в WB API"


def post_wb_review_reply(api_key: str, feedback_id: str, text: str) -> tuple[bool, str]:
    raw_id = str(feedback_id or "").strip()
    if not raw_id:
        return False, "WB review ID is missing"
    reply = sanitize_marketplace_reply_text(text)
    if len(reply) < 2:
        return False, "Reply is too short"
    if len(reply) > 3000:
        return False, "Reply is too long (maximum 3000 characters)"

    endpoint = "https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer"
    payload = {"id": raw_id, "text": reply}
    for auth_value in (str(api_key or "").strip(), f"Bearer {str(api_key or '').strip()}"):
        if not auth_value.strip():
            continue
        headers = {"Authorization": auth_value, "Content-Type": "application/json"}
        for attempt in range(3):
            response = None
            try:
                wait_left = wb_feedback_auto_reply_wait_left_sec(api_key)
                if wait_left > 5:
                    retry_sec = int(wait_left + 0.999)
                    return False, f"WB Feedbacks/Questions cooldown is active after 429. Retry automatically after {retry_sec} sec."
                if wait_left > 0:
                    wait_wb_feedback_auto_reply_slot(api_key)
                _wb_feedback_throttle(api_key)
                with httpx.Client(timeout=WB_TIMEOUT, follow_redirects=True) as client:
                    response = client.post(endpoint, headers=headers, json=payload)
            except Exception:
                response = None
            if response is None:
                if attempt < 2:
                    time.sleep(0.5 * (attempt + 1))
                    continue
                break
            if response.status_code in {200, 204}:
                return True, "Reply sent"
            if response.status_code in {401, 403}:
                break
            if response.status_code == 429:
                retry_delay = _wb_retry_delay_sec(response, attempt)
                _wb_feedback_record_rate_limit(api_key, retry_delay)
                if attempt < 2 and retry_delay <= 30:
                    time.sleep(retry_delay)
                    continue
                retry_sec = int(retry_delay + 0.999)
                return False, f"WB temporarily rate-limited reply publishing (429). Retry automatically after {retry_sec} sec."
            if response.status_code in {408, 425, 500, 502, 503, 504} and attempt < 2:
                time.sleep(0.7 * (attempt + 1))
                continue
            body = _safe_response_text(response)
            return False, f"WB API returned {response.status_code}: {body}"
    return False, "Failed to authenticate in WB API"


def post_wb_question_reply(api_key: str, question_id: str | int, text: str, *, state: str | None = None) -> tuple[bool, str]:
    raw_id = str(question_id or "").strip()
    if not raw_id:
        return False, "Question ID is missing"

    token = str(api_key or "").strip()
    if not token:
        return False, "WB API key is missing"

    reply = " ".join(str(text or "").split())
    if len(reply) < 2:
        return False, "Reply is too short"
    if len(reply) > 3000:
        return False, "Reply is too long (maximum 3000 characters)"

    raw_state = str(state or "").strip()
    state_low = raw_state.lower()
    safe_state = "none" if state_low in {"reject", "rejected", "declined"} else "wbRu"
    int_id = None
    try:
        int_id = int(raw_id)
    except Exception:
        int_id = None

    payloads: list[dict[str, Any]] = []
    payloads.append({"id": raw_id, "text": reply, "state": safe_state})
    base_variants: list[dict[str, Any]] = []
    for key in ("id", "questionId", "question_id"):
        base_variants.append({key: raw_id})
    if int_id is not None:
        for key in ("id", "questionId", "question_id"):
            base_variants.append({key: int_id})

    text_fields = ("text", "answerText", "answer", "reply", "response", "content")
    nested_fields = (
        {"answer": {"text": reply}},
        {"answer": {"body": reply}},
        {"response": {"text": reply}},
        {"reply": {"text": reply}},
    )

    for base in base_variants:
        for field in text_fields:
            payloads.append({**base, field: reply})
        for nested in nested_fields:
            payloads.append({**base, **nested})
        payloads.append({**base, "answerText": reply, "wasViewed": True})
        payloads.append({**base, "text": reply, "wasViewed": True})
        payloads.append({**base, "answer": {"text": reply}, "wasViewed": True})

    if safe_state:
        payloads_with_state: list[dict[str, Any]] = []
        for payload in payloads:
            payloads_with_state.append(payload)
            payloads_with_state.append({**payload, "state": safe_state})
            payloads_with_state.append({**payload, "status": safe_state})
            answer_payload = payload.get("answer") if isinstance(payload.get("answer"), dict) else None
            if answer_payload:
                payloads_with_state.append({**payload, "answer": {**answer_payload, "state": safe_state}})
        payloads = payloads_with_state

    seen_payloads: set[str] = set()
    unique_payloads: list[dict[str, Any]] = []
    for payload in payloads:
        try:
            marker = json.dumps(payload, ensure_ascii=False, sort_keys=True)
        except Exception:
            marker = str(payload)
        if marker in seen_payloads:
            continue
        seen_payloads.add(marker)
        unique_payloads.append(payload)

    request_matrix = [
        ("PATCH", "https://feedbacks-api.wildberries.ru/api/v1/questions"),
        ("PATCH", "https://feedbacks-api.wildberries.ru/api/v1/questions/answer"),
        ("POST", "https://feedbacks-api.wildberries.ru/api/v1/questions/answer"),
        ("PUT", "https://feedbacks-api.wildberries.ru/api/v1/questions/answer"),
        ("POST", "https://feedbacks-api.wildberries.ru/api/v1/question/answer"),
    ]
    header_variants = [
        {"Authorization": token, "Content-Type": "application/json"},
        {"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        {"HeaderApiKey": token, "Content-Type": "application/json"},
        {"X-Api-Key": token, "Content-Type": "application/json"},
    ]

    last_error = "Failed to send reply to WB API"
    def _api_error_text(response: httpx.Response) -> str:
        try:
            data = response.json()
        except Exception:
            return ""
        if not isinstance(data, dict):
            return ""
        error_text = str(data.get("errorText") or data.get("detail") or data.get("message") or "").strip()
        additional = data.get("additionalErrors")
        if bool(data.get("error")) or error_text or additional:
            if additional and not error_text:
                error_text = str(additional)
            return error_text or "WB API returned an error response"
        return ""

    for method, endpoint in request_matrix:
        for payload in unique_payloads:
            for headers in header_variants:
                for attempt in range(3):
                    response = None
                    try:
                        wait_left = wb_feedback_auto_reply_wait_left_sec(token)
                        if wait_left > 5:
                            last_error = f"WB Feedbacks/Questions cooldown is active after 429. Retry automatically after {int(wait_left + 0.999)} sec."
                            return False, last_error
                        if wait_left > 0:
                            wait_wb_feedback_auto_reply_slot(token)
                        _wb_feedback_throttle(token)
                        with httpx.Client(timeout=WB_TIMEOUT, follow_redirects=True) as client:
                            if method == "PATCH":
                                response = client.patch(endpoint, headers=headers, json=payload)
                            elif method == "PUT":
                                response = client.put(endpoint, headers=headers, json=payload)
                            else:
                                response = client.post(endpoint, headers=headers, json=payload)
                    except Exception:
                        response = None
                    if response is None:
                        if attempt < 2:
                            time.sleep(0.35 * (attempt + 1))
                            continue
                        break
                    if response.status_code < 300:
                        api_error = _api_error_text(response)
                        if api_error:
                            last_error = f"WB API returned success status with error: {api_error}"
                            break
                        return True, "Reply sent"
                    if response.status_code in {401, 403}:
                        break
                    if response.status_code in {404, 405}:
                        body = _safe_response_text(response)
                        last_error = f"WB API returned {response.status_code}: {body}" if body else f"WB API returned {response.status_code}"
                        break
                    if response.status_code == 429:
                        retry_delay = _wb_retry_delay_sec(response, attempt)
                        _wb_feedback_record_rate_limit(token, retry_delay)
                        if attempt < 2 and retry_delay <= 30:
                            time.sleep(retry_delay)
                            continue
                        last_error = f"WB temporarily rate-limited question publishing (429). Retry automatically after {int(retry_delay + 0.999)} sec."
                        return False, last_error
                    if response.status_code in {408, 409, 425, 500, 502, 503, 504} and attempt < 2:
                        time.sleep(0.45 * (attempt + 1))
                        continue
                    body = _safe_response_text(response)
                    last_error = f"WB API returned {response.status_code}: {body}" if body else f"WB API returned {response.status_code}"
                    break
    return False, last_error
def post_ozon_review_reply(api_key: str, review_id: str, text: str) -> tuple[bool, str]:
    if not review_id.strip():
        return False, "РќРµ СѓРєР°Р·Р°РЅ ID РѕС‚Р·С‹РІР°"
    reply = " ".join(text.split())
    if len(reply) < 2:
        return False, "Ответ слишком короткий"
    if len(reply) > 3000:
        return False, "Ответ слишком длинный (максимум 3000 символов)"

    raw_id = review_id.strip()
    int_id = None
    try:
        int_id = int(raw_id)
    except Exception:
        int_id = None

    payloads: list[dict[str, Any]] = [
        {"review_id": raw_id, "text": reply},
        {"id": raw_id, "text": reply},
    ]
    if int_id is not None:
        payloads.extend(
            [
                {"review_id": int_id, "text": reply},
                {"id": int_id, "text": reply},
            ]
        )

    endpoints = [
        "https://api-seller.ozon.ru/v1/review/comment/create",
        "https://api-seller.ozon.ru/v1/review/comment/update",
        "https://api-seller.ozon.ru/v1/review/comment",
    ]
    last_error = "Не удалось отправить ответ в Ozon API"
    for endpoint in endpoints:
        for payload in payloads:
            for attempt in range(3):
                response = _request_ozon_response("POST", endpoint, api_key=api_key, payload=payload)
                if response is None:
                    if attempt < 2:
                        time.sleep(0.35 * (attempt + 1))
                        continue
                    break
                if response.status_code < 400:
                    return True, "РћС‚РІРµС‚ РѕС‚РїСЂР°РІР»РµРЅ"
                if response.status_code in {408, 425, 429, 500, 502, 503, 504} and attempt < 2:
                    time.sleep(0.45 * (attempt + 1))
                    continue
                body = _safe_response_text(response)
                if body:
                    last_error = f"Ozon API РІРµСЂРЅСѓР» {response.status_code}: {body}"
                break
    return False, last_error


def post_ozon_review_reply(api_key: str, review_id: str, text: str) -> tuple[bool, str]:
    raw_id = str(review_id or "").strip()
    if not raw_id:
        return False, "Ozon review ID is missing"
    reply = sanitize_marketplace_reply_text(text)
    if len(reply) < 2:
        return False, "Reply is too short"
    if len(reply) > 3000:
        return False, "Reply is too long (maximum 3000 characters)"

    endpoint = "https://api-seller.ozon.ru/v1/review/comment/create"
    payload = {
        "review_id": raw_id,
        "text": reply,
        "mark_review_as_processed": True,
    }
    last_error = "Failed to send reply to Ozon API"
    for attempt in range(3):
        response = _request_ozon_response("POST", endpoint, api_key=api_key, payload=payload)
        if response is None:
            if attempt < 2:
                time.sleep(0.35 * (attempt + 1))
                continue
            break
        if response.status_code < 400:
            return True, "Reply sent"
        body = _safe_response_text(response)
        body_lower = body.lower()
        if response.status_code == 400 and "cannot comment on empty review" in body_lower:
            return False, "Ozon не разрешает отвечать на отзывы без текста, фото и видео (только оценка). Такой отзыв нужно обработать в кабинете Ozon."
        if response.status_code == 404 and "page not found" in body_lower:
            last_error = (
                "Ozon review comment API returned 404. "
                "Check that the seller account has access to review replies via API."
            )
        else:
            last_error = f"Ozon API returned {response.status_code}: {body}" if body else f"Ozon API returned {response.status_code}"
        if response.status_code in {408, 425, 429, 500, 502, 503, 504} and attempt < 2:
            time.sleep(0.45 * (attempt + 1))
            continue
        break
    return False, last_error


def post_ozon_question_reply(
    api_key: str,
    question_id: str,
    text: str,
    *,
    sku: int | None = None,
) -> tuple[bool, str]:
    if not question_id.strip():
        return False, "РќРµ СѓРєР°Р·Р°РЅ ID РІРѕРїСЂРѕСЃР°"
    reply = " ".join(text.split())
    if len(reply) < 2:
        return False, "Ответ слишком короткий"
    if len(reply) > 3000:
        return False, "Ответ слишком длинный (максимум 3000 символов)"

    raw_id = question_id.strip()
    int_id = None
    try:
        int_id = int(raw_id)
    except Exception:
        int_id = None

    def _maybe_with_sku(payload: dict[str, Any]) -> dict[str, Any]:
        if sku is not None and int(sku or 0) > 0:
            payload = dict(payload)
            payload["sku"] = int(sku)
        return payload

    payloads: list[dict[str, Any]] = [
        _maybe_with_sku({"question_id": raw_id, "text": reply}),
        _maybe_with_sku({"id": raw_id, "text": reply}),
    ]
    if int_id is not None:
        payloads.extend(
            [
                _maybe_with_sku({"question_id": int_id, "text": reply}),
                _maybe_with_sku({"id": int_id, "text": reply}),
            ]
        )

    endpoints = [
        "https://api-seller.ozon.ru/v1/question/answer/create",
        "https://api-seller.ozon.ru/v1/question/answer/update",
        "https://api-seller.ozon.ru/v1/question/answer",
    ]
    last_error = "Не удалось отправить ответ в Ozon API"
    for endpoint in endpoints:
        for payload in payloads:
            for attempt in range(3):
                response = _request_ozon_response("POST", endpoint, api_key=api_key, payload=payload)
                if response is None:
                    if attempt < 2:
                        time.sleep(0.35 * (attempt + 1))
                        continue
                    break
                if response.status_code < 400:
                    return True, "РћС‚РІРµС‚ РѕС‚РїСЂР°РІР»РµРЅ"
                if response.status_code in {408, 425, 429, 500, 502, 503, 504} and attempt < 2:
                    time.sleep(0.45 * (attempt + 1))
                    continue
                body = _safe_response_text(response)
                if body:
                    last_error = f"Ozon API РІРµСЂРЅСѓР» {response.status_code}: {body}"
                break
    return False, last_error


def generate_review_reply(
    review_text: str,
    product_name: str,
    stars: int | None,
    prompt: str = "",
    reviewer_name: str = "",
    marketplace: str = "wb",
    content_kind: str = "review",
    api_key: str = "",
    model: str = "",
    provider: str = "openai",
    base_url: str = "",
    fallback_chain: list[dict[str, Any]] | None = None,
    previous_replies: list[str] | None = None,
    trace: dict[str, Any] | None = None,
) -> str:
    review = _repair_mojibake_text(review_text).strip()
    product = (product_name or "").strip() or "С‚РѕРІР°СЂ"
    rating = stars if isinstance(stars, int) else None
    product = _repair_mojibake_text(product_name).strip() or "товар"
    raw_prompt = str(prompt or "").strip()
    repaired_prompt = _repair_mojibake_text(raw_prompt).strip()
    product_context_marker = "Контекст из модуля товаров SEO WIBE."
    custom_prompt = (
        raw_prompt
        if product_context_marker in raw_prompt and product_context_marker not in repaired_prompt
        else repaired_prompt
    )
    customer_name = _sanitize_person_name(_repair_mojibake_text(reviewer_name))
    mp = "Ozon" if (marketplace or "").strip().lower() == "ozon" else "WB"
    kind = "question" if (content_kind or "").strip().lower() == "question" else "review"

    fallback = _fallback_question_reply(review, product, customer_name) if kind == "question" else _fallback_reply(review, product, rating, customer_name)

    if kind == "question":
        system_prompt = custom_prompt or (
            "Ты менеджер магазина на маркетплейсе. Отвечай на вопрос покупателя о товаре вежливо и конкретно, на русском. "
            "Не выдумывай характеристики, которых нет в вопросе или названии товара. "
            "Если недостаточно данных, предложи уточнить параметры. "
            "Не спорь с клиентом. "
            "Ответ должен быть коротким, полезным и готовым к отправке. "
            "Если имя клиента известно, используй его в приветствии."
        )
        user_prompt = (
            f"Вопрос клиента:\n{review or '[текста нет]'}\n\n"
            f"Имя клиента: {customer_name or '[не указано]'}\n"
            f"РўРѕРІР°СЂ: {product}\n"
            f"РњР°СЂРєРµС‚РїР»РµР№СЃ: {mp}\n\n"
            "Сформируй готовый ответ для клиента."
        )
    else:
        system_prompt = custom_prompt or (
            "Ты менеджер маркетплейса. Пиши вежливо, коротко, по делу, на русском. "
            "Не выдумывай факты. Не обвиняй клиента. "
            "Ответ должен быть готов к отправке и содержать название товара. "
            "Если имя клиента известно, используй его в приветствии."
        )
        user_prompt = (
            f"Отзыв клиента:\n{review or '[текста нет]'}\n\n"
            f"Имя клиента: {customer_name or '[не указано]'}\n"
            f"РўРѕРІР°СЂ: {product}\n"
            f"РњР°СЂРєРµС‚РїР»РµР№СЃ: {mp}\n"
            f"РћС†РµРЅРєР°: {rating if rating is not None else 'РЅРµ СѓРєР°Р·Р°РЅР°'}\n\n"
            "Сформируй готовый ответ для клиента."
        )
    previous_clean: list[str] = []
    for item in previous_replies or []:
        text = " ".join(_repair_mojibake_text(item).split())
        if text and text not in previous_clean:
            previous_clean.append(text[:220])
        if len(previous_clean) >= 8:
            break
    style_options = [
        "тепло и по делу, без канцелярита",
        "коротко, благодарно, с акцентом на опыт покупателя",
        "спокойно и профессионально, без одинаковых фраз",
        "дружелюбно, но без излишней восторженности",
        "лаконично, с конкретной реакцией на текст отзыва",
        "естественно, как ответ живого менеджера магазина",
    ]
    style_options = [
        "\u0442\u0435\u043f\u043b\u043e \u0438 \u043f\u043e \u0434\u0435\u043b\u0443, \u0431\u0435\u0437 \u043a\u0430\u043d\u0446\u0435\u043b\u044f\u0440\u0438\u0442\u0430",
        "\u043a\u043e\u0440\u043e\u0442\u043a\u043e, \u0431\u043b\u0430\u0433\u043e\u0434\u0430\u0440\u043d\u043e, \u0441 \u0430\u043a\u0446\u0435\u043d\u0442\u043e\u043c \u043d\u0430 \u043e\u043f\u044b\u0442 \u043f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044f",
        "\u0441\u043f\u043e\u043a\u043e\u0439\u043d\u043e \u0438 \u043f\u0440\u043e\u0444\u0435\u0441\u0441\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e, \u0431\u0435\u0437 \u043e\u0434\u0438\u043d\u0430\u043a\u043e\u0432\u044b\u0445 \u0444\u0440\u0430\u0437",
        "\u0434\u0440\u0443\u0436\u0435\u043b\u044e\u0431\u043d\u043e, \u043d\u043e \u0431\u0435\u0437 \u0438\u0437\u043b\u0438\u0448\u043d\u0435\u0439 \u0432\u043e\u0441\u0442\u043e\u0440\u0436\u0435\u043d\u043d\u043e\u0441\u0442\u0438",
        "\u043b\u0430\u043a\u043e\u043d\u0438\u0447\u043d\u043e, \u0441 \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u043d\u043e\u0439 \u0440\u0435\u0430\u043a\u0446\u0438\u0435\u0439 \u043d\u0430 \u0442\u0435\u043a\u0441\u0442 \u043e\u0442\u0437\u044b\u0432\u0430",
        "\u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e, \u043a\u0430\u043a \u043e\u0442\u0432\u0435\u0442 \u0436\u0438\u0432\u043e\u0433\u043e \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440\u0430 \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u0430",
    ]
    seed = int(hashlib.sha1(f"{mp}|{product}|{review}|{rating}".encode("utf-8", errors="ignore")).hexdigest()[:8], 16)
    style_hint = style_options[seed % len(style_options)]
    previous_block = "\n".join(f"- {text}" for text in previous_clean) or "- пока нет"
    base_system_prompt = custom_prompt or (
        "Ты менеджер магазина на маркетплейсе. Пиши на русском языке, вежливо, естественно и коротко. "
        "Не выдумывай факты о товаре, доставке, скидках, гарантии или составе. "
        "Не начинай все ответы одинаково. Не используй шаблонные фразы, если они уже есть в предыдущих ответах. "
        "Ответ должен быть готов к публикации клиенту без кавычек, Markdown и служебных пометок."
    )
    system_prompt = (
        f"{base_system_prompt}\n\n"
        f"Стиль для этого ответа: {style_hint}.\n"
        "Обязательно учитывай текст отзыва и оценку. Для 4-5 звезд не обещай исправлений без причины, лучше поблагодари и отметь конкретику из отзыва. "
        "Если отзыв короткий или без деталей, ответь нейтрально и не повторяй предыдущие формулировки."
    )
    user_prompt = (
        f"Маркетплейс: {mp}\n"
        f"Тип: {'вопрос' if kind == 'question' else 'отзыв'}\n"
        f"Товар: {product}\n"
        f"Оценка: {rating if rating is not None else 'не указана'}\n"
        f"Имя клиента: {customer_name or 'не указано'}\n"
        f"Текст клиента:\n{review or '[текста нет]'}\n\n"
        f"Последние опубликованные ответы, которые нельзя копировать:\n{previous_block}\n\n"
        "Сформируй один новый ответ. Он должен отличаться от предыдущих по началу и формулировкам."
    )
    system_prompt += (
        "\n\nВажно: верни только финальный текст ответа покупателю. "
        "Не добавляй вступления вроде «Вот вариант ответа», пояснения, Markdown, разделители, кавычки или несколько вариантов."
    )
    user_prompt += "\n\nВерни только текст, который можно сразу публиковать клиенту."
    content_label = "\u0432\u043e\u043f\u0440\u043e\u0441" if kind == "question" else "\u043e\u0442\u0437\u044b\u0432"
    rating_label = str(rating) if rating is not None else "\u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430"
    customer_label = customer_name or "\u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e"
    previous_block = "\n".join(f"- {text}" for text in previous_clean) or "- \u043f\u043e\u043a\u0430 \u043d\u0435\u0442"
    base_system_prompt = custom_prompt or (
        "\u0422\u044b \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440 \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u0430 \u043d\u0430 \u043c\u0430\u0440\u043a\u0435\u0442\u043f\u043b\u0435\u0439\u0441\u0435. "
        "\u041f\u0438\u0448\u0438 \u043d\u0430 \u0440\u0443\u0441\u0441\u043a\u043e\u043c \u044f\u0437\u044b\u043a\u0435, \u0432\u0435\u0436\u043b\u0438\u0432\u043e, \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e \u0438 \u043a\u043e\u0440\u043e\u0442\u043a\u043e. "
        "\u041d\u0435 \u0432\u044b\u0434\u0443\u043c\u044b\u0432\u0430\u0439 \u0444\u0430\u043a\u0442\u044b \u043e \u0442\u043e\u0432\u0430\u0440\u0435, \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0435, \u0441\u043a\u0438\u0434\u043a\u0430\u0445, \u0433\u0430\u0440\u0430\u043d\u0442\u0438\u0438 \u0438\u043b\u0438 \u0441\u043e\u0441\u0442\u0430\u0432\u0435. "
        "\u041d\u0435 \u043d\u0430\u0447\u0438\u043d\u0430\u0439 \u0432\u0441\u0435 \u043e\u0442\u0432\u0435\u0442\u044b \u043e\u0434\u0438\u043d\u0430\u043a\u043e\u0432\u043e. "
        "\u0412\u0435\u0440\u043d\u0438 \u0442\u043e\u043b\u044c\u043a\u043e \u0444\u0438\u043d\u0430\u043b\u044c\u043d\u044b\u0439 \u0442\u0435\u043a\u0441\u0442 \u043e\u0442\u0432\u0435\u0442\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0443: \u0431\u0435\u0437 \u043a\u0430\u0432\u044b\u0447\u0435\u043a, Markdown, \u043f\u043e\u044f\u0441\u043d\u0435\u043d\u0438\u0439, \u0441\u043b\u0443\u0436\u0435\u0431\u043d\u044b\u0445 \u043f\u043e\u043c\u0435\u0442\u043e\u043a \u0438 \u0444\u0440\u0430\u0437 \u0432\u0440\u043e\u0434\u0435 '\u0412\u043e\u0442 \u0432\u0430\u0440\u0438\u0430\u043d\u0442 \u043e\u0442\u0432\u0435\u0442\u0430'."
    )
    system_prompt = (
        f"{base_system_prompt}\n\n"
        f"\u0421\u0442\u0438\u043b\u044c \u0434\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u043e\u0442\u0432\u0435\u0442\u0430: {style_hint}.\n"
        "\u0423\u0447\u0438\u0442\u044b\u0432\u0430\u0439 \u0442\u0435\u043a\u0441\u0442 \u043a\u043b\u0438\u0435\u043d\u0442\u0430, \u043e\u0446\u0435\u043d\u043a\u0443 \u0438 \u043d\u0435 \u043a\u043e\u043f\u0438\u0440\u0443\u0439 \u043f\u0440\u0435\u0434\u044b\u0434\u0443\u0449\u0438\u0435 \u043e\u0442\u0432\u0435\u0442\u044b. "
        "\u0414\u043b\u044f 4-5 \u0437\u0432\u0435\u0437\u0434 \u0431\u043b\u0430\u0433\u043e\u0434\u0430\u0440\u0438 \u0438 \u043c\u044f\u0433\u043a\u043e \u043e\u0442\u043c\u0435\u0447\u0430\u0439 \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u0438\u043a\u0443 \u0438\u0437 \u043e\u0442\u0437\u044b\u0432\u0430. "
        "\u0415\u0441\u043b\u0438 \u0434\u0435\u0442\u0430\u043b\u0435\u0439 \u043d\u0435\u0442, \u043e\u0442\u0432\u0435\u0447\u0430\u0439 \u043d\u0435\u0439\u0442\u0440\u0430\u043b\u044c\u043d\u043e \u0438 \u0440\u0430\u0437\u043d\u043e\u043e\u0431\u0440\u0430\u0437\u043d\u043e."
    )
    user_prompt = (
        f"\u041c\u0430\u0440\u043a\u0435\u0442\u043f\u043b\u0435\u0439\u0441: {mp}\n"
        f"\u0422\u0438\u043f: {content_label}\n"
        f"\u0422\u043e\u0432\u0430\u0440: {product}\n"
        f"\u041e\u0446\u0435\u043d\u043a\u0430: {rating_label}\n"
        f"\u0418\u043c\u044f \u043a\u043b\u0438\u0435\u043d\u0442\u0430: {customer_label}\n"
        f"\u0422\u0435\u043a\u0441\u0442 \u043a\u043b\u0438\u0435\u043d\u0442\u0430:\n{review or '[\u0442\u0435\u043a\u0441\u0442\u0430 \u043d\u0435\u0442]'}\n\n"
        f"\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u043e\u0442\u0432\u0435\u0442\u044b, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u043d\u0435\u043b\u044c\u0437\u044f \u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c:\n{previous_block}\n\n"
        "\u0421\u0444\u043e\u0440\u043c\u0438\u0440\u0443\u0439 \u043e\u0434\u0438\u043d \u043d\u043e\u0432\u044b\u0439 \u0433\u043e\u0442\u043e\u0432\u044b\u0439 \u043e\u0442\u0432\u0435\u0442, \u043a\u043e\u0442\u043e\u0440\u044b\u0439 \u043c\u043e\u0436\u043d\u043e \u0441\u0440\u0430\u0437\u0443 \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0443."
    )
    product_context_excerpt = _extract_product_knowledge_context(custom_prompt)
    if product_context_excerpt:
        user_prompt += (
            "\n\nТоварный контекст из каталога для этого ответа:\n"
            f"{product_context_excerpt}\n\n"
            "Если клиент спрашивает подбор или артикул и в контексте есть подходящая карточка, назови конкретный артикул из этого контекста."
        )
    has_product_knowledge_context = "Контекст из модуля товаров SEO WIBE" in custom_prompt
    hard_rules = _build_reply_hard_rules(
        kind,
        product,
        review,
        has_product_knowledge_context=has_product_knowledge_context,
    )
    if hard_rules:
        system_prompt += f"\n\n{hard_rules}"
        user_prompt += f"\n\n{hard_rules}"
    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.6,
        "max_tokens": 260,
    }
    attempts: list[dict[str, Any]] = []
    candidates: list[dict[str, Any]] = []
    primary_token = str(api_key or "").strip()
    primary_provider = str(provider or "openai").strip().lower() or "openai"
    primary_model = str(model or "").strip()
    primary_base = str(base_url or "").strip()
    if primary_token:
        candidates.append(
            {
                "mode": "selected",
                "service_id": None,
                "service_name": "selected",
                "provider": primary_provider,
                "api_key": primary_token,
                "model": primary_model or ("deepseek-chat" if primary_provider == "deepseek" else (settings.openai_model or "gpt-4o-mini")),
                "base_url": primary_base,
            }
        )
    for row in (fallback_chain or []):
        if not isinstance(row, dict):
            continue
        token = str(row.get("api_key") or "").strip()
        if not token:
            continue
        prov = str(row.get("provider") or "openai").strip().lower() or "openai"
        mdl = str(row.get("model") or "").strip() or ("deepseek-chat" if prov == "deepseek" else (settings.openai_model or "gpt-4o-mini"))
        entry = {
            "mode": str(row.get("mode") or "fallback").strip().lower() or "fallback",
            "service_id": int(row.get("service_id") or 0) or None,
            "service_name": str(row.get("service_name") or "").strip(),
            "provider": prov,
            "api_key": token,
            "model": mdl,
            "base_url": str(row.get("base_url") or "").strip(),
        }
        # Skip exact duplicates in chain.
        duplicate = any(
            str(x.get("api_key") or "") == entry["api_key"]
            and str(x.get("provider") or "") == entry["provider"]
            and str(x.get("model") or "") == entry["model"]
            and str(x.get("base_url") or "") == entry["base_url"]
            for x in candidates
        )
        if not duplicate:
            candidates.append(entry)
    builtin_token = str(settings.openai_api_key or "").strip()
    if builtin_token:
        duplicate_builtin = any(
            str(x.get("api_key") or "") == builtin_token
            and str(x.get("provider") or "") == "openai"
            for x in candidates
        )
        if not duplicate_builtin:
            candidates.append(
                {
                    "mode": "builtin",
                    "service_id": None,
                    "service_name": "Built-in OpenAI",
                    "provider": "openai",
                    "api_key": builtin_token,
                    "model": settings.openai_model or "gpt-4o-mini",
                    "base_url": "",
                }
            )

    if not candidates:
        if isinstance(trace, dict):
            trace.clear()
            trace.update({"ok": False, "attempts": [], "error": "no_ai_token"})
        return fallback

    for candidate in candidates:
        endpoint = _resolve_ai_chat_endpoint(str(candidate.get("provider") or "openai"), str(candidate.get("base_url") or ""))
        local_payload = dict(payload)
        local_payload["model"] = str(candidate.get("model") or (settings.openai_model or "gpt-4o-mini"))
        headers = {
            "Authorization": f"Bearer {str(candidate.get('api_key') or '').strip()}",
            "Content-Type": "application/json",
        }
        item: dict[str, Any] = {
            "mode": str(candidate.get("mode") or ""),
            "service_id": candidate.get("service_id"),
            "service_name": str(candidate.get("service_name") or ""),
            "provider": str(candidate.get("provider") or ""),
            "model": local_payload["model"],
            "endpoint": endpoint,
        }
        try:
            with httpx.Client(timeout=WB_TIMEOUT, follow_redirects=True) as client:
                response = client.post(endpoint, headers=headers, json=local_payload)
            item["status_code"] = int(response.status_code)
            if response.status_code >= 400:
                item["ok"] = False
                item["error"] = _safe_response_text(response)[:260]
                attempts.append(item)
                continue
            data = response.json()
            reply = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            if not reply:
                item["ok"] = False
                item["error"] = "empty_reply"
                attempts.append(item)
                continue
            answer = sanitize_marketplace_reply_text(reply, fallback=fallback)
            answer = _ensure_catalog_article_in_reply(
                answer,
                custom_prompt,
                review,
                marketplace=marketplace,
            )
            item["ok"] = True
            attempts.append(item)
            if isinstance(trace, dict):
                trace.clear()
                trace.update(
                    {
                        "ok": True,
                        "used_mode": item.get("mode"),
                        "used_service_id": item.get("service_id"),
                        "used_service_name": item.get("service_name"),
                        "used_provider": item.get("provider"),
                        "used_model": item.get("model"),
                        "switched": len(attempts) > 1,
                        "attempts": attempts,
                    }
                )
            return answer
        except Exception as exc:
            item["ok"] = False
            item["error"] = str(exc)[:260]
            attempts.append(item)

    if isinstance(trace, dict):
        trace.clear()
        trace.update(
            {
                "ok": False,
                "used_mode": "",
                "used_service_id": None,
                "used_service_name": "",
                "used_provider": "",
                "used_model": "",
                "switched": len(attempts) > 1,
                "attempts": attempts,
                "error": "all_attempts_failed",
            }
        )
    return sanitize_marketplace_reply_text(fallback, fallback=fallback)


def generate_help_assistant_reply(
    question: str,
    context_text: str,
    prompt: str = "",
    api_key: str = "",
    model: str = "",
    provider: str = "openai",
    base_url: str = "",
) -> str:
    q = " ".join((question or "").split()).strip()
    ctx = str(context_text or "").strip()
    if len(ctx) > 24000:
        ctx = ctx[:24000]
    fallback = (
        "Я помогу с этим вопросом. Уточните модуль и желаемый результат, "
        "и я дам пошаговый ответ с учетом вашей базы знаний."
    )
    token = str(api_key or settings.openai_api_key or "").strip()
    if not token:
        return fallback
    effective_provider = str(provider or "openai").strip().lower()
    effective_model = str(model or "").strip()
    if not effective_model:
        effective_model = "deepseek-chat" if effective_provider == "deepseek" else (settings.openai_model or "gpt-4o-mini")
    endpoint = _resolve_ai_chat_endpoint(effective_provider, base_url)
    system_prompt = (
        (prompt or "").strip()
        or "Ты AI-помощник сервиса продавца маркетплейсов. Отвечай кратко, структурно и по делу на русском языке."
    )
    payload = {
        "model": effective_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Р’РѕРїСЂРѕСЃ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ:\n{q or '[Р±РµР· С‚РµРєСЃС‚Р°]'}\n\n"
                    f"РљРѕРЅС‚РµРєСЃС‚:\n{ctx or '[РєРѕРЅС‚РµРєСЃС‚ РЅРµ РїРµСЂРµРґР°РЅ]'}\n\n"
                    "Сформируй понятный ответ на вопрос."
                ),
            },
        ],
        "temperature": 0.3,
        "max_tokens": 700,
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client(timeout=OZON_TIMEOUT, follow_redirects=True) as client:
            response = client.post(endpoint, headers=headers, json=payload)
            if response.status_code >= 400:
                return fallback
            data = response.json()
        answer = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
        return " ".join(answer.split()) if answer else fallback
    except Exception:
        return fallback


def fetch_wb_returns(
    api_key: str,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, Any]:
    warnings: list[str] = []
    rows: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    safe_status = str(status or "").strip().lower()
    limit = 200
    max_pages = 5

    def _append_rows(parsed_rows: list[dict[str, Any]]) -> None:
        for raw in parsed_rows:
            rid = _pick_first_path_text(
                raw,
                "id",
                "claimId",
                "claim_id",
                "returnId",
                "return_id",
                "claim.id",
                "claim.claimId",
                "claim.claim_id",
                "return.id",
                "return.returnId",
                "return.return_id",
                "posting_number",
                "posting.number",
            )
            rid = str(rid or "").strip()
            if (not rid) or rid in {"0", "-", "вЂ”"} or rid in seen_ids:
                continue
            created = _pick_first_path_text(
                raw,
                "createdAt",
                "created_at",
                "createdDate",
                "date",
                "updatedAt",
                "updated_at",
                "claim.createdAt",
                "claim.created_at",
                "claim.date",
                "return.createdAt",
                "return.created_at",
                "return.date",
            )
            status_value = _pick_first_path_text(
                raw,
                "status",
                "state",
                "claimStatus",
                "claim.status",
                "claim.status.name",
                "claim.status.title",
                "claim.state",
                "claim.state.name",
                "return.status",
                "return.status.name",
                "return.state",
                "return.state.name",
            )
            article = _pick_first_path_text(
                raw,
                "article",
                "supplierVendorCode",
                "vendorCode",
                "offerId",
                "offer_id",
                "nmId",
                "item.article",
                "item.offer_id",
                "item.offerId",
                "item.vendorCode",
                "item.supplierVendorCode",
                "claim.article",
                "claim.item.article",
                "claim.item.offer_id",
                "claim.item.offerId",
                "claim.item.vendorCode",
                "claim.item.supplierVendorCode",
                "return.article",
                "return.item.article",
                "return.item.offer_id",
                "return.item.offerId",
                "return.item.vendorCode",
                "return.item.supplierVendorCode",
                "product.article",
                "product.offer_id",
                "product.offerId",
            )
            product = _pick_first_path_text(
                raw,
                "product",
                "productName",
                "name",
                "subjectName",
                "imtName",
                "item.name",
                "item.title",
                "claim.name",
                "claim.productName",
                "claim.item.name",
                "claim.item.title",
                "return.name",
                "return.productName",
                "return.item.name",
                "return.item.title",
                "product.name",
                "product.title",
            )
            reason = _pick_first_path_text(
                raw,
                "reason",
                "comment",
                "rejectReason",
                "description",
                "text",
                "claim.reason",
                "claim.comment",
                "claim.rejectReason",
                "claim.description",
                "return.reason",
                "return.comment",
                "return.rejectReason",
                "return.description",
            )
            photos = _extract_photo_urls(
                raw.get("photos"),
                raw.get("images"),
                raw.get("pictures"),
                raw.get("attachments"),
                raw.get("files"),
                raw.get("evidences"),
                raw.get("claim"),
                raw.get("return"),
                raw.get("item"),
                raw.get("product"),
            )

            # Some WB responses include envelope/service rows that are not actual return claims.
            # Keep only rows that have at least one business field in addition to id.
            if not any([status_value, created, article, product, reason, photos]):
                continue

            seen_ids.add(rid)
            rows.append(
                {
                    "id": rid,
                    "status": status_value,
                    "created_at": str(created or "").strip(),
                    "article": article,
                    "product": product,
                    "reason": reason,
                    "photos": photos,
                    "marketplace": "wb",
                    "raw": raw,
                }
            )

    attempts: list[tuple[str, dict[str, Any], bool]] = [
        ("https://returns-api.wildberries.ru/api/v1/claims", {"is_archive": False}, True),
        ("https://returns-api.wildberries.ru/api/v1/claims", {"is_archive": "false"}, True),
        ("https://returns-api.wildberries.ru/api/v1/claims", {"is_archive": True}, True),
        ("https://returns-api.wildberries.ru/api/v1/claims", {"is_archive": "true"}, True),
        ("https://returns-api.wildberries.ru/api/v1/returns", {}, True),
        ("https://returns-api.wildberries.ru/api/v1/returns/list", {}, False),
    ]
    for endpoint, base_params, paged in attempts:
        endpoint_ok = False
        offset = 0
        page_no = 0
        while True:
            page_no += 1
            if page_no > (max_pages if paged else 1):
                break
            params = dict(base_params)
            params["limit"] = limit
            if paged:
                params["offset"] = offset
            if safe_status and safe_status not in {"all", "any", "*"}:
                params["status"] = safe_status
            data = _request_wb_json("GET", endpoint, api_key=api_key, params=params)
            if data is None:
                if page_no == 1:
                    warnings.append(f"WB returns endpoint unavailable: {endpoint}")
                break
            endpoint_ok = True
            parsed = _extract_first_dict_list(data, preferred_keys=("claims", "returns", "items", "rows", "data", "list"))
            if not parsed and isinstance(data, dict):
                parsed = [data]
            parsed = [x for x in parsed if isinstance(x, dict)]
            if not parsed:
                break
            _append_rows(parsed)
            if (not paged) or len(parsed) < limit:
                break
            offset += limit
        if endpoint_ok and rows:
            break
    rows = _filter_rows_by_period(rows, date_from=date_from, date_to=date_to)
    if safe_status and safe_status not in {"all", "any", "*"}:
        rows = [x for x in rows if safe_status in str(x.get("status") or "").strip().lower()]
    rows.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    if rows:
        warnings = []
    return {"rows": rows, "warnings": list(dict.fromkeys(warnings))}


def fetch_wb_return_details(api_key: str, return_id: str) -> dict[str, Any]:
    rid = str(return_id or "").strip()
    if not rid:
        return {}
    candidates = [
        ("GET", "https://returns-api.wildberries.ru/api/v1/claims", {"id": rid, "is_archive": False}),
        ("GET", "https://returns-api.wildberries.ru/api/v1/claims", {"id": rid, "is_archive": True}),
        ("GET", f"https://returns-api.wildberries.ru/api/v1/claims/{rid}", None),
        ("GET", f"https://returns-api.wildberries.ru/api/v1/returns/{rid}", None),
    ]
    for method, endpoint, params in candidates:
        data = _request_wb_json(method, endpoint, api_key=api_key, params=params)
        if not data:
            continue
        if isinstance(data, dict):
            candidate_id = str(data.get("id") or data.get("claimId") or data.get("returnId") or "").strip()
            if not candidate_id or candidate_id == rid:
                return data
        rows = _extract_first_dict_list(data, preferred_keys=("claims", "returns", "items", "rows", "data", "list"))
        for row in rows:
            candidate_id = str(row.get("id") or row.get("claimId") or row.get("returnId") or "").strip()
            if candidate_id == rid:
                return row
    return {}


def action_wb_return(api_key: str, return_id: str, action: str, comment: str | None = None) -> tuple[bool, str, dict[str, Any] | None]:
    rid = str(return_id or "").strip()
    if not rid:
        return False, "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID РІРѕР·РІСЂР°С‚Р°", None
    action_raw = str(action or "").strip().lower()
    action_map = {
        "accept": "approve",
        "approve": "approve",
        "decline": "reject",
        "reject": "reject",
        "cancel": "reject",
    }
    safe_action = action_map.get(action_raw, action_raw or "approve")
    payload = {"id": rid, "action": safe_action}
    if comment:
        payload["comment"] = str(comment).strip()[:500]
    attempts = [
        ("PATCH", "https://returns-api.wildberries.ru/api/v1/claim", payload),
        ("POST", "https://returns-api.wildberries.ru/api/v1/claims/action", payload),
        ("POST", f"https://returns-api.wildberries.ru/api/v1/claims/{rid}/{safe_action}", payload),
    ]
    for method, endpoint, request_payload in attempts:
        data = _request_wb_json(method, endpoint, api_key=api_key, payload=request_payload)
        if data is not None:
            return True, "Действие по возврату отправлено", data if isinstance(data, dict) else {"data": data}
    return False, "WB API не принял действие по возврату", None


def fetch_ozon_ads_campaigns(api_key: str) -> dict[str, Any]:
    warnings: list[str] = []
    rows: list[dict[str, Any]] = []
    endpoints = [
        "https://api-seller.ozon.ru/v1/adv/campaign/list",
        "https://api-seller.ozon.ru/v1/campaign/list",
    ]
    for endpoint in endpoints:
        data = _request_ozon_json("POST", endpoint, api_key=api_key, payload={"limit": 500, "offset": 0})
        if data is None:
            warnings.append(f"Ozon ads endpoint unavailable: {endpoint}")
            continue
        parsed = _extract_first_dict_list(data, preferred_keys=("campaigns", "items", "rows", "list", "result", "data"))
        for raw in parsed:
            cid = int(raw.get("id") or raw.get("campaign_id") or 0)
            if cid <= 0:
                continue
            rows.append(
                {
                    "campaign_id": cid,
                    "name": str(raw.get("title") or raw.get("name") or f"Campaign {cid}"),
                    "status": str(raw.get("status") or raw.get("state") or "-"),
                    "type": str(raw.get("type") or raw.get("campaign_type") or "-"),
                    "budget": float(raw.get("budget") or raw.get("daily_budget") or 0.0),
                    "marketplace": "ozon",
                    "raw": raw,
                }
            )
        if rows:
            break
    return {"rows": rows, "warnings": warnings}


def fetch_ozon_ads_analytics(
    api_key: str,
    date_from: str | None = None,
    date_to: str | None = None,
    campaign_id: int | None = None,
) -> dict[str, Any]:
    left = str(date_from or (date.today() - timedelta(days=6)).isoformat())
    right = str(date_to or date.today().isoformat())
    warnings: list[str] = []
    rows: list[dict[str, Any]] = []
    payload = {"date_from": left, "date_to": right}
    if int(campaign_id or 0) > 0:
        payload["campaign_id"] = int(campaign_id)
    endpoints = [
        "https://api-seller.ozon.ru/v1/adv/statistics",
        "https://api-seller.ozon.ru/v1/campaign/statistics",
    ]
    for endpoint in endpoints:
        data = _request_ozon_json("POST", endpoint, api_key=api_key, payload=payload)
        if data is None:
            warnings.append(f"Ozon ads analytics unavailable: {endpoint}")
            continue
        parsed = _extract_first_dict_list(data, preferred_keys=("rows", "items", "list", "result", "data", "campaigns"))
        for raw in parsed:
            views = float(raw.get("views") or raw.get("impressions") or 0.0)
            clicks = float(raw.get("clicks") or 0.0)
            orders = float(raw.get("orders") or raw.get("attributed_orders") or 0.0)
            spent = float(raw.get("spent") or raw.get("cost") or raw.get("sum") or 0.0)
            ctr = (clicks / views * 100.0) if views > 0 else 0.0
            cr = (orders / clicks * 100.0) if clicks > 0 else 0.0
            rows.append(
                {
                    "campaign_id": int(raw.get("campaign_id") or raw.get("id") or 0),
                    "date": str(raw.get("date") or raw.get("day") or left),
                    "views": round(views, 4),
                    "clicks": round(clicks, 4),
                    "orders": round(orders, 4),
                    "spent": round(spent, 4),
                    "ctr": round(ctr, 4),
                    "cr": round(cr, 4),
                    "raw": raw,
                }
            )
        if rows:
            break
    totals = {
        "views": round(sum(float(x.get("views") or 0.0) for x in rows), 4),
        "clicks": round(sum(float(x.get("clicks") or 0.0) for x in rows), 4),
        "orders": round(sum(float(x.get("orders") or 0.0) for x in rows), 4),
        "spent": round(sum(float(x.get("spent") or 0.0) for x in rows), 4),
        "ctr_avg": round((sum(float(x.get("ctr") or 0.0) for x in rows) / len(rows)) if rows else 0.0, 4),
        "cr_avg": round((sum(float(x.get("cr") or 0.0) for x in rows) / len(rows)) if rows else 0.0, 4),
    }
    return {"rows": rows, "warnings": warnings, "date_from": left, "date_to": right, "totals": totals}


def fetch_ozon_returns(
    api_key: str,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, Any]:
    warnings: list[str] = []
    rows: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    payload = {"limit": 500, "offset": 0}
    if status:
        payload["status"] = status
    if date_from:
        payload["date_from"] = date_from
    if date_to:
        payload["date_to"] = date_to
    endpoints = [
        "https://api-seller.ozon.ru/v1/returns/list",
        "https://api-seller.ozon.ru/v1/return/list",
    ]
    for endpoint in endpoints:
        data = _request_ozon_json("POST", endpoint, api_key=api_key, payload=payload)
        if data is None:
            warnings.append(f"Ozon returns endpoint unavailable: {endpoint}")
            continue
        parsed = _extract_first_dict_list(data, preferred_keys=("returns", "items", "list", "rows", "result", "data"))
        for raw in parsed:
            rid = _pick_first_path_text(
                raw,
                "id",
                "return_id",
                "returnId",
                "posting_number",
                "posting.number",
                "return.id",
                "return.return_id",
            )
            if not rid:
                continue
            if rid in seen_ids:
                continue
            seen_ids.add(rid)
            rows.append(
                {
                    "id": rid,
                    "status": _pick_first_path_text(
                        raw,
                        "status",
                        "state",
                        "return.status",
                        "return.state",
                        "status.name",
                        "state.name",
                    ),
                    "created_at": _pick_first_path_text(
                        raw,
                        "created_at",
                        "createdAt",
                        "date",
                        "updated_at",
                        "updatedAt",
                        "return.created_at",
                        "return.createdAt",
                    ),
                    "article": _pick_first_path_text(
                        raw,
                        "offer_id",
                        "offerId",
                        "article",
                        "item.offer_id",
                        "item.offerId",
                        "item.article",
                        "product.offer_id",
                        "product.offerId",
                        "product.article",
                        "return.offer_id",
                        "return.offerId",
                        "return.article",
                    ),
                    "product": _pick_first_path_text(
                        raw,
                        "name",
                        "product_name",
                        "productName",
                        "item.name",
                        "item.title",
                        "product.name",
                        "product.title",
                        "return.name",
                        "return.product_name",
                    ),
                    "reason": _pick_first_path_text(
                        raw,
                        "reason",
                        "comment",
                        "description",
                        "text",
                        "return.reason",
                        "return.comment",
                        "return.description",
                    ),
                    "photos": _extract_photo_urls(
                        raw.get("photos"),
                        raw.get("images"),
                        raw.get("attachments"),
                        raw.get("files"),
                        raw.get("return"),
                        raw.get("item"),
                        raw.get("product"),
                    ),
                    "marketplace": "ozon",
                    "raw": raw,
                }
            )
        if rows:
            break
    rows = _filter_rows_by_period(rows, date_from=date_from, date_to=date_to)
    safe_status = str(status or "").strip().lower()
    if safe_status and safe_status not in {"all", "any", "*"}:
        rows = [x for x in rows if safe_status in str(x.get("status") or "").lower()]
    return {"rows": rows, "warnings": warnings}


def fetch_ozon_return_details(api_key: str, return_id: str) -> dict[str, Any]:
    rid = str(return_id or "").strip()
    if not rid:
        return {}
    endpoints = [
        ("POST", "https://api-seller.ozon.ru/v1/returns/get", {"id": rid}),
        ("POST", "https://api-seller.ozon.ru/v1/return/get", {"id": rid}),
    ]
    for method, endpoint, payload in endpoints:
        data = _request_ozon_json(method, endpoint, api_key=api_key, payload=payload)
        if not data:
            continue
        if isinstance(data, dict):
            if str(data.get("id") or data.get("return_id") or "").strip() in {"", rid}:
                return data
        rows = _extract_first_dict_list(data, preferred_keys=("returns", "items", "list", "rows", "result", "data"))
        for row in rows:
            candidate_id = str(row.get("id") or row.get("return_id") or row.get("posting_number") or "").strip()
            if candidate_id == rid:
                return row
    return {}


def fetch_wb_campaigns(
    api_key: str,
    enrich: bool = True,
    fast_mode: bool = False,
    max_attempts: int | None = None,
) -> list[dict[str, Any]]:
    attempts: list[tuple[str, str, dict[str, Any] | list[Any] | None]] = [
        ("GET", "https://advert-api.wb.ru/adv/v1/promotion/count", None),
        ("POST", "https://advert-api.wb.ru/adv/v1/promotion/count", {}),
        ("POST", "https://advert-api.wb.ru/adv/v1/promotion/count", {"status": [9, 10, 11]}),
        ("GET", "https://advert-api.wb.ru/api/v1/adverts", None),
        ("GET", "https://advert-api.wb.ru/adv/v0/adverts", None),
        ("GET", "https://advert-api.wb.ru/api/v1/adv/list", None),
        ("POST", "https://advert-api.wb.ru/api/v1/adv/list", {}),
        ("GET", "https://advert-api.wb.ru/adv/v1/adv/list", None),
        ("POST", "https://advert-api.wb.ru/adv/v1/adv/list", {}),
        ("POST", "https://advert-api.wb.ru/adv/v1/adv/list", {"order": "create", "direction": "desc"}),
        ("POST", "https://advert-api.wb.ru/adv/v1/promotion/adverts", {}),
        ("POST", "https://advert-api.wb.ru/adv/v1/promotion/adverts", []),
        ("GET", "https://advert-api.wildberries.ru/adv/v1/promotion/count", None),
        ("POST", "https://advert-api.wildberries.ru/adv/v1/promotion/count", {}),
        ("GET", "https://advert-api.wildberries.ru/api/v1/adverts", None),
    ]
    if fast_mode:
        attempts = attempts[:6]
    if isinstance(max_attempts, int) and max_attempts > 0:
        attempts = attempts[:max_attempts]

    discovered_ids: list[int] = []
    for method, endpoint, payload in attempts:
        data = _request_wb_json(
            method,
            endpoint,
            api_key=api_key,
            payload=payload,
            max_attempts=1 if fast_mode else 4,
            retry_rate_limit=not fast_mode,
            timeout=WB_FAST_TIMEOUT if fast_mode else None,
        )
        if data is None:
            continue
        discovered_ids.extend(_extract_campaign_ids(data))
        rows = _extract_wb_campaign_rows(data)
        if rows:
            return rows

    count_rows: list[dict[str, Any]] = []
    for method, endpoint, payload in (
        ("GET", "https://advert-api.wb.ru/adv/v1/promotion/count", None),
        ("POST", "https://advert-api.wb.ru/adv/v1/promotion/count", {}),
        ("GET", "https://advert-api.wildberries.ru/adv/v1/promotion/count", None),
        ("POST", "https://advert-api.wildberries.ru/adv/v1/promotion/count", {}),
    ):
        count_data = _request_wb_json(
            method,
            endpoint,
            api_key=api_key,
            payload=payload,
            max_attempts=1 if fast_mode else 4,
            retry_rate_limit=not fast_mode,
            timeout=WB_FAST_TIMEOUT if fast_mode else None,
        )
        if count_data is None:
            continue
        discovered_ids.extend(_extract_campaign_ids(count_data))
        parsed = _extract_campaign_rows_from_count_response(count_data)
        if parsed:
            count_rows = parsed
            break

    ids: list[int] = []
    ids.extend(discovered_ids)
    for row in count_rows:
        cid = _campaign_id_from_row(row)
        if not cid:
            continue
        try:
            ids.append(int(cid))
        except Exception:
            continue
    ids = sorted(set(ids))
    if not ids:
        return count_rows

    if not enrich:
        if count_rows:
            return count_rows
        return [{"advertId": cid} for cid in ids]

    details = _fetch_wb_campaign_details(api_key, ids)
    if details:
        return _enrich_wb_campaign_rows(api_key, details)
    if count_rows:
        return _enrich_wb_campaign_rows(api_key, count_rows)
    return _enrich_wb_campaign_rows(api_key, [{"advertId": cid} for cid in ids])


def _summary_needs_enrichment(summary: dict[str, Any] | None, campaign_id: int) -> bool:
    if not isinstance(summary, dict):
        return True
    text = str(summary.get("name") or "").strip().lower()
    status = str(summary.get("status") or "").strip()
    ctype = str(summary.get("type") or "").strip()
    budget = str(summary.get("budget") or "").strip()
    if not text:
        return True
    if text in {f"кампания {int(campaign_id or 0)}", "campaign", "advert", "ad"}:
        return True
    if text.startswith("кампания ") or text.startswith("campaign "):
        return True
    if status not in {"", "-", "вЂ”"}:
        return False
    if ctype not in {"", "-", "вЂ”"}:
        return False
    if budget not in {"", "-", "вЂ”"}:
        return False
    return True


def fetch_wb_campaign_summaries(
    api_key: str,
    campaign_ids: list[int],
    fallback_limit: int = 24,
    detail_lookup_limit: int = 8,
) -> dict[str, dict[str, Any]]:
    ids = sorted({int(x) for x in campaign_ids if int(x) > 0})
    if not ids:
        return {}

    out: dict[str, dict[str, Any]] = {}
    detail_map = _fetch_wb_campaign_detail_map(
        api_key,
        ids,
        single_lookup_limit=max(0, int(detail_lookup_limit or 0)),
    )
    for cid in ids:
        row = detail_map.get(str(cid))
        if row:
            out[str(cid)] = _extract_campaign_summary(row, cid)

    missing = [cid for cid in ids if _summary_needs_enrichment(out.get(str(cid), {}), cid)]
    for cid in missing[: max(0, int(fallback_limit))]:
        payload = fetch_wb_campaign_details(api_key=api_key, campaign_id=cid)
        summary = payload.get("summary") if isinstance(payload, dict) else None
        if isinstance(summary, dict):
            merged = _merge_campaign_summary(out.get(str(cid), {"campaign_id": cid}), summary)
            out[str(cid)] = merged
    return out


def fetch_wb_campaign_stats_bulk(
    api_key: str,
    campaign_ids: list[int],
    date_from: str | None = None,
    date_to: str | None = None,
    *,
    retry_unresolved: bool = True,
    fast_mode: bool = False,
) -> dict[str, dict[str, Any]]:
    ids = [int(x) for x in campaign_ids if int(x) > 0]
    ids = sorted(set(ids))
    if not ids:
        return {}

    left = _parse_iso_date(date_from) or (date.today() - timedelta(days=6))
    right = _parse_iso_date(date_to) or date.today()
    if left > right:
        left, right = right, left

    endpoints = [
        "https://advert-api.wb.ru/adv/v3/fullstats",
        "https://advert-api.wildberries.ru/adv/v3/fullstats",
    ]
    request_timeout = WB_FAST_TIMEOUT if fast_mode else WB_TIMEOUT
    request_attempts = 2 if fast_mode else 4

    def _request_stats_chunk(chunk_ids: list[int]) -> list[dict[str, Any]]:
        safe_chunk = [int(x) for x in chunk_ids if int(x) > 0]
        if not safe_chunk:
            return []
        ids_csv = ",".join(str(x) for x in safe_chunk)
        for endpoint in endpoints:
            params = {"ids": ids_csv, "beginDate": left.isoformat(), "endDate": right.isoformat()}
            data = _request_wb_json(
                "GET",
                endpoint,
                api_key=api_key,
                params=params,
                max_attempts=request_attempts,
                timeout=request_timeout,
            )
            dict_rows = _as_dict_list(data) if data is not None else []
            if dict_rows:
                return dict_rows

            payload_variants: list[dict[str, Any]] = [
                {"ids": safe_chunk, "from": left.isoformat(), "to": right.isoformat()},
                {"id": safe_chunk, "from": left.isoformat(), "to": right.isoformat()},
                {"advertIds": safe_chunk, "from": left.isoformat(), "to": right.isoformat()},
                {"ids": safe_chunk, "beginDate": left.isoformat(), "endDate": right.isoformat()},
                {"advertIds": safe_chunk, "beginDate": left.isoformat(), "endDate": right.isoformat()},
            ]
            for payload in payload_variants:
                pdata = _request_wb_json(
                    "POST",
                    endpoint,
                    api_key=api_key,
                    payload=payload,
                    max_attempts=request_attempts,
                    timeout=request_timeout,
                )
                dict_rows = _as_dict_list(pdata) if pdata is not None else []
                if dict_rows:
                    return dict_rows
        return []

    rows: list[dict[str, Any]] = []
    chunk_size = 50
    for chunk_start in range(0, len(ids), chunk_size):
        chunk = ids[chunk_start:chunk_start + chunk_size]
        rows.extend(_request_stats_chunk(chunk))

    stats: dict[str, dict[str, Any]] = {}
    for row in rows:
        cid = _campaign_id_from_row(row)
        if not cid:
            for key in ("advertId", "advert_id", "campaignId", "campaign_id", "id"):
                cval = _to_int(row.get(key))
                if cval:
                    cid = str(cval)
                    break
        if not cid:
            continue
        stats[cid] = _build_campaign_stat_row(row)

    if not retry_unresolved:
        return stats

    unresolved_ids = [cid for cid in ids if not bool((stats.get(str(cid)) or {}).get("stat_has_context"))]
    retry_limit = 18 if len(ids) > 180 else (28 if len(ids) > 80 else 40)
    for retry_start in range(0, min(len(unresolved_ids), retry_limit), 6):
        retry_chunk = unresolved_ids[retry_start:retry_start + 6]
        retry_rows = _request_stats_chunk(retry_chunk)
        for row in retry_rows:
            cid = _campaign_id_from_row(row)
            if not cid:
                continue
            stats[cid] = _build_campaign_stat_row(row)
        if retry_rows:
            unresolved_ids = [cid for cid in ids if not bool((stats.get(str(cid)) or {}).get("stat_has_context"))]
            if not unresolved_ids:
                break
        time.sleep(0.18)
    return stats

def _fetch_wb_campaign_details(api_key: str, campaign_ids: list[int]) -> list[dict[str, Any]]:
    endpoints = [
        "https://advert-api.wb.ru/adv/v1/promotion/adverts",
        "https://advert-api.wildberries.ru/adv/v1/promotion/adverts",
        "https://advert-api.wb.ru/adv/v0/advert",
        "https://advert-api.wildberries.ru/adv/v0/advert",
    ]
    payloads: list[list[int] | dict[str, Any]] = [
        campaign_ids,
        {"ids": campaign_ids},
        {"advertIds": campaign_ids},
        {"campaignIds": campaign_ids},
        {"advert_list": campaign_ids},
        {"id": campaign_ids},
    ]
    for endpoint in endpoints:
        for payload in payloads:
            data = _request_wb_json("POST", endpoint, api_key=api_key, payload=payload)
            if data is None:
                continue
            rows = _extract_wb_campaign_rows(data)
            if rows:
                return rows
    return []


def _fetch_wb_campaigns_v2_info(api_key: str, campaign_ids: list[int]) -> list[dict[str, Any]]:
    ids = [int(x) for x in campaign_ids if int(x) > 0]
    ids = sorted(set(ids))
    if not ids:
        return []

    endpoints = [
        "https://advert-api.wildberries.ru/api/advert/v2/adverts",
        "https://advert-api.wb.ru/api/advert/v2/adverts",
    ]
    rows: list[dict[str, Any]] = []
    for start in range(0, len(ids), 50):
        chunk = ids[start:start + 50]
        ids_csv = ",".join(str(x) for x in chunk)
        for endpoint in endpoints:
            data = _request_wb_json("GET", endpoint, api_key=api_key, params={"ids": ids_csv})
            parsed = _extract_wb_campaign_rows(data) if data is not None else []
            if parsed:
                rows.extend(parsed)
                break
    return rows


def _enrich_wb_campaign_rows(api_key: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not rows:
        return []
    ids: list[int] = []
    for row in rows:
        cid = _campaign_id_from_row(row)
        if not cid:
            continue
        try:
            ids.append(int(cid))
        except Exception:
            continue
    if not ids:
        return rows

    detail_map = _fetch_wb_campaign_detail_map(api_key, sorted(set(ids)))
    if not detail_map:
        return rows

    merged: list[dict[str, Any]] = []
    for row in rows:
        cid = _campaign_id_from_row(row)
        details = detail_map.get(cid) or {}
        if details:
            merged_row = dict(details)
            merged_row.update({k: v for k, v in row.items() if v not in (None, "", [], {})})
            merged.append(merged_row)
        else:
            merged.append(row)
    return merged


def _fetch_wb_campaign_detail_map(
    api_key: str,
    ids: list[int],
    single_lookup_limit: int | None = None,
) -> dict[str, dict[str, Any]]:
    detail_map: dict[str, dict[str, Any]] = {}
    if not ids:
        return detail_map

    v2_rows = _fetch_wb_campaigns_v2_info(api_key, ids)
    for row in v2_rows:
        cid = _campaign_id_from_row(row)
        if cid:
            detail_map[cid] = _merge_detail_rows(detail_map.get(cid), row)

    batch_data = _fetch_wb_campaign_details(api_key, ids)
    for row in batch_data:
        cid = _campaign_id_from_row(row)
        if cid:
            detail_map[cid] = _merge_detail_rows(detail_map.get(cid), row)

    get_detail_endpoints = [
        "https://advert-api.wb.ru/adv/v0/advert",
        "https://advert-api.wildberries.ru/adv/v0/advert",
    ]
    post_detail_endpoints = [
        "https://advert-api.wb.ru/adv/v0/advert",
        "https://advert-api.wildberries.ru/adv/v0/advert",
        "https://advert-api.wb.ru/adv/v1/promotion/adverts",
        "https://advert-api.wildberries.ru/adv/v1/promotion/adverts",
    ]
    if single_lookup_limit is None:
        if len(ids) <= 12:
            safe_single_lookup_limit = len(ids)
        elif len(ids) <= 48:
            safe_single_lookup_limit = min(len(ids), 12)
        elif len(ids) <= 180:
            safe_single_lookup_limit = min(len(ids), 8)
        else:
            safe_single_lookup_limit = min(len(ids), 4)
    else:
        safe_single_lookup_limit = max(0, min(len(ids), int(single_lookup_limit)))

    for cid in ids[:safe_single_lookup_limit]:
        text_id = str(cid)
        if text_id in detail_map and _has_campaign_context(detail_map[text_id]):
            continue

        for endpoint in get_detail_endpoints:
            for param_key in ("id", "advertId", "campaignId", "advert_id"):
                data = _request_wb_json("GET", endpoint, api_key=api_key, params={param_key: cid})
                if data is None:
                    continue
                rows = _extract_wb_campaign_rows(data)
                if not rows and isinstance(data, dict):
                    rows = [data]
                for row in rows:
                    candidate = dict(row)
                    if not _campaign_id_from_row(candidate):
                        candidate["advertId"] = cid
                    rcid = _campaign_id_from_row(candidate)
                    if rcid:
                        detail_map[rcid] = _merge_detail_rows(detail_map.get(rcid), candidate)
                if text_id in detail_map and _has_campaign_context(detail_map[text_id]):
                    break
            if text_id in detail_map and _has_campaign_context(detail_map[text_id]):
                break

        if text_id in detail_map and _has_campaign_context(detail_map[text_id]):
            continue

        payload_templates: list[list[int] | dict[str, Any]] = [
            [cid],
            {"id": cid},
            {"advertId": cid},
            {"campaignId": cid},
            {"ids": [cid]},
            {"advertIds": [cid]},
            {"campaignIds": [cid]},
        ]
        for endpoint in post_detail_endpoints:
            for payload in payload_templates:
                data = _request_wb_json("POST", endpoint, api_key=api_key, payload=payload)
                if data is None:
                    continue
                rows = _extract_wb_campaign_rows(data)
                if not rows and isinstance(data, dict):
                    rows = [data]
                for row in rows:
                    candidate = dict(row)
                    if not _campaign_id_from_row(candidate):
                        candidate["advertId"] = cid
                    rcid = _campaign_id_from_row(candidate)
                    if rcid:
                        detail_map[rcid] = _merge_detail_rows(detail_map.get(rcid), candidate)
                if text_id in detail_map and _has_campaign_context(detail_map[text_id]):
                    break
            if text_id in detail_map and _has_campaign_context(detail_map[text_id]):
                break
    return detail_map


def fetch_wb_campaign_rates(
    api_key: str,
    campaign_id: int,
    campaign_type: str,
    *,
    fast_mode: bool = False,
) -> dict[str, Any] | None:
    ctype = (campaign_type or "").strip().lower()
    if ctype == "search":
        endpoints = [
            f"https://advert-api.wildberries.ru/adv/v1/search/{campaign_id}/rates",
            f"https://advert-api.wb.ru/adv/v1/search/{campaign_id}/rates",
        ]
    elif ctype == "auto-cpm":
        endpoints = [
            f"https://advert-api.wildberries.ru/adv/v1/auto-cpm/{campaign_id}/rates",
            f"https://advert-api.wb.ru/adv/v1/auto-cpm/{campaign_id}/rates",
        ]
    else:
        return None
    if fast_mode:
        endpoints = endpoints[:1]
    for endpoint in endpoints:
        data = _request_wb_json(
            "GET",
            endpoint,
            api_key=api_key,
            max_attempts=1 if fast_mode else 2,
            retry_rate_limit=not fast_mode,
            timeout=WB_FAST_TIMEOUT if fast_mode else WB_TIMEOUT,
        )
        if isinstance(data, dict):
            return data
    return None


def fetch_wb_normquery_bids(
    api_key: str,
    items: list[dict[str, int]],
) -> dict[str, Any]:
    safe_items: list[dict[str, int]] = []
    seen: set[tuple[int, int]] = set()
    for raw in items:
        advert_id = _to_int((raw or {}).get("advert_id"))
        nm_id = _to_int((raw or {}).get("nm_id"))
        if not advert_id or not nm_id:
            continue
        key = (advert_id, nm_id)
        if key in seen:
            continue
        seen.add(key)
        safe_items.append({"advert_id": advert_id, "nm_id": nm_id})
    if not safe_items:
        return {"items": [], "ok": False, "reason": "empty_items"}

    endpoints = [
        "https://advert-api.wb.ru/adv/v0/normquery/get-bids",
        "https://advert-api.wildberries.ru/adv/v0/normquery/get-bids",
    ]
    safe_payload_items = safe_items[:100]
    alt_items = [
        {
            "advertId": int(x.get("advert_id") or 0),
            "nmId": int(x.get("nm_id") or 0),
        }
        for x in safe_payload_items
        if int(x.get("advert_id") or 0) > 0 and int(x.get("nm_id") or 0) > 0
    ]
    payload_variants: list[dict[str, Any] | list[dict[str, Any]]] = [
        {"items": safe_payload_items},
    ]
    if alt_items:
        payload_variants.append({"items": alt_items})
    payload_variants.append(safe_payload_items)
    if alt_items:
        payload_variants.append(alt_items)
    for endpoint in endpoints:
        for payload in payload_variants:
            data = _request_wb_json("POST", endpoint, api_key=api_key, payload=payload)
            rows = _extract_first_dict_list(data, preferred_keys=("items", "bids", "rows", "result", "data", "list"))
            if rows:
                return {"items": rows, "ok": True, "source": endpoint}
    return {"items": [], "ok": False, "reason": "api_failed"}


def set_wb_normquery_bids(
    api_key: str,
    bids: list[dict[str, Any]],
) -> dict[str, Any]:
    safe_rows: list[dict[str, Any]] = []
    for raw in bids:
        advert_id = _to_int((raw or {}).get("advert_id"))
        nm_id = _to_int((raw or {}).get("nm_id"))
        norm_query = str(
            (raw or {}).get("norm_query")
            or (raw or {}).get("normquery")
            or (raw or {}).get("query")
            or (raw or {}).get("keyword")
            or ""
        ).strip()
        bid = _to_int((raw or {}).get("bid"))
        if not advert_id or not nm_id or not norm_query or bid is None:
            continue
        safe_rows.append(
            {
                "advert_id": advert_id,
                "nm_id": nm_id,
                "norm_query": norm_query,
                "bid": max(1, bid),
            }
        )
    if not safe_rows:
        return {"ok": False, "reason": "empty_bids"}

    endpoints = [
        "https://advert-api.wb.ru/adv/v0/normquery/bids",
        "https://advert-api.wildberries.ru/adv/v0/normquery/bids",
    ]
    base_rows = safe_rows[:100]
    alt_rows = [
        {
            "advertId": int(x.get("advert_id") or 0),
            "nmId": int(x.get("nm_id") or 0),
            "normquery": str(x.get("norm_query") or ""),
            "normQuery": str(x.get("norm_query") or ""),
            "bid": int(x.get("bid") or 0),
            "cpm": int(x.get("bid") or 0),
        }
        for x in base_rows
    ]
    payload_variants: list[dict[str, Any] | list[dict[str, Any]]] = [
        {"bids": base_rows},
        {"items": base_rows},
    ]
    if alt_rows:
        payload_variants.append({"bids": alt_rows})
        payload_variants.append({"items": alt_rows})
    payload_variants.append(base_rows)
    if alt_rows:
        payload_variants.append(alt_rows)
    for endpoint in endpoints:
        for payload in payload_variants:
            data = _request_wb_json("POST", endpoint, api_key=api_key, payload=payload)
            if data is not None:
                return {"ok": True, "data": data, "source": endpoint}
    return {"ok": False, "reason": "api_failed"}


def fetch_wb_normquery_stats(
    api_key: str,
    items: list[dict[str, int]],
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, Any]:
    safe_items: list[dict[str, int]] = []
    seen: set[tuple[int, int]] = set()
    for raw in items:
        advert_id = _to_int((raw or {}).get("advert_id"))
        nm_id = _to_int((raw or {}).get("nm_id"))
        if not advert_id or not nm_id:
            continue
        key = (advert_id, nm_id)
        if key in seen:
            continue
        seen.add(key)
        safe_items.append({"advert_id": advert_id, "nm_id": nm_id})
    if not safe_items:
        return {"items": [], "ok": False, "reason": "empty_items"}

    left = _parse_iso_date(date_from) or (date.today() - timedelta(days=1))
    right = _parse_iso_date(date_to) or date.today()
    if left > right:
        left, right = right, left
    safe_payload_items = safe_items[:100]
    alt_items = [
        {
            "advertId": int(x.get("advert_id") or 0),
            "nmId": int(x.get("nm_id") or 0),
        }
        for x in safe_payload_items
        if int(x.get("advert_id") or 0) > 0 and int(x.get("nm_id") or 0) > 0
    ]
    payload_variants: list[dict[str, Any] | list[dict[str, Any]]] = [
        {
            "date_from": left.isoformat(),
            "date_to": right.isoformat(),
            "items": safe_payload_items,
        },
        {
            "dateFrom": left.isoformat(),
            "dateTo": right.isoformat(),
            "items": safe_payload_items,
        },
        {
            "period": {"from": left.isoformat(), "to": right.isoformat()},
            "items": safe_payload_items,
        },
    ]
    if alt_items:
        payload_variants.extend(
            [
                {"date_from": left.isoformat(), "date_to": right.isoformat(), "items": alt_items},
                {"dateFrom": left.isoformat(), "dateTo": right.isoformat(), "items": alt_items},
            ]
        )
    endpoints = [
        "https://advert-api.wb.ru/adv/v0/normquery/stats",
        "https://advert-api.wildberries.ru/adv/v0/normquery/stats",
        "https://advert-api.wb.ru/adv/v1/normquery/stats",
        "https://advert-api.wildberries.ru/adv/v1/normquery/stats",
    ]
    for endpoint in endpoints:
        for payload in payload_variants:
            data = _request_wb_json("POST", endpoint, api_key=api_key, payload=payload)
            rows = _extract_first_dict_list(data, preferred_keys=("stats", "items", "rows", "result", "data", "list"))
            if rows:
                return {"items": rows, "ok": True, "source": endpoint}
    return {"items": [], "ok": False, "reason": "api_failed"}


def fetch_wb_nm_bids(
    api_key: str,
    items: list[dict[str, Any]],
) -> dict[str, Any]:
    grouped: dict[int, list[dict[str, Any]]] = {}
    for raw in items:
        advert_id = _to_int((raw or {}).get("advert_id"))
        nm_id = _to_int((raw or {}).get("nm_id"))
        placement = str((raw or {}).get("placement") or "").strip().lower()
        if not advert_id or not nm_id:
            continue
        if placement not in {"search", "recommendations", "recommendation", "combined"}:
            placement = "search"
        grouped.setdefault(advert_id, []).append(
            {
                "nm_id": int(nm_id),
                "placement": "recommendations" if placement == "recommendation" else placement,
            }
        )
    if not grouped:
        return {"ok": False, "reason": "empty_items", "bids": []}

    payload = {
        "bids": [
            {
                "advert_id": int(advert_id),
                "nm_bids": items[:50],
            }
            for advert_id, items in grouped.items()
        ][:100]
    }
    endpoints = [
        "https://advert-api.wb.ru/api/advert/v1/bids",
        "https://advert-api.wildberries.ru/api/advert/v1/bids",
    ]
    for endpoint in endpoints:
        data = _request_wb_json("POST", endpoint, api_key=api_key, payload=payload)
        if isinstance(data, dict):
            rows = _extract_first_dict_list(data, preferred_keys=("bids", "items", "rows", "result", "data", "list"))
            if rows:
                return {"ok": True, "bids": rows, "source": endpoint}
        elif isinstance(data, list):
            rows = _as_dict_list(data)
            if rows:
                return {"ok": True, "bids": rows, "source": endpoint}
    return {"ok": False, "reason": "api_failed", "bids": []}


def fetch_wb_min_nm_bids(
    api_key: str,
    *,
    advert_id: int,
    nm_ids: list[int],
    payment_type: str = "cpm",
    placement_types: list[str] | None = None,
) -> dict[str, Any]:
    safe_nm_ids = sorted({int(x) for x in nm_ids if int(x) > 0})[:100]
    if advert_id <= 0 or not safe_nm_ids:
        return {"ok": False, "reason": "empty_items", "bids": []}
    placements = [str(x or "").strip().lower() for x in (placement_types or ["search", "recommendation"])]
    normalized_placements = [x for x in placements if x in {"combined", "search", "recommendation"}]
    if not normalized_placements:
        normalized_placements = ["search", "recommendation"]
    safe_payment_type = "cpc" if str(payment_type or "").strip().lower() == "cpc" else "cpm"
    payload = {
        "advert_id": int(advert_id),
        "nm_ids": safe_nm_ids,
        "payment_type": safe_payment_type,
        "placement_types": normalized_placements,
    }
    endpoints = [
        "https://advert-api.wb.ru/api/advert/v1/bids/min",
        "https://advert-api.wildberries.ru/api/advert/v1/bids/min",
        "https://advert-api.wb.ru/adv/v0/bids/min",
        "https://advert-api.wildberries.ru/adv/v0/bids/min",
    ]
    for endpoint in endpoints:
        data = _request_wb_json("POST", endpoint, api_key=api_key, payload=payload)
        if isinstance(data, dict):
            rows = _extract_first_dict_list(data, preferred_keys=("bids", "items", "rows", "result", "data", "list"))
            if rows:
                return {"ok": True, "bids": rows, "source": endpoint}
        elif isinstance(data, list):
            rows = _as_dict_list(data)
            if rows:
                return {"ok": True, "bids": rows, "source": endpoint}
    return {"ok": False, "reason": "api_failed", "bids": []}


def set_wb_nm_bids(
    api_key: str,
    bids: list[dict[str, Any]],
) -> dict[str, Any]:
    safe: list[dict[str, Any]] = []
    grouped: dict[int, list[dict[str, Any]]] = {}
    for raw in bids:
        advert_id = _to_int((raw or {}).get("advert_id"))
        nm_id = _to_int((raw or {}).get("nm_id"))
        bid_kopecks = _to_int((raw or {}).get("bid_kopecks"))
        placement = str((raw or {}).get("placement") or "").strip().lower()
        if not advert_id or not nm_id or bid_kopecks is None:
            continue
        if placement not in {"search", "recommendations", "recommendation", "combined"}:
            placement = "search"
        if placement == "recommendation":
            placement = "recommendations"
        item = {
            "nm_id": nm_id,
            "bid_kopecks": max(1, bid_kopecks),
            "placement": placement,
        }
        safe.append({"advert_id": advert_id, **item})
        grouped.setdefault(advert_id, []).append(item)
    if not safe:
        return {"ok": False, "reason": "empty_bids"}

    payload_variants: list[dict[str, Any]] = []
    for advert_id, items in grouped.items():
        payload_variants.append({"bids": [{"advert_id": advert_id, "nm_bids": items[:50]}]})
        payload_variants.append(
            {
                "bids": [
                    {
                        "advert_id": advert_id,
                        "nm_bids": [
                            {
                                "nm_id": int(item.get("nm_id") or 0),
                                "bid": int(item.get("bid_kopecks") or 0),
                                "placement": str(item.get("placement") or "search"),
                            }
                            for item in items[:50]
                            if int(item.get("nm_id") or 0) > 0
                        ],
                    }
                ]
            }
        )
    payload_variants.append({"bids": safe[:50]})

    endpoints = [
        "https://advert-api.wb.ru/api/advert/v1/bids",
        "https://advert-api.wildberries.ru/api/advert/v1/bids",
    ]
    for endpoint in endpoints:
        for payload in payload_variants:
            data = _request_wb_json("PATCH", endpoint, api_key=api_key, payload=payload)
            if data is not None:
                return {"ok": True, "data": data, "source": endpoint}
    return {"ok": False, "reason": "api_failed"}


def fetch_wb_ads_balance(api_key: str) -> dict[str, Any] | None:
    endpoints = [
        "https://advert-api.wb.ru/adv/v1/balance",
        "https://advert-api.wildberries.ru/adv/v1/balance",
    ]
    for endpoint in endpoints:
        data = _request_wb_json("GET", endpoint, api_key=api_key)
        if isinstance(data, dict):
            return data
    return None


def fetch_wb_campaign_stats(
    api_key: str,
    campaign_id: int,
    days: int = 7,
    *,
    fast_mode: bool = False,
) -> dict[str, Any] | None:
    end_date = date.today()
    safe_days = max(1, min(days, 30))
    begin_date = end_date - timedelta(days=safe_days - 1)

    params_variants: list[dict[str, Any]] = [
        {
            "ids": str(campaign_id),
            "beginDate": begin_date.isoformat(),
            "endDate": end_date.isoformat(),
        },
    ]
    payload_variants: list[dict[str, Any]] = [
        {"id": campaign_id, "from": begin_date.isoformat(), "to": end_date.isoformat()},
        {"id": [campaign_id], "from": begin_date.isoformat(), "to": end_date.isoformat()},
        {"ids": [campaign_id], "from": begin_date.isoformat(), "to": end_date.isoformat()},
        {"advertId": campaign_id, "from": begin_date.isoformat(), "to": end_date.isoformat()},
    ]

    endpoints = [
        "https://advert-api.wildberries.ru/adv/v3/fullstats",
        "https://advert-api.wb.ru/adv/v3/fullstats",
    ]
    if fast_mode:
        payload_variants = []
        endpoints = endpoints[:1]
    for endpoint in endpoints:
        for params in params_variants:
            data = _request_wb_json(
                "GET",
                endpoint,
                api_key=api_key,
                params=params,
                max_attempts=1 if fast_mode else 2,
                retry_rate_limit=not fast_mode,
                timeout=WB_FAST_TIMEOUT if fast_mode else WB_TIMEOUT,
            )
            if isinstance(data, dict):
                return data
            if isinstance(data, list):
                return {"items": data}
        for payload in payload_variants:
            data = _request_wb_json(
                "POST",
                endpoint,
                api_key=api_key,
                payload=payload,
                max_attempts=1 if fast_mode else 2,
                retry_rate_limit=not fast_mode,
                timeout=WB_FAST_TIMEOUT if fast_mode else WB_TIMEOUT,
            )
            if isinstance(data, dict):
                return data
            if isinstance(data, list):
                return {"items": data}
    return None


def update_wb_campaign_state(api_key: str, campaign_id: int, action: str) -> tuple[bool, str, dict[str, Any] | None]:
    operation = (action or "").strip().lower()
    endpoint_map = {
        "start": "https://advert-api.wb.ru/adv/v0/start",
        "pause": "https://advert-api.wb.ru/adv/v0/pause",
        "stop": "https://advert-api.wb.ru/adv/v0/stop",
    }
    endpoint = endpoint_map.get(operation)
    if not endpoint:
        return False, "Неизвестное действие. Используйте start, pause или stop.", None

    payloads: list[dict[str, Any] | list[int]] = [
        [campaign_id],
        {"id": campaign_id},
        {"ids": [campaign_id]},
        {"advertId": campaign_id},
        {"advertIds": [campaign_id]},
        {"campaignId": campaign_id},
    ]
    for payload in payloads:
        data = _request_wb_json("POST", endpoint, api_key=api_key, payload=payload)
        if data is not None:
            return True, "Операция отправлена", data if isinstance(data, dict) else {"raw": data}
    return False, "Не удалось выполнить операцию в API WB", None


def _campaign_detail_requests(campaign_id: int) -> list[dict[str, Any]]:
    return [
        {"method": "GET", "endpoint": "https://advert-api.wildberries.ru/api/advert/v2/adverts", "params": {"ids": str(campaign_id)}},
        {"method": "GET", "endpoint": "https://advert-api.wb.ru/api/advert/v2/adverts", "params": {"ids": str(campaign_id)}},
        {"method": "GET", "endpoint": "https://advert-api.wb.ru/adv/v0/advert", "params": {"id": campaign_id}},
        {"method": "GET", "endpoint": "https://advert-api.wildberries.ru/adv/v0/advert", "params": {"id": campaign_id}},
        {"method": "GET", "endpoint": "https://advert-api.wb.ru/adv/v0/advert", "params": {"advertId": campaign_id}},
        {"method": "GET", "endpoint": "https://advert-api.wildberries.ru/adv/v0/advert", "params": {"advertId": campaign_id}},
        {"method": "POST", "endpoint": "https://advert-api.wb.ru/adv/v1/promotion/adverts", "payload": [campaign_id]},
        {"method": "POST", "endpoint": "https://advert-api.wildberries.ru/adv/v1/promotion/adverts", "payload": [campaign_id]},
        {"method": "POST", "endpoint": "https://advert-api.wb.ru/adv/v1/promotion/adverts", "payload": {"ids": [campaign_id]}},
        {"method": "POST", "endpoint": "https://advert-api.wildberries.ru/adv/v1/promotion/adverts", "payload": {"ids": [campaign_id]}},
        {"method": "POST", "endpoint": "https://advert-api.wb.ru/adv/v1/promotion/adverts", "payload": {"advertIds": [campaign_id]}},
        {"method": "POST", "endpoint": "https://advert-api.wildberries.ru/adv/v1/promotion/adverts", "payload": {"advertIds": [campaign_id]}},
    ]


def _merge_detail_rows(base: dict[str, Any] | None, extra: dict[str, Any] | None) -> dict[str, Any]:
    left = dict(base or {}) if isinstance(base, dict) else {}
    right = dict(extra or {}) if isinstance(extra, dict) else {}
    if not left:
        return right
    if not right:
        return left
    out = dict(left)
    for key, value in right.items():
        if value in (None, "", [], {}):
            continue
        if isinstance(value, str):
            text = value.strip()
            if not text or text in {"-", "вЂ”"}:
                continue
        out[key] = value
    return out


def _merge_campaign_summary(base: dict[str, Any], extra: dict[str, Any]) -> dict[str, Any]:
    def _is_placeholder_name(value: Any) -> bool:
        text = str(value or "").strip().lower()
        if not text or text == "-":
            return True
        return text.startswith("кампания ") or text.startswith("campaign ")

    merged = dict(base)
    for key, value in extra.items():
        if value in (None, "", "-", [], {}):
            continue
        if key == "name" and _is_placeholder_name(merged.get("name")) and not _is_placeholder_name(value):
            merged[key] = value
            continue
        if key not in merged or merged.get(key) in (None, "", "-", [], {}):
            merged[key] = value
            continue
        if key == "raw_rows":
            keep = list(merged.get(key) or [])
            for row in value if isinstance(value, list) else []:
                if row not in keep:
                    keep.append(row)
            merged[key] = keep
    return merged


_WB_MOJIBAKE_CAMPAIGN_MARKERS = (
    "\u0420\u00a0",
    "\u0420\u00b0",
    "\u0420\u00b1",
    "\u0420\u2019",
    "\u0420\u040e",
    "\u0420\u045e",
    "\u0420\u0402",
    "\u0420\u0452",
    "\u0420\u0409",
    "\u0420\u040b",
    "\u0421\u0403",
    "\u0421\u0453",
    "\u0421\u201a",
    "\u00d0",
    "\u00d1",
    "\u00c3",
    "\u00e2\u20ac",
    "\ufffd",
)
_WB_MOJIBAKE_CAMPAIGN_PAIR_RE = re.compile(
    r"(?:\u0420[\u00a0-\u00bf\u0402-\u040f\u0452-\u045f]|\u0421[\u00a0-\u00bf\u0402-\u040f\u0452-\u045f]|\u00d0.|\u00d1.)"
)


def _is_mojibake_campaign_text(value: Any) -> bool:
    text = str(value or "").strip()
    if not text:
        return False
    if any(marker in text for marker in _WB_MOJIBAKE_CAMPAIGN_MARKERS):
        return True
    return len(_WB_MOJIBAKE_CAMPAIGN_PAIR_RE.findall(text)) >= 2


def _extract_campaign_summary(data: dict[str, Any] | list[dict[str, Any]], campaign_id: int) -> dict[str, Any]:
    campaign_id_text = str(campaign_id)
    rows = _extract_wb_campaign_rows(data)
    target_row: dict[str, Any] = {}
    for row in rows:
        if _campaign_id_from_row(row) == campaign_id_text:
            target_row = row
            break
    if not target_row and isinstance(data, dict) and _campaign_id_from_row(data) == campaign_id_text:
        target_row = data
    if not target_row and rows:
        target_row = rows[0]

    summary: dict[str, Any] = {"campaign_id": campaign_id}
    if not target_row:
        return summary

    settings = target_row.get("settings") if isinstance(target_row.get("settings"), dict) else {}
    timestamps = target_row.get("timestamps") if isinstance(target_row.get("timestamps"), dict) else {}
    finance = target_row.get("finance") if isinstance(target_row.get("finance"), dict) else {}

    name_candidates = [
        _pick_first_str(target_row.get("name")),
        _pick_first_str(target_row.get("campaignName")),
        _pick_first_str(target_row.get("campaign_name")),
        _pick_first_str(target_row.get("advertName")),
        _pick_first_str(target_row.get("advert_name")),
        _pick_first_str(target_row.get("advertTitle")),
        _pick_first_str(target_row.get("campaignTitle")),
        _pick_first_str(settings.get("name")),
        _pick_first_str(settings.get("title")),
        _pick_first_str(settings.get("campaign_name")),
        _pick_first_str(settings.get("advert_name")),
        _pick_first_str(target_row.get("subject")),
        _pick_first_str(target_row.get("title")),
    ]
    name = ""
    for candidate in name_candidates:
        text = _repair_mojibake_text(candidate).strip()
        if not text:
            continue
        if _is_mojibake_campaign_text(text):
            continue
        low = text.lower()
        if low.startswith("\u043a\u0430\u043c\u043f\u0430\u043d\u0438\u044f ") or low.startswith("campaign "):
            if not name:
                name = text
            continue
        name = text
        break
    status = _pick_first_str(
        target_row.get("status"),
        target_row.get("state"),
        target_row.get("statusName"),
        settings.get("status"),
    )
    ctype = _pick_first_str(
        target_row.get("type"),
        target_row.get("campaignType"),
        target_row.get("adType"),
        target_row.get("advertType"),
        target_row.get("typeName"),
        target_row.get("type_name"),
        target_row.get("bid_type"),
        settings.get("bid_type"),
        settings.get("type"),
    )
    budget = _pick_first_str(
        target_row.get("dailyBudget"),
        target_row.get("budget"),
        target_row.get("sum"),
        target_row.get("dailyBudgetTotal"),
        target_row.get("daily_sum_limit"),
        target_row.get("balance"),
        finance.get("budget"),
        finance.get("dailyBudget"),
        settings.get("budget"),
        settings.get("dailyBudget"),
    )
    created_at = _pick_first_str(
        target_row.get("createTime"),
        target_row.get("createdAt"),
        target_row.get("created_at"),
        target_row.get("startTime"),
        target_row.get("start_at"),
        timestamps.get("created"),
        settings.get("createdAt"),
    )
    updated_at = _pick_first_str(
        target_row.get("changeTime"),
        target_row.get("updatedAt"),
        target_row.get("updated_at"),
        timestamps.get("updated"),
        settings.get("updatedAt"),
    )
    summary.update(
        {
            "name": name or f"Кампания {campaign_id}",
            "status": status or "-",
            "type": ctype or "-",
            "budget": budget or "-",
            "created_at": created_at,
            "updated_at": updated_at,
            "raw_rows": [target_row],
        }
    )
    return summary


def _extract_campaign_products(values: list[Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(row: dict[str, Any]):
        nm_id = _to_int(row.get("nmId") or row.get("nm_id") or row.get("nmid") or row.get("nm"))
        offer = _pick_first_str(row.get("offerId"), row.get("offer_id"), row.get("sku"), row.get("article"), row.get("vendorCode"))
        title = _pick_first_str(row.get("name"), row.get("title"), row.get("subject"), row.get("subjectName"), row.get("productName"))
        marker = f"{nm_id or 0}:{offer}:{title}"
        if marker in seen:
            return
        seen.add(marker)
        out: dict[str, Any] = {}
        if nm_id:
            out["nmId"] = nm_id
        if offer:
            out["offer"] = offer
        if title:
            out["name"] = title
        if out:
            rows.append(out)

    def walk(value: Any, parent_key: str = ""):
        if isinstance(value, list):
            if parent_key.lower() in {"nms", "nm_ids", "nmidlist", "nmlist", "products", "cards", "goods"}:
                for item in value:
                    nm_id = _to_int(item)
                    if nm_id:
                        add({"nmId": nm_id})
            for item in value:
                walk(item, parent_key=parent_key)
            return
        if isinstance(value, dict):
            keys = {str(k).lower() for k in value.keys()}
            if keys.intersection({"nm", "nmid", "nm_id", "offerid", "offer_id", "sku", "article", "vendorcode"}):
                add(value)
            for k, nested in value.items():
                walk(nested, parent_key=str(k))

    for value in values:
        walk(value)
    return rows[:500]


def _fetch_reviews_by_answer_state(
    api_key: str,
    is_answered: bool,
    stars: int | None,
    max_pages: int = 12,
    include_archive: bool = False,
) -> list[dict[str, Any]]:
    endpoints = ["https://feedbacks-api.wildberries.ru/api/v1/feedbacks"]
    if include_archive:
        endpoints.append("https://feedbacks-api.wildberries.ru/api/v1/feedbacks/archive")
    all_rows: list[dict[str, Any]] = []
    for endpoint in endpoints:
        rows = _fetch_wb_feedback_rows(api_key, endpoint=endpoint, is_answered=is_answered, stars=stars, max_pages=max_pages)
        if rows:
            all_rows.extend(rows)
    return _dedupe_review_rows(all_rows)


def _fetch_reviews_mixed(
    api_key: str,
    stars: int | None,
    max_pages: int = 12,
    include_archive: bool = True,
) -> list[dict[str, Any]]:
    endpoints = ["https://feedbacks-api.wildberries.ru/api/v1/feedbacks"]
    if include_archive:
        endpoints.append("https://feedbacks-api.wildberries.ru/api/v1/feedbacks/archive")
    rows: list[dict[str, Any]] = []
    for endpoint in endpoints:
        rows.extend(_fetch_wb_feedback_rows(api_key, endpoint=endpoint, is_answered=None, stars=stars, max_pages=max_pages))
    return _dedupe_review_rows(rows)


def _fetch_wb_questions_by_answer_state(
    api_key: str,
    is_answered: bool,
    stars: int | None,
    max_pages: int = 12,
    include_archive: bool = False,
) -> list[dict[str, Any]]:
    # WB does not expose a separate questions/archive endpoint. Answered and
    # archived questions are returned from the same endpoint with isAnswered=true.
    endpoints = ["https://feedbacks-api.wildberries.ru/api/v1/questions"]
    all_rows: list[dict[str, Any]] = []
    for endpoint in endpoints:
        rows = _fetch_wb_question_rows(api_key, endpoint=endpoint, is_answered=is_answered, stars=stars, max_pages=max_pages)
        if rows:
            all_rows.extend(rows)
    return _dedupe_review_rows(all_rows)


def _fetch_wb_questions_mixed(
    api_key: str,
    stars: int | None,
    max_pages: int = 12,
    include_archive: bool = True,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    endpoint = "https://feedbacks-api.wildberries.ru/api/v1/questions"
    rows.extend(_fetch_wb_question_rows(api_key, endpoint=endpoint, is_answered=False, stars=stars, max_pages=max_pages))
    rows.extend(_fetch_wb_question_rows(api_key, endpoint=endpoint, is_answered=True, stars=stars, max_pages=max_pages))
    return _dedupe_review_rows(rows)


def _fetch_wb_question_rows(
    api_key: str,
    endpoint: str,
    is_answered: bool | None,
    stars: int | None,
    max_pages: int = 12,
) -> list[dict[str, Any]]:
    if is_answered is None:
        rows: list[dict[str, Any]] = []
        rows.extend(_fetch_wb_question_rows(api_key, endpoint=endpoint, is_answered=False, stars=stars, max_pages=max_pages))
        rows.extend(_fetch_wb_question_rows(api_key, endpoint=endpoint, is_answered=True, stars=stars, max_pages=max_pages))
        return _dedupe_review_rows(rows)

    # WB docs allow up to 10,000 questions per request. One large page is much
    # cheaper than burning several Feedbacks/Questions rate-limit slots.
    take = _WB_QUESTION_PAGE_TAKE
    skip = 0
    max_pages = max(1, min(int(max_pages or 1), 2))
    all_rows: list[dict[str, Any]] = []
    for _ in range(max_pages):
        params: dict[str, Any] = {"take": take, "skip": skip}
        if is_answered is not None:
            params["isAnswered"] = is_answered
        if isinstance(stars, int) and 1 <= stars <= 5:
            params["rating"] = stars
        data = _request_wb_json(
            "GET",
            endpoint,
            api_key=api_key,
            params=params,
            max_attempts=3,
            retry_rate_limit=True,
            timeout=WB_FAST_TIMEOUT if max_pages <= 1 else WB_TIMEOUT,
        )
        if data is None:
            break
        page_rows = _extract_wb_question_rows(data)
        if not page_rows:
            break
        all_rows.extend(page_rows)
        if len(page_rows) < take:
            break
        has_next = _extract_has_next(data)
        if has_next is False:
            break
        skip += take
    return all_rows


def _fetch_wb_feedback_rows(
    api_key: str,
    endpoint: str,
    is_answered: bool | None,
    stars: int | None,
    max_pages: int = 12,
) -> list[dict[str, Any]]:
    # WB docs allow up to 5,000 feedbacks per request. This keeps auto-replies
    # and the UI from spending the shared WB rate-limit bucket on pagination.
    take = _WB_FEEDBACK_PAGE_TAKE
    skip = 0
    max_pages = max(1, min(int(max_pages or 1), 2))
    all_rows: list[dict[str, Any]] = []
    for _ in range(max_pages):
        params: dict[str, Any] = {"take": take, "skip": skip}
        if is_answered is not None:
            params["isAnswered"] = is_answered
        if isinstance(stars, int) and 1 <= stars <= 5:
            params["rating"] = stars
        data = _request_wb_json(
            "GET",
            endpoint,
            api_key=api_key,
            params=params,
            max_attempts=3,
            retry_rate_limit=True,
            timeout=WB_FAST_TIMEOUT if max_pages <= 1 else WB_TIMEOUT,
        )
        if data is None:
            break
        page_rows = _extract_wb_feedback_rows(data)
        if not page_rows:
            break
        all_rows.extend(page_rows)
        if len(page_rows) < take:
            break
        has_next = _extract_has_next(data)
        if has_next is False:
            break
        skip += take
    return all_rows


def _fetch_ozon_reviews(api_key: str, stars: int | None, max_pages: int = 12) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = [
        {"limit": 100, "last_id": "", "sort_dir": "DESC", "status": "ALL"},
        {"limit": 100, "last_id": "", "filter": {"status": "ALL"}},
    ]
    if isinstance(stars, int) and 1 <= stars <= 5:
        payloads = [
            {"limit": 100, "last_id": "", "sort_dir": "DESC", "status": "ALL", "rating": stars},
            {"limit": 100, "last_id": "", "filter": {"status": "ALL", "rating": stars}},
        ] + payloads

    endpoints = [
        "https://api-seller.ozon.ru/v1/review/list",
        "https://api-seller.ozon.ru/v2/review/list",
    ]
    for endpoint in endpoints:
        for payload in payloads:
            rows = _fetch_ozon_list_pages(
                api_key=api_key,
                endpoint=endpoint,
                payload=payload,
                extractor=_extract_ozon_review_rows,
                max_pages=max_pages,
            )
            if rows:
                return _dedupe_review_rows(rows)
    return []


def _fetch_ozon_questions(api_key: str, stars: int | None, max_pages: int = 12) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = [
        {"limit": 100, "last_id": "", "sort_dir": "DESC", "status": "ALL"},
        {"limit": 100, "last_id": "", "filter": {"status": "ALL"}},
    ]
    if isinstance(stars, int) and 1 <= stars <= 5:
        payloads = [
            {"limit": 100, "last_id": "", "sort_dir": "DESC", "status": "ALL", "rating": stars},
            {"limit": 100, "last_id": "", "filter": {"status": "ALL", "rating": stars}},
        ] + payloads

    endpoints = [
        "https://api-seller.ozon.ru/v1/question/list",
        "https://api-seller.ozon.ru/v2/question/list",
        "https://api-seller.ozon.ru/v1/product/question/list",
    ]
    for endpoint in endpoints:
        for payload in payloads:
            rows = _fetch_ozon_list_pages(
                api_key=api_key,
                endpoint=endpoint,
                payload=payload,
                extractor=_extract_ozon_question_rows,
                max_pages=max_pages,
            )
            if rows:
                return _dedupe_review_rows(rows)
    return []


def _fetch_ozon_list_pages(
    api_key: str,
    endpoint: str,
    payload: dict[str, Any],
    extractor,
    max_pages: int = 12,
) -> list[dict[str, Any]]:
    safe_pages = max(1, min(int(max_pages or 1), 20))
    out: list[dict[str, Any]] = []
    last_id = str(payload.get("last_id") or "")
    seen_cursor: set[str] = set()
    for _ in range(safe_pages):
        page_payload = dict(payload)
        page_payload["last_id"] = last_id
        data = _request_ozon_json("POST", endpoint, api_key=api_key, payload=page_payload)
        if data is None:
            break
        page_rows = extractor(data)
        if not page_rows:
            break
        out.extend(page_rows)
        next_last = _extract_ozon_last_id(data, page_rows)
        if not next_last:
            break
        if next_last == last_id or next_last in seen_cursor:
            break
        seen_cursor.add(next_last)
        last_id = next_last
    return out


def _extract_ozon_last_id(data: Any, rows: list[dict[str, Any]]) -> str:
    if isinstance(data, dict):
        direct = _pick_first_str(
            data.get("last_id"),
            data.get("lastId"),
            (data.get("result") or {}).get("last_id") if isinstance(data.get("result"), dict) else "",
            (data.get("result") or {}).get("lastId") if isinstance(data.get("result"), dict) else "",
            (data.get("data") or {}).get("last_id") if isinstance(data.get("data"), dict) else "",
            (data.get("data") or {}).get("lastId") if isinstance(data.get("data"), dict) else "",
        )
        if direct:
            return direct
    if rows:
        tail = rows[-1]
        return _pick_first_str(
            tail.get("id"),
            tail.get("review_id"),
            tail.get("question_id"),
            (tail.get("review") or {}).get("id") if isinstance(tail.get("review"), dict) else "",
            (tail.get("question") or {}).get("id") if isinstance(tail.get("question"), dict) else "",
        )
    return ""


def _request_wb_json(
    method: str,
    url: str,
    api_key: str,
    params: dict[str, Any] | None = None,
    payload: dict[str, Any] | list[Any] | None = None,
    *,
    max_attempts: int = 4,
    retry_rate_limit: bool = True,
    timeout: httpx.Timeout | None = None,
) -> dict[str, Any] | list[dict[str, Any]] | None:
    token = api_key.strip()
    if not token:
        return None
    safe_method = str(method or "GET").strip().upper() or "GET"
    auth_variants = [token, f"Bearer {token}"]
    safe_max_attempts = max(1, min(4, int(max_attempts or 1)))
    request_timeout = timeout or WB_TIMEOUT
    uses_feedback_bucket = _is_wb_feedback_api_url(url)
    for auth_value in auth_variants:
        headers = {"Authorization": auth_value, "Content-Type": "application/json"}
        for attempt in range(safe_max_attempts):
            response = None
            try:
                if uses_feedback_bucket:
                    wait_left = wb_feedback_auto_reply_wait_left_sec(token)
                    if wait_left > 5:
                        retry_sec = int(wait_left + 0.999)
                        raise WbRateLimitError(f"WB Feedbacks/Questions cooldown is active. Retry automatically after {retry_sec} sec.")
                    _wb_feedback_throttle(token)
                with httpx.Client(timeout=request_timeout, follow_redirects=True) as client:
                    if safe_method == "POST":
                        response = client.post(url, headers=headers, params=params, json=payload)
                    elif safe_method == "PATCH":
                        response = client.patch(url, headers=headers, params=params, json=payload)
                    elif safe_method == "DELETE":
                        response = client.request("DELETE", url, headers=headers, params=params, json=payload)
                    else:
                        response = client.get(url, headers=headers, params=params)
            except WbRateLimitError:
                raise
            except Exception:
                response = None
            if response is None:
                if attempt < (safe_max_attempts - 1):
                    time.sleep(0.35 * (attempt + 1))
                continue
            if response.status_code == 429:
                retry_delay = _wb_retry_delay_sec(response, attempt)
                if uses_feedback_bucket:
                    _wb_feedback_record_rate_limit(token, retry_delay)
                if not retry_rate_limit:
                    body = _safe_response_text(response)
                    raise WbRateLimitError(body or "WB API returned 429")
                if attempt < (safe_max_attempts - 1) and retry_delay <= 30:
                    time.sleep(retry_delay)
                    continue
                body = _safe_response_text(response)
                raise WbRateLimitError(body or "WB API returned 429")
            if response.status_code in {401, 403}:
                break
            if response.status_code in {408, 425, 500, 502, 503, 504} and attempt < (safe_max_attempts - 1):
                time.sleep(0.5 * (attempt + 1))
                continue
            if response.status_code >= 400:
                break
            body_text = _safe_response_text(response).strip()
            if not body_text:
                return {}
            try:
                parsed = response.json()
                if isinstance(parsed, (dict, list)):
                    return parsed
                return {"value": parsed}
            except Exception:
                if attempt < (safe_max_attempts - 1):
                    time.sleep(0.3 * (attempt + 1))
                    continue
                return {"raw": body_text[:2000]}
    return None


def _wb_retry_delay_sec(response: httpx.Response, attempt: int) -> float:
    headers = response.headers
    for header in ("Retry-After", "X-Ratelimit-Retry", "X-RateLimit-Retry", "X-Ratelimit-Reset", "X-RateLimit-Reset"):
        raw = headers.get(header)
        if raw is None:
            continue
        text = str(raw).strip()
        if not text:
            continue
        try:
            value = float(text)
        except Exception:
            continue
        if value > 0:
            return min(20 * 60.0, max(0.5, value))
    return min(30.0, 1.5 * (attempt + 1))


def _request_ozon_json(
    method: str,
    url: str,
    api_key: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any] | list[dict[str, Any]] | None:
    response = _request_ozon_response(method, url, api_key=api_key, payload=payload)
    if response is None:
        return None
    if response.status_code >= 400:
        return None
    try:
        parsed = response.json()
        if isinstance(parsed, (dict, list)):
            return parsed
    except Exception:
        return None
    return None


def _request_ozon_response(
    method: str,
    url: str,
    api_key: str,
    payload: dict[str, Any] | None = None,
) -> httpx.Response | None:
    headers = _build_ozon_headers(api_key)
    if not headers:
        return None
    try:
        with httpx.Client(timeout=OZON_TIMEOUT, follow_redirects=True) as client:
            if method == "POST":
                return client.post(url, headers=headers, json=payload or {})
            return client.get(url, headers=headers)
    except Exception:
        return None


def _normalize_review_row(row: dict[str, Any], is_answered: bool) -> dict[str, Any]:
    product = row.get("productDetails", {}) if isinstance(row.get("productDetails"), dict) else {}
    answer_text = _extract_answer_text(
        row.get("answer"),
        row.get("answerText"),
        row.get("supplierAnswer"),
        row.get("sellerAnswer"),
        row.get("response"),
    )

    created = _pick_first_str(row.get("createdDate"), row.get("createdAt"), row.get("date"))
    text_parts = [str(row.get("pros") or "").strip(), str(row.get("cons") or "").strip(), str(row.get("text") or "").strip()]
    text = "\n".join([x for x in text_parts if x])

    stars_raw = row.get("productValuation")
    try:
        stars = int(stars_raw)
    except Exception:
        stars = 0

    user_name = _pick_first_str(
        row.get("userName"),
        row.get("customerName"),
        row.get("buyerName"),
        (row.get("user") or {}).get("name") if isinstance(row.get("user"), dict) else "",
    )
    photos = _extract_photo_urls(
        row.get("photoLinks"),
        row.get("photos"),
        row.get("photo"),
        row.get("images"),
        row.get("media"),
    )
    effective_answered = bool(is_answered or answer_text)
    return {
        "id": str(row.get("id") or ""),
        "date": created[:10] if created else "",
        "created_at": created,
        "product": str(product.get("productName") or product.get("nmId") or ""),
        "article": str(product.get("nmId") or ""),
        "product_id": str(product.get("nmId") or ""),
        "offer_id": str(product.get("supplierArticle") or ""),
        "external_id": str(product.get("nmId") or ""),
        "barcode": _pick_first_str(product.get("imtId"), product.get("barcode"), row.get("barcode")),
        "stars": stars,
        "text": text,
        "user": user_name,
        "answer": answer_text.strip(),
        "state": _pick_first_str(row.get("state"), row.get("status"), row.get("wbState")).strip().lower(),
        "is_answered": effective_answered,
        "photos": photos,
    }


def _normalize_ozon_review_row(
    row: dict[str, Any],
    product_catalog: dict[str, dict[str, str]] | None = None,
) -> dict[str, Any]:
    core = row.get("review") if isinstance(row.get("review"), dict) else row
    if not isinstance(core, dict):
        core = {}

    product = core.get("product") if isinstance(core.get("product"), dict) else {}
    mapped = _resolve_ozon_product_meta(core, row, product_catalog or {})
    created = _pick_first_str(
        core.get("published_at"),
        core.get("created_at"),
        core.get("createdAt"),
        core.get("date"),
        row.get("published_at"),
        row.get("created_at"),
    )
    review_id = _pick_first_str(core.get("id"), core.get("review_id"), row.get("id"), row.get("review_id"))
    product_name = _pick_first_str(
        core.get("product_name"),
        core.get("productName"),
        product.get("name") if isinstance(product, dict) else "",
        mapped.get("product"),
    )
    product_id = _pick_first_str(
        core.get("product_id"),
        core.get("productId"),
        product.get("id") if isinstance(product, dict) else "",
        product.get("product_id") if isinstance(product, dict) else "",
        row.get("product_id"),
    )
    offer_id = _pick_first_str(
        core.get("offer_id"),
        core.get("offerId"),
        product.get("offer_id") if isinstance(product, dict) else "",
        product.get("offerId") if isinstance(product, dict) else "",
        row.get("offer_id"),
    )
    sku_text = _pick_first_str(
        core.get("sku"),
        core.get("sku_id"),
        product.get("sku") if isinstance(product, dict) else "",
        product.get("sku_id") if isinstance(product, dict) else "",
        row.get("sku"),
    )
    article = _pick_first_str(
        offer_id,
        sku_text,
        product_id,
        mapped.get("article"),
    )
    sku_num = _to_int(sku_text)
    barcode = _pick_first_str(
        core.get("barcode"),
        product.get("barcode") if isinstance(product, dict) else "",
        mapped.get("barcode"),
    )

    stars_raw = core.get("rating")
    if stars_raw is None:
        stars_raw = core.get("score")
    try:
        stars = int(stars_raw)
    except Exception:
        stars = 0

    user_name = _sanitize_person_name(
        _pick_first_str(
            core.get("author_name"),
            core.get("author"),
            core.get("user_name"),
            core.get("customer_name"),
            row.get("author_name"),
            row.get("author"),
        )
    )

    text = _join_non_empty(
        [
            str(core.get("pros") or "").strip(),
            str(core.get("cons") or "").strip(),
            str(core.get("text") or "").strip(),
            str(core.get("content") or "").strip(),
            str(core.get("comment") or "").strip(),
        ]
    )

    answer_text = _extract_answer_text(
        core.get("answer"),
        core.get("comment"),
        core.get("comments"),
        core.get("reply"),
        row.get("answer"),
        row.get("comment"),
        row.get("comments"),
    )
    photos = _extract_photo_urls(
        core.get("photos"),
        core.get("images"),
        core.get("photo"),
        core.get("photo_urls"),
        core.get("picture_urls"),
        core.get("media"),
        row.get("photos"),
        row.get("images"),
        row.get("photo_urls"),
    )
    status = _pick_first_str(core.get("status"), row.get("status")).lower()
    try:
        video_count = int(
            core.get("videos_amount")
            or core.get("video_amount")
            or core.get("videos_count")
            or row.get("videos_amount")
            or row.get("video_amount")
            or row.get("videos_count")
            or 0
        )
    except Exception:
        video_count = 0
    can_reply = bool(str(text or "").strip() or photos or video_count > 0)
    is_answered = bool(
        answer_text
        or _is_truthy(core.get("is_answered"))
        or _is_truthy(core.get("answered"))
        or _is_truthy(row.get("is_answered"))
        or _is_truthy(row.get("answered"))
        or status in {"answered", "replied", "processed", "published", "published_answer"}
    )

    return {
        "id": review_id,
        "date": created[:10] if created else "",
        "created_at": created,
        "product": product_name or "Товар Ozon",
        "article": article,
        "product_id": product_id,
        "offer_id": offer_id,
        "external_id": product_id or article,
        "barcode": barcode,
        "sku": sku_num,
        "stars": stars,
        "text": text,
        "user": user_name,
        "answer": answer_text,
        "is_answered": is_answered,
        "can_reply": can_reply,
        "reply_block_reason": "" if can_reply else "Ozon не разрешает отвечать на отзывы без текста, фото и видео (только оценка).",
        "photos": photos,
    }


def _normalize_wb_question_row(row: dict[str, Any], is_answered: bool) -> dict[str, Any]:
    product = row.get("productDetails", {}) if isinstance(row.get("productDetails"), dict) else {}
    answer_text = _extract_answer_text(
        row.get("answer"),
        row.get("answerText"),
        row.get("supplierAnswer"),
        row.get("sellerAnswer"),
        row.get("response"),
        row.get("reply"),
    )
    created = _pick_first_str(row.get("createdDate"), row.get("createdAt"), row.get("date"))
    text = _join_non_empty(
        [
            str(row.get("text") or "").strip(),
            str(row.get("question") or "").strip(),
            str(row.get("content") or "").strip(),
            str(row.get("message") or "").strip(),
        ]
    )
    stars_raw = row.get("productValuation")
    if stars_raw is None:
        stars_raw = row.get("rating")
    try:
        stars = int(stars_raw)
    except Exception:
        stars = 0
    user_name = _pick_first_str(
        row.get("userName"),
        row.get("customerName"),
        row.get("buyerName"),
        row.get("author"),
        row.get("authorName"),
        (row.get("user") or {}).get("name") if isinstance(row.get("user"), dict) else "",
    )
    photos = _extract_photo_urls(
        row.get("photoLinks"),
        row.get("photos"),
        row.get("photo"),
        row.get("images"),
        row.get("media"),
    )
    effective_answered = bool(is_answered or answer_text)
    return {
        "id": _pick_first_str(row.get("id"), row.get("questionId"), row.get("question_id")),
        "date": created[:10] if created else "",
        "created_at": created,
        "product": str(product.get("productName") or product.get("nmId") or row.get("productName") or "РўРѕРІР°СЂ WB"),
        "article": str(product.get("nmId") or row.get("nmId") or row.get("offerId") or ""),
        "product_id": str(product.get("nmId") or row.get("nmId") or ""),
        "offer_id": str(product.get("supplierArticle") or row.get("supplierArticle") or row.get("offerId") or ""),
        "external_id": str(product.get("nmId") or row.get("nmId") or ""),
        "barcode": _pick_first_str(product.get("barcode"), row.get("barcode")),
        "stars": stars,
        "text": text,
        "user": user_name,
        "answer": answer_text.strip(),
        "state": _pick_first_str(row.get("state"), row.get("status"), row.get("wbState")).strip().lower(),
        "is_answered": effective_answered,
        "photos": photos,
    }


def _normalize_ozon_question_row(
    row: dict[str, Any],
    product_catalog: dict[str, dict[str, str]] | None = None,
) -> dict[str, Any]:
    core = row.get("question") if isinstance(row.get("question"), dict) else row
    if not isinstance(core, dict):
        core = {}

    product = core.get("product") if isinstance(core.get("product"), dict) else {}
    mapped = _resolve_ozon_product_meta(core, row, product_catalog or {})
    created = _pick_first_str(
        core.get("published_at"),
        core.get("created_at"),
        core.get("createdAt"),
        core.get("date"),
        row.get("published_at"),
        row.get("created_at"),
    )
    item_id = _pick_first_str(core.get("id"), core.get("question_id"), row.get("id"), row.get("question_id"))
    product_name = _pick_first_str(
        core.get("product_name"),
        core.get("productName"),
        product.get("name") if isinstance(product, dict) else "",
        mapped.get("product"),
    )
    product_id = _pick_first_str(
        core.get("product_id"),
        core.get("productId"),
        product.get("id") if isinstance(product, dict) else "",
        product.get("product_id") if isinstance(product, dict) else "",
        row.get("product_id"),
    )
    offer_id = _pick_first_str(
        core.get("offer_id"),
        core.get("offerId"),
        product.get("offer_id") if isinstance(product, dict) else "",
        product.get("offerId") if isinstance(product, dict) else "",
        row.get("offer_id"),
    )
    sku_text = _pick_first_str(
        core.get("sku"),
        core.get("sku_id"),
        product.get("sku") if isinstance(product, dict) else "",
        product.get("sku_id") if isinstance(product, dict) else "",
        row.get("sku"),
    )
    article = _pick_first_str(
        offer_id,
        sku_text,
        product_id,
        mapped.get("article"),
    )
    sku_num = _to_int(sku_text)
    barcode = _pick_first_str(
        core.get("barcode"),
        product.get("barcode") if isinstance(product, dict) else "",
        mapped.get("barcode"),
    )
    stars_raw = core.get("rating")
    if stars_raw is None:
        stars_raw = core.get("score")
    try:
        stars = int(stars_raw)
    except Exception:
        stars = 0
    user_name = _sanitize_person_name(
        _pick_first_str(
            core.get("author_name"),
            core.get("author"),
            core.get("user_name"),
            core.get("customer_name"),
            row.get("author_name"),
            row.get("author"),
        )
    )
    text = _join_non_empty(
        [
            str(core.get("text") or "").strip(),
            str(core.get("question") or "").strip(),
            str(core.get("content") or "").strip(),
            str(core.get("comment") or "").strip(),
        ]
    )
    answer_text = _extract_answer_text(
        core.get("answer"),
        core.get("comment"),
        core.get("comments"),
        core.get("reply"),
        row.get("answer"),
        row.get("comment"),
        row.get("comments"),
    )
    photos = _extract_photo_urls(
        core.get("photos"),
        core.get("images"),
        core.get("photo"),
        core.get("photo_urls"),
        core.get("picture_urls"),
        core.get("media"),
        row.get("photos"),
        row.get("images"),
        row.get("photo_urls"),
    )
    status = _pick_first_str(core.get("status"), row.get("status")).lower()
    is_answered = bool(
        answer_text
        or _is_truthy(core.get("is_answered"))
        or _is_truthy(core.get("answered"))
        or _is_truthy(row.get("is_answered"))
        or _is_truthy(row.get("answered"))
        or status in {"answered", "replied", "processed", "published", "published_answer"}
    )
    return {
        "id": item_id,
        "date": created[:10] if created else "",
        "created_at": created,
        "product": product_name or "Товар Ozon",
        "article": article,
        "product_id": product_id,
        "offer_id": offer_id,
        "external_id": product_id or article,
        "barcode": barcode,
        "sku": sku_num,
        "stars": stars,
        "text": text,
        "user": user_name,
        "answer": answer_text,
        "is_answered": is_answered,
        "photos": photos,
    }


def _build_ozon_product_catalog(api_key: str, rows: list[dict[str, Any]]) -> dict[str, dict[str, str]]:
    product_ids: set[str] = set()
    offer_ids: set[str] = set()
    skus: set[str] = set()

    for row in rows:
        core = row.get("question") if isinstance(row.get("question"), dict) else row.get("review")
        if not isinstance(core, dict):
            core = row if isinstance(row, dict) else {}
        product = core.get("product") if isinstance(core.get("product"), dict) else {}

        pid = _pick_first_str(core.get("product_id"), core.get("productId"), product.get("id"), product.get("product_id"))
        if pid:
            product_ids.add(pid)
        offer = _pick_first_str(core.get("offer_id"), core.get("offerId"), product.get("offer_id"), product.get("offerId"))
        if offer:
            offer_ids.add(offer)
        sku = _pick_first_str(core.get("sku"), core.get("sku_id"), product.get("sku"), product.get("sku_id"))
        if sku:
            skus.add(sku)

    if not product_ids and not offer_ids and not skus:
        return {}

    rows_out: list[dict[str, Any]] = []
    endpoints = [
        "https://api-seller.ozon.ru/v3/product/info/list",
        "https://api-seller.ozon.ru/v2/product/info/list",
        "https://api-seller.ozon.ru/v1/product/info/list",
    ]

    payloads: list[dict[str, Any]] = []
    if product_ids:
        pid_rows = list(product_ids)[:300]
        payloads.extend(
            [
                {"product_id": pid_rows},
                {"product_ids": pid_rows},
                {"filter": {"product_id": pid_rows}},
                {"filter": {"product_ids": pid_rows}},
            ]
        )
    if offer_ids:
        offer_rows = list(offer_ids)[:300]
        payloads.extend(
            [
                {"offer_id": offer_rows},
                {"offer_ids": offer_rows},
                {"filter": {"offer_id": offer_rows}},
                {"filter": {"offer_ids": offer_rows}},
            ]
        )
    if skus:
        sku_rows = list(skus)[:300]
        payloads.extend(
            [
                {"sku": sku_rows},
                {"skus": sku_rows},
                {"filter": {"sku": sku_rows}},
                {"filter": {"skus": sku_rows}},
            ]
        )

    for endpoint in endpoints:
        for payload in payloads:
            data = _request_ozon_json("POST", endpoint, api_key=api_key, payload=payload)
            if data is None:
                continue
            extracted = _extract_ozon_product_rows(data)
            if extracted:
                rows_out.extend(extracted)

    if not rows_out:
        return {}

    catalog: dict[str, dict[str, str]] = {}
    for item in rows_out:
        if not isinstance(item, dict):
            continue
        pid = _pick_first_str(item.get("id"), item.get("product_id"), item.get("productId"))
        offer = _pick_first_str(item.get("offer_id"), item.get("offerId"), item.get("vendor_code"), item.get("article"))
        sku = _pick_first_str(item.get("sku"), item.get("sku_id"), item.get("skuId"))
        name = _pick_first_str(item.get("name"), item.get("title"), item.get("product_name"), item.get("offer_name"))
        barcode = _extract_ozon_barcode(item)
        article = _pick_first_str(offer, sku, pid)
        payload = {"product": name, "article": article, "barcode": barcode}
        for marker in _ozon_product_markers(pid=pid, offer=offer, sku=sku):
            prev = catalog.get(marker, {})
            catalog[marker] = {
                "product": payload["product"] or prev.get("product", ""),
                "article": payload["article"] or prev.get("article", ""),
                "barcode": payload["barcode"] or prev.get("barcode", ""),
            }
    return catalog


def _resolve_ozon_product_meta(
    core: dict[str, Any],
    row: dict[str, Any],
    catalog: dict[str, dict[str, str]],
) -> dict[str, str]:
    product = core.get("product") if isinstance(core.get("product"), dict) else {}
    pid = _pick_first_str(core.get("product_id"), core.get("productId"), product.get("id"), product.get("product_id"), row.get("product_id"))
    offer = _pick_first_str(core.get("offer_id"), core.get("offerId"), product.get("offer_id"), product.get("offerId"), row.get("offer_id"))
    sku = _pick_first_str(core.get("sku"), core.get("sku_id"), product.get("sku"), product.get("sku_id"), row.get("sku"))
    for marker in _ozon_product_markers(pid=pid, offer=offer, sku=sku):
        data = catalog.get(marker)
        if data:
            return data
    return {}


def _ozon_product_markers(pid: str, offer: str, sku: str) -> list[str]:
    markers: list[str] = []
    if pid:
        markers.append(f"pid:{pid}")
    if offer:
        markers.append(f"offer:{offer.lower()}")
    if sku:
        markers.append(f"sku:{sku}")
    return markers


def _extract_ozon_product_rows(data: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    preferred_keys = ("items", "products", "result", "data", "list")
    rows = _extract_first_dict_list(data, preferred_keys=preferred_keys)
    return [x for x in rows if isinstance(x, dict)]


def _extract_ozon_barcode(row: dict[str, Any]) -> str:
    direct = _pick_first_str(row.get("barcode"), row.get("bar_code"), row.get("barcodes"))
    if direct:
        return direct
    raw_barcodes = row.get("barcodes")
    if isinstance(raw_barcodes, list):
        for item in raw_barcodes:
            text = _pick_first_str(item.get("barcode"), item.get("bar_code"), item) if isinstance(item, dict) else _pick_first_str(item)
            if text:
                return text
    return ""


def _extract_wb_campaign_rows(data: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = _as_dict_list(data)
    campaign_like = [x for x in rows if _campaign_id_from_row(x)]
    if campaign_like:
        return campaign_like

    primitive_ids = _extract_campaign_ids(data)
    if primitive_ids:
        return [{"advertId": x} for x in primitive_ids]

    count_rows = _extract_campaign_rows_from_count_response(data)
    if count_rows:
        return count_rows
    return []


def _extract_campaign_rows_from_count_response(data: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups = _as_dict_list(data)
    if not groups:
        return []

    rows: list[dict[str, Any]] = []
    for group in groups:
        status = _pick_first_str(group.get("status"), group.get("state"))
        campaign_type = _pick_first_str(group.get("type"), group.get("campaignType"), group.get("adType"))
        advert_list = group.get("advert_list")
        if advert_list is None:
            advert_list = group.get("adverts")
        if advert_list is None:
            advert_list = group.get("campaigns")

        if isinstance(advert_list, list):
            for item in advert_list:
                if isinstance(item, dict):
                    row = dict(item)
                    if status and not row.get("status"):
                        row["status"] = status
                    if campaign_type and not row.get("type"):
                        row["type"] = campaign_type
                    rows.append(row)
                elif isinstance(item, (int, str)):
                    rows.append(
                        {
                            "advertId": item,
                            "status": status,
                            "type": campaign_type,
                        }
                    )
            continue

        cid = _campaign_id_from_row(group)
        if cid:
            rows.append(group)

    dedup: dict[str, dict[str, Any]] = {}
    for row in rows:
        cid = _campaign_id_from_row(row)
        if not cid:
            continue
        dedup[cid] = row
    if dedup:
        return list(dedup.values())
    return rows


def _campaign_id_from_row(row: dict[str, Any]) -> str:
    for key in ("advertId", "advert_id", "campaignId", "campaign_id", "id", "adId"):
        value = row.get(key)
        text = _pick_first_str(value)
        if text:
            return text
    for key, value in row.items():
        low = str(key).lower()
        if ("advert" in low or "campaign" in low) and "id" in low:
            text = _pick_first_str(value)
            if text:
                return text
    nested_advert = row.get("advert") if isinstance(row.get("advert"), dict) else {}
    nested_id = _pick_first_str(nested_advert.get("id"), nested_advert.get("advertId"), nested_advert.get("campaignId"))
    if nested_id:
        return nested_id
    return ""


def _extract_campaign_ids(data: Any) -> list[int]:
    found: set[int] = set()

    def walk(value: Any, key_name: str = ""):
        if isinstance(value, dict):
            for key, nested in value.items():
                walk(nested, str(key))
            return
        if isinstance(value, list):
            for item in value:
                walk(item, key_name)
            return
        low = key_name.lower()
        if not ("id" in low or "advert" in low or "campaign" in low):
            return
        num = _to_int(value)
        if num and num > 0:
            found.add(num)

    walk(data, "")
    return sorted(found)


def _has_campaign_context(row: dict[str, Any]) -> bool:
    if not isinstance(row, dict):
        return False

    def _clean_text(value: Any) -> str:
        text = str(value or "").strip()
        low = text.lower()
        if not text or low in {"-", "вЂ”", "null", "none", "undefined", "n/a"}:
            return ""
        return text

    def _is_placeholder_name(value: Any) -> bool:
        text = _clean_text(value).lower()
        if not text:
            return True
        if text in {"campaign", "advert", "ad"}:
            return True
        return text.startswith("campaign ") or text.startswith("кампания ")

    candidate_nodes: list[dict[str, Any]] = [row]
    for key in ("settings", "advert", "campaign", "summary", "params"):
        node = row.get(key)
        if isinstance(node, dict):
            candidate_nodes.append(node)

    for node in candidate_nodes:
        for key in (
            "name",
            "campaignName",
            "campaign_name",
            "advertName",
            "advert_name",
            "advertTitle",
            "campaignTitle",
            "title",
            "subject",
        ):
            if key not in node:
                continue
            value = node.get(key)
            if not _is_placeholder_name(value):
                return True
        for key in ("status", "state", "type", "adType", "campaignType", "advertType", "bid_type"):
            if key not in node:
                continue
            value = node.get(key)
            if isinstance(value, (int, float)):
                if math.isfinite(float(value)):
                    return True
                continue
            if _clean_text(value):
                return True
        for key in ("budget", "dailyBudget", "limit", "totalBudget", "daily_budget"):
            if key not in node:
                continue
            number = _to_float(node.get(key))
            if number is not None:
                return True
    return False


def _build_campaign_stat_row(row: dict[str, Any]) -> dict[str, Any]:
    views_scan = _scan_metric_by_aliases(row, {"views", "viewcount", "view_count", "viewscount", "views_count", "shows", "showcount", "show_count", "showscount", "impressions", "impressioncount", "impression_count", "impressionscount", "impressions_count"})
    clicks_scan = _scan_metric_by_aliases(row, {"clicks", "click", "clickcount", "click_count", "clickscount", "clicks_count"})
    orders_scan = _scan_metric_by_aliases(row, {"orders", "order", "orderscount", "orders_count", "ordercount", "order_count", "orderssum", "orders_sum", "purchases", "purchasescount", "purchases_count"})
    add_to_cart_scan = _scan_metric_by_aliases(row, {"atb", "atbs", "addtocart", "add_to_cart", "basketadds", "basket_adds", "basketaddcount", "basket_add_count"})
    spent_scan = _scan_metric_by_aliases(row, {"sum", "sumprice", "sum_price", "spent", "cost", "expense", "expenses", "totalspent", "total_spent", "totalcost", "total_cost"})
    ctr_scan = _scan_metric_by_aliases(row, {"ctr"})
    cr_scan = _scan_metric_by_aliases(row, {"cr"})

    metric_hits = int(
        views_scan["hits"]
        + clicks_scan["hits"]
        + orders_scan["hits"]
        + add_to_cart_scan["hits"]
        + spent_scan["hits"]
        + ctr_scan["hits"]
        + cr_scan["hits"]
    )
    metric_nonzero_hits = int(
        views_scan["nonzero_hits"]
        + clicks_scan["nonzero_hits"]
        + orders_scan["nonzero_hits"]
        + add_to_cart_scan["nonzero_hits"]
        + spent_scan["nonzero_hits"]
        + ctr_scan["nonzero_hits"]
        + cr_scan["nonzero_hits"]
    )
    stat_has_context = metric_hits > 0
    stat_nonzero = metric_nonzero_hits > 0
    if not stat_has_context:
        return {
            "views": None,
            "clicks": None,
            "orders": None,
            "add_to_cart": None,
            "spent": None,
            "ctr": None,
            "cr": None,
            "cpc": None,
            "cpo": None,
            "metric_hits": 0,
            "metric_nonzero_hits": 0,
            "stat_has_context": False,
            "stat_nonzero": False,
        }

    views = float(views_scan["total"])
    clicks = float(clicks_scan["total"])
    orders = float(orders_scan["total"])
    add_to_cart = float(add_to_cart_scan["total"])
    spent = float(spent_scan["total"])

    ctr: float | None = None
    if ctr_scan["hits"] > 0:
        ctr = float(ctr_scan["total"])
    elif views_scan["hits"] > 0 or clicks_scan["hits"] > 0:
        ctr = (clicks / views * 100.0) if views > 0 else 0.0

    cr: float | None = None
    if cr_scan["hits"] > 0:
        cr = float(cr_scan["total"])
    elif orders_scan["hits"] > 0 or clicks_scan["hits"] > 0:
        cr = (orders / clicks * 100.0) if clicks > 0 else 0.0

    cpc: float | None = None
    if spent_scan["hits"] > 0 or clicks_scan["hits"] > 0:
        cpc = (spent / clicks) if clicks > 0 else 0.0

    cpo: float | None = None
    if spent_scan["hits"] > 0 or orders_scan["hits"] > 0:
        cpo = (spent / orders) if orders > 0 else 0.0

    return {
        "views": float(round(views, 3)),
        "clicks": float(round(clicks, 3)),
        "orders": float(round(orders, 3)),
        "add_to_cart": float(round(add_to_cart, 3)),
        "spent": float(round(spent, 3)),
        "ctr": float(round(ctr, 4)) if ctr is not None else None,
        "cr": float(round(cr, 4)) if cr is not None else None,
        "cpc": float(round(cpc, 4)) if cpc is not None else None,
        "cpo": float(round(cpo, 4)) if cpo is not None else None,
        "metric_hits": metric_hits,
        "metric_nonzero_hits": metric_nonzero_hits,
        "stat_has_context": stat_has_context,
        "stat_nonzero": stat_nonzero,
    }


def _zero_metric_scan() -> dict[str, float | int]:
    return {
        "total": 0.0,
        "hits": 0,
        "nonzero_hits": 0,
    }


def _metric_scan_add(base: dict[str, float | int], extra: dict[str, float | int]) -> dict[str, float | int]:
    return {
        "total": float(base.get("total") or 0.0) + float(extra.get("total") or 0.0),
        "hits": int(base.get("hits") or 0) + int(extra.get("hits") or 0),
        "nonzero_hits": int(base.get("nonzero_hits") or 0) + int(extra.get("nonzero_hits") or 0),
    }


def _scan_metric_direct(node: dict[str, Any], alias_set: set[str]) -> dict[str, float | int]:
    result = _zero_metric_scan()
    if not isinstance(node, dict):
        return result
    for key, value in node.items():
        if str(key or "").strip().lower() not in alias_set:
            continue
        number = _to_float(value)
        if number is None:
            continue
        result["hits"] = int(result["hits"] or 0) + 1
        result["total"] = float(result["total"] or 0.0) + float(number)
        if abs(float(number)) > 1e-9:
            result["nonzero_hits"] = int(result["nonzero_hits"] or 0) + 1
    return result


def _scan_metric_from_list(rows: list[Any], alias_set: set[str]) -> dict[str, float | int]:
    result = _zero_metric_scan()
    for item in rows:
        if not isinstance(item, dict):
            continue
        direct = _scan_metric_direct(item, alias_set)
        if int(direct.get("hits") or 0) > 0:
            result = _metric_scan_add(result, direct)
            continue
        nested = _scan_metric_by_aliases(item, alias_set)
        if int(nested.get("hits") or 0) > 0:
            result = _metric_scan_add(result, nested)
    return result


def _scan_metric_by_aliases(value: Any, aliases: set[str]) -> dict[str, float | int]:
    alias_set = {x.strip().lower() for x in aliases if x and x.strip()}
    if not alias_set:
        return _zero_metric_scan()
    if isinstance(value, dict):
        direct = _scan_metric_direct(value, alias_set)
        if int(direct.get("hits") or 0) > 0:
            return direct
        for key in ("summary", "total", "totals", "stats", "stat", "advert", "campaign", "result", "data", "payload", "response"):
            nested = value.get(key)
            if isinstance(nested, (dict, list)):
                nested_scan = _scan_metric_by_aliases(nested, alias_set)
                if int(nested_scan.get("hits") or 0) > 0:
                    return nested_scan
        list_result = _zero_metric_scan()
        for nested in value.values():
            if isinstance(nested, list) and any(isinstance(item, dict) for item in nested):
                nested_scan = _scan_metric_from_list(nested, alias_set)
                if int(nested_scan.get("hits") or 0) > 0:
                    list_result = _metric_scan_add(list_result, nested_scan)
        return list_result
    if isinstance(value, list):
        return _scan_metric_from_list(value, alias_set)
    return _zero_metric_scan()


def _sum_metric_by_aliases(value: Any, aliases: set[str]) -> float:
    return float(_scan_metric_by_aliases(value, aliases).get("total") or 0.0)


def _to_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        num = float(value)
        return num if math.isfinite(num) else None
    text = str(value or "").strip().replace(" ", "").replace(",", ".")
    if not text:
        return None
    try:
        num = float(text)
        return num if math.isfinite(num) else None
    except Exception:
        return None


def _to_int(value: Any) -> int | None:
    try:
        num = int(str(value).strip())
    except Exception:
        return None
    return num


def _extract_wb_feedback_rows(data: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]

    if not isinstance(data, dict):
        return []

    for key in ("feedbacks", "reviews", "items", "list", "data", "result"):
        value = data.get(key)
        if isinstance(value, list):
            rows = [x for x in value if isinstance(x, dict)]
            if rows:
                return rows
        if isinstance(value, dict):
            rows = _extract_wb_feedback_rows(value)
            if rows:
                return rows

    rows = _extract_first_dict_list(data, preferred_keys=("feedbacks", "reviews", "items", "list"))
    if rows:
        return rows
    return []


def _extract_wb_question_rows(data: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if not isinstance(data, dict):
        return []

    for key in ("questions", "items", "list", "data", "result"):
        value = data.get(key)
        if isinstance(value, list):
            rows = [x for x in value if isinstance(x, dict)]
            if rows:
                return rows
        if isinstance(value, dict):
            rows = _extract_wb_question_rows(value)
            if rows:
                return rows

    rows = _extract_first_dict_list(data, preferred_keys=("questions", "items", "list"))
    if rows:
        return rows
    return []


def _extract_has_next(data: dict[str, Any] | list[dict[str, Any]]) -> bool | None:
    if isinstance(data, list):
        return None
    if not isinstance(data, dict):
        return None
    for key in ("hasNext", "has_next", "next"):
        value = data.get(key)
        if isinstance(value, bool):
            return value
    nested = data.get("data")
    if isinstance(nested, dict):
        for key in ("hasNext", "has_next", "next"):
            value = nested.get(key)
            if isinstance(value, bool):
                return value
    return None


def _looks_answered_feedback(row: dict[str, Any]) -> bool:
    if not isinstance(row, dict):
        return False
    if _extract_answer_text(
        row.get("answer"),
        row.get("answerText"),
        row.get("supplierAnswer"),
        row.get("sellerAnswer"),
        row.get("response"),
        row.get("reply"),
    ):
        return True
    if _is_truthy(row.get("isAnswered")) or _is_truthy(row.get("is_answered")):
        return True
    status = _pick_first_str(row.get("status"), row.get("state")).lower()
    return status in {"answered", "replied", "published", "processed"}


def _dedupe_review_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    tail: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        rid = _pick_first_str(row.get("id"), row.get("feedbackId"), row.get("feedback_id"))
        if not rid:
            tail.append(row)
            continue
        by_id[rid] = row
    return list(by_id.values()) + tail


def _extract_ozon_review_rows(data: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    preferred_keys = ("reviews", "feedbacks", "result", "data", "items", "list")
    rows = _extract_first_dict_list(data, preferred_keys=preferred_keys)
    return [x for x in rows if isinstance(x, dict)]


def _extract_ozon_question_rows(data: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    preferred_keys = ("questions", "result", "data", "items", "list")
    rows = _extract_first_dict_list(data, preferred_keys=preferred_keys)
    return [x for x in rows if isinstance(x, dict)]


def _as_dict_list(data: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        # WB advert endpoints sometimes return dict with nested list.
        for key in ("adverts", "campaigns", "data", "result", "items", "list", "rows"):
            value = data.get(key)
            if isinstance(value, list):
                return [x for x in value if isinstance(x, dict)]
            if isinstance(value, dict):
                nested = _as_dict_list(value)
                if nested:
                    return nested
        if _campaign_id_from_row(data):
            return [data]
        rows = _extract_first_dict_list(data, preferred_keys=("adverts", "campaigns", "items", "list", "rows"))
        if rows:
            return rows
        return [data]
    return []


def _extract_first_dict_list(data: Any, preferred_keys: tuple[str, ...] = ()) -> list[dict[str, Any]]:
    if isinstance(data, list):
        if data and all(isinstance(x, dict) for x in data):
            return [x for x in data if isinstance(x, dict)]
        for item in data:
            rows = _extract_first_dict_list(item, preferred_keys=preferred_keys)
            if rows:
                return rows
        return []

    if not isinstance(data, dict):
        return []

    for key in preferred_keys:
        value = data.get(key)
        if isinstance(value, list):
            rows = [x for x in value if isinstance(x, dict)]
            if rows:
                return rows
        if isinstance(value, dict):
            rows = _extract_first_dict_list(value, preferred_keys=preferred_keys)
            if rows:
                return rows

    for value in data.values():
        rows = _extract_first_dict_list(value, preferred_keys=preferred_keys)
        if rows:
            return rows
    return []


def _filter_rows_by_period(rows: list[dict[str, Any]], date_from: str | None, date_to: str | None) -> list[dict[str, Any]]:
    if not rows:
        return rows
    left = _parse_iso_date(date_from)
    right = _parse_iso_date(date_to)
    if not left and not right:
        return rows
    out: list[dict[str, Any]] = []
    for row in rows:
        row_dt = _row_to_date(row)
        if row_dt is None:
            continue
        if left and row_dt < left:
            continue
        if right and row_dt > right:
            continue
        out.append(row)
    return out


def _row_to_date(row: dict[str, Any]) -> date | None:
    raw = _pick_first_str(row.get("created_at"), row.get("date"), row.get("createdAt"), row.get("createdDate"))
    return _parse_iso_date(raw)


def _parse_iso_date(raw: str | None) -> date | None:
    text = (raw or "").strip()
    if not text:
        return None
    chunk = text[:10]
    try:
        return date.fromisoformat(chunk)
    except Exception:
        pass
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except Exception:
        return None


def _safe_response_text(response: httpx.Response) -> str:
    try:
        body = response.text
    except Exception:
        return ""
    compact = " ".join(body.split())
    return compact[:220]


def _mojibake_score(text: str) -> int:
    value = str(text or "")
    if not value:
        return 0
    markers = ("Ð", "Ñ", "Â", "�", "вЂ", "в„", "РЎ", "Р ", "Рџ", "Рќ", "Рћ", "СЃ", "С‚", "Р°", "Рµ")
    return sum(value.count(marker) for marker in markers)


def _repair_mojibake_text(value: Any) -> str:
    raw = str(value or "")
    if not raw or _mojibake_score(raw) <= 0:
        return raw
    candidates = {raw}
    queue = [raw]
    for _ in range(3):
        if not queue:
            break
        current = queue.pop(0)
        for encoding in ("cp1251", "latin1", "cp1252"):
            for errors in ("strict", "ignore"):
                try:
                    candidate = current.encode(encoding, errors=errors).decode("utf-8", errors=errors)
                except Exception:
                    continue
                if candidate and candidate not in candidates:
                    candidates.add(candidate)
                    queue.append(candidate)
    return min(candidates, key=lambda item: (_mojibake_score(item), -len(item)))


_REPLY_META_PREFIX_RE = re.compile(
    r"^\s*(?:"
    r"(?:вот\s+)?(?:готовый\s+)?(?:вариант\s+)?ответ(?:а)?(?:\s+клиенту|\s+для\s+клиента|\s+для\s+отзыва|\s+на\s+отзыв)?"
    r"|можно\s+ответить\s+так"
    r"|текст\s+ответа"
    r"|ответ\s+покупателю"
    r"|готовый\s+текст"
    r")\s*(?:[,—-]\s*[^:]{0,220})?:\s*",
    re.IGNORECASE,
)


def sanitize_marketplace_reply_text(value: Any, fallback: str = "") -> str:
    """Return only customer-facing reply text, without AI meta-introductions."""
    text = _repair_mojibake_text(value)
    text = text.replace("\ufeff", " ").strip()
    if not text:
        return " ".join(_repair_mojibake_text(fallback).split())

    text = re.sub(r"^```(?:\w+)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip())
    text = re.sub(r"^\s*[\"'«“”„]+|[\"'«»“”„]+$", "", text.strip())

    # Models sometimes return: "Вот вариант ответа...: --- Здравствуйте..."
    # Keep the part after the divider only when the first part is a meta preface.
    divider_match = re.search(r"(?:^|\n)\s*(?:---+|—{2,}|-{2,})\s*(?:\n|$)", text)
    if divider_match:
        before = text[: divider_match.start()]
        after = text[divider_match.end() :]
        if _REPLY_META_PREFIX_RE.search(before + ":") and after.strip():
            text = after.strip()

    for _ in range(4):
        previous = text
        text = _REPLY_META_PREFIX_RE.sub("", text).strip()
        text = re.sub(r"^\s*(?:[-–—•*]|\d+[.)])\s*", "", text).strip()
        text = re.sub(r"^\s*[\"'«“”„]+|[\"'«»“”„]+$", "", text.strip())
        if text == previous:
            break

    text = re.sub(r"\s+", " ", text).strip(" -–—")
    if len(text) < 2:
        return " ".join(_repair_mojibake_text(fallback).split())
    return text[:3000]


def _fallback_reply(review_text: str, product_name: str, stars: int | None, reviewer_name: str = "") -> str:
    clean_product = product_name.replace('"', " ").replace("'", " ").replace("\\", " ").strip()
    greeting = _build_greeting(reviewer_name)
    if stars is None:
        return f"{greeting} Спасибо за отзыв о товаре {clean_product}. Мы уже передали обратную связь в профильный отдел."
    if stars >= 5:
        return f"{greeting} Спасибо за высокую оценку товара {clean_product}. Приятно, что выбрали нас."
    if stars == 4:
        return f"{greeting} Спасибо за отзыв о товаре {clean_product}. Постараемся сделать сервис ещё удобнее, чтобы заслужить максимальную оценку."
    if stars <= 2:
        return (
            f"{greeting} Спасибо за отзыв о товаре {clean_product}. "
            "Нам жаль, что впечатление оказалось не лучшим. Пожалуйста, опишите ситуацию чуть подробнее, "
            "мы направим товар на проверку и разберемся в причине."
        )
    return (
        f"{greeting} Спасибо за отзыв о товаре {clean_product}. "
        "Нам важно ваше мнение, пожалуйста, уточните детали, чтобы мы могли улучшить качество."
    )


def _fallback_question_reply(question_text: str, product_name: str, reviewer_name: str = "") -> str:
    clean_product = product_name.replace('"', " ").replace("'", " ").replace("\\", " ").strip()
    greeting = _build_greeting(reviewer_name)
    q = " ".join((question_text or "").split())
    if not q:
        return f"{greeting} Спасибо за вопрос по товару {clean_product}. Пожалуйста, уточните детали, и мы оперативно поможем."
    return (
        f"{greeting} Спасибо за вопрос по товару {clean_product}. "
        "Проверим по вашей ситуации и подскажем точные параметры. "
        "Если можете, уточните нужный размер/модель и условия использования."
    )


def _extract_product_knowledge_context(prompt: str, max_chars: int = 4200) -> str:
    marker = "Контекст из модуля товаров SEO WIBE."
    text = str(prompt or "")
    start = text.find(marker)
    if start < 0:
        return ""
    section = text[start:]
    for tail_marker in (
        "\n\nРелевантные реальные примеры",
        "\n\nЖЕСТКИЕ ПРАВИЛА",
    ):
        pos = section.find(tail_marker)
        if pos > 0:
            section = section[:pos]
            break
    return " ".join(section[: max(800, int(max_chars or 4200))].split())


def _client_asks_catalog_article(text: str) -> bool:
    low = _repair_mojibake_text(text).lower()
    if len(re.findall(r"\d+[.,]\d+|\d{2,4}(?:[x\u0445/]\d{2,4})?", low, flags=re.IGNORECASE)) >= 2:
        return True
    markers = (
        "артикул",
        "подберите",
        "подобрать",
        "подбор",
        "какой",
        "какая",
        "какие",
        "нужен",
        "нужна",
        "нужны",
        "подойдет",
        "подходит",
        "совместим",
    )
    return any(marker in low for marker in markers)


def _extract_first_catalog_market_article(prompt: str, marketplace: str) -> tuple[str, str]:
    text = str(prompt or "")
    market = str(marketplace or "").strip().lower()
    if market == "ozon":
        match = re.search(r"Ozon product_id:\s*([A-Za-zА-Яа-яЁё0-9_./-]+)", text)
        return ("Ozon product_id", match.group(1).strip(".,;:") if match else "")
    match = re.search(r"WB nmID/артикул WB:\s*([A-Za-zА-Яа-яЁё0-9_./-]+)", text)
    return ("WB артикул", match.group(1).strip(".,;:") if match else "")


def _extract_catalog_market_articles(prompt: str, marketplace: str) -> list[str]:
    text = str(prompt or "")
    market = str(marketplace or "").strip().lower()
    pattern = (
        r"Ozon product_id:\s*([A-Za-zА-Яа-яЁё0-9_./-]+)"
        if market == "ozon"
        else r"WB nmID/артикул WB:\s*([A-Za-zА-Яа-яЁё0-9_./-]+)"
    )
    values: list[str] = []
    seen: set[str] = set()
    for match in re.finditer(pattern, text):
        value = match.group(1).strip(".,;:")
        if value and value not in seen:
            seen.add(value)
            values.append(value)
    return values


def _extract_catalog_identifiers(prompt: str, marketplace: str) -> set[str]:
    text = str(prompt or "")
    values = set(_extract_catalog_market_articles(text, marketplace))
    patterns = (
        r"артикул продавца:\s*([A-Za-zА-Яа-яЁё0-9_./-]+)",
        r"external_id:\s*([A-Za-zА-Яа-яЁё0-9_./-]+)",
        r"SKU:\s*([A-Za-zА-Яа-яЁё0-9_./-]+)",
        r"sku:\s*([A-Za-zА-Яа-яЁё0-9_./-]+)",
    )
    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            value = match.group(1).strip(".,;:")
            if value:
                values.add(value)
    return values


def _extract_answer_identifier_claims(answer: str) -> list[str]:
    text = str(answer or "")
    patterns = (
        r"(?:артикул(?:\s+(?:WB|Ozon|товара|продавца))?|product[_\s-]?id|nm\s*id|nmID|SKU|код товара|номер товара)\s*[:№#-]?\s*([A-Za-zА-Яа-яЁё0-9_./-]{3,})",
    )
    values: list[str] = []
    seen: set[str] = set()
    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            value = match.group(1).strip(".,;:").lower()
            if value and value not in seen:
                seen.add(value)
                values.append(value)
    return values


def _strip_article_claim_sentences(answer: str) -> str:
    text = sanitize_marketplace_reply_text(answer)
    if not text:
        return ""
    chunks = re.split(r"(?<=[.!?])\s+", text)
    kept: list[str] = []
    marker_re = re.compile(r"(артикул|product[_\s-]?id|nm\s*id|nmID|SKU|код товара|номер товара)", re.IGNORECASE)
    for chunk in chunks:
        clean = chunk.strip()
        if not clean:
            continue
        if marker_re.search(clean):
            continue
        kept.append(clean)
    return sanitize_marketplace_reply_text(" ".join(kept))


def _has_internal_catalog_warning(answer: str) -> bool:
    text = _repair_mojibake_text(answer).lower()
    if "catalog_size_unconfirmed" in text:
        return True
    markers = (
        "точное совпадение",
        "совпадение не подтверждено",
        "в найденных данных",
        "в найденных карточках",
        "служебная пометка",
        "внутренняя проверка",
        "контекст из модуля товаров",
    )
    return any(marker in text for marker in markers)


def _safe_uncertain_catalog_reply(client_text: str) -> str:
    numbers = re.findall(r"\d+[.,]\d+|\d{2,4}(?:[xх/]\d{2,4})?", str(client_text or ""), flags=re.IGNORECASE)
    size_hint = f" по размерам {' и '.join(dict.fromkeys(numbers))}" if numbers else ""
    return (
        f"Здравствуйте! Чтобы не ошибиться с подбором{size_hint}, нужно сверить посадочный диаметр, размер юбки/зонта "
        "и способ монтажа с характеристиками товара. Уточните, пожалуйста, нужный посадочный размер и тип установки, "
        "и мы подскажем подходящий вариант."
    )


def _ensure_catalog_article_in_reply(answer: str, prompt: str, client_text: str, *, marketplace: str) -> str:
    clean_answer = sanitize_marketplace_reply_text(answer)
    prompt_text = str(prompt or "")
    has_catalog_context = "Контекст из модуля товаров SEO WIBE." in prompt_text
    if not clean_answer:
        return clean_answer
    if _has_internal_catalog_warning(clean_answer):
        return sanitize_marketplace_reply_text(_safe_uncertain_catalog_reply(client_text))
    if not has_catalog_context:
        if _client_asks_catalog_article(client_text) and _extract_answer_identifier_claims(clean_answer):
            return sanitize_marketplace_reply_text(_safe_uncertain_catalog_reply(client_text))
        return clean_answer
    if not _client_asks_catalog_article(client_text):
        return clean_answer
    prompt_low = prompt_text.lower()
    if "catalog_size_unconfirmed" in prompt_low or "точное совпадение не подтверждено" in prompt_low:
        return sanitize_marketplace_reply_text(_safe_uncertain_catalog_reply(client_text))

    allowed_ids = {item.lower() for item in _extract_catalog_identifiers(prompt_text, marketplace) if item}
    bad_claims = [claim for claim in _extract_answer_identifier_claims(clean_answer) if claim.lower() not in allowed_ids]
    if bad_claims:
        clean_answer = _strip_article_claim_sentences(clean_answer) or "Нашли подходящий вариант в нашем каталоге."

    clean_answer_low = clean_answer.lower()
    if any(article and article.lower() in clean_answer_low for article in _extract_catalog_market_articles(prompt_text, marketplace)):
        return clean_answer
    article_label, article = _extract_first_catalog_market_article(prompt_text, marketplace)
    if not article or article.lower() in clean_answer_low:
        return clean_answer
    suffix = f" Подходящий вариант из нашего каталога: {article_label} {article}."
    return sanitize_marketplace_reply_text(f"{clean_answer.rstrip('.')}." + suffix)


def _build_reply_hard_rules(
    kind: str,
    product_name: str,
    client_text: str,
    *,
    has_product_knowledge_context: bool = False,
) -> str:
    safe_kind = "question" if str(kind or "").strip().lower() == "question" else "review"
    product = _repair_mojibake_text(product_name).strip().lower()
    text = _repair_mojibake_text(client_text).strip().lower()
    rules = [
        "ЖЕСТКИЕ ПРАВИЛА, их нельзя нарушать:",
        "- Не пиши, что мы уже проверили или исправили карточку, если это явно не дано.",
        "- Не обещай компенсацию, скидку, замену, возврат денег или личный чат.",
        "- Не выдумывай факты о товаре, составе, размере, совместимости, наличии, гарантии или безопасности.",
    ]
    generic_product = (
        not product
        or product in {"товар", "товар ozon", "товар wb"}
        or product.startswith("товар ozon")
        or product.startswith("товар wb")
    )
    if safe_kind == "question" and generic_product and not has_product_knowledge_context:
        rules.append(
            "- Текущий товар не определен. ЗАПРЕЩЕНО отвечать 'да, подойдет' или 'нет, не подойдет'. "
            "Ответь осторожно: нужно сверить точные характеристики в карточке товара, например размер, материал, внутренний диаметр и условия монтажа."
        )
    if safe_kind == "question" and not has_product_knowledge_context:
        rules.append(
            "- Если в контексте товаров нет конкретной карточки, ЗАПРЕЩЕНО называть артикулы, product_id, nmID, SKU, штрихкоды "
            "или другие номера товаров. Не подбирай товар по памяти и не используй артикулы не из нашей базы."
        )
    if safe_kind == "question" and has_product_knowledge_context:
        rules.append(
            "- Если в контексте из модуля товаров есть уверенно подходящая карточка, ОБЯЗАТЕЛЬНО опирайся на нее. "
            "Когда клиент спрашивает артикул, подбор, размер, совместимость или просит что-то посоветовать, укажи конкретный артикул из контекста: "
            "для WB это значение 'WB nmID/артикул WB', для Ozon это 'Ozon product_id'. "
            "Не пиши 'артикул указан в карточке', если номер артикула есть в контексте. "
            "Если в контексте есть [CATALOG_SIZE_UNCONFIRMED], не называй товар точным подбором и ответь клиенту естественно, без служебных формулировок."
        )
    technical_markers = (
        "электр",
        "статич",
        "инфракрас",
        "заземл",
        "напряж",
        "безопас",
        "монтаж",
        "пленк",
        "плёнк",
    )
    if safe_kind == "question" and any(marker in text for marker in technical_markers):
        rules.append(
            "- Текущий вопрос технический. ЗАПРЕЩЕНО утверждать, что товар точно безопасен/подходит "
            "или что статическое электричество будет/не будет. Пиши: нужно сверить характеристики, инструкцию и требования монтажа."
        )
    return "\n".join(rules)


def _resolve_ai_chat_endpoint(provider: str, base_url: str) -> str:
    raw_base = str(base_url or "").strip()
    if raw_base:
        base = raw_base.rstrip("/")
        if base.endswith("/chat/completions"):
            return base
        if base.endswith("/v1"):
            return f"{base}/chat/completions"
        return f"{base}/chat/completions"
    if str(provider or "").strip().lower() == "deepseek":
        return "https://api.deepseek.com/chat/completions"
    return "https://api.openai.com/v1/chat/completions"


def _build_ozon_headers(api_key: str) -> dict[str, str]:
    creds = _parse_ozon_credentials(api_key)
    if not creds:
        return {}
    client_id, token = creds
    return {
        "Client-Id": client_id,
        "Api-Key": token,
        "Content-Type": "application/json",
    }


def _parse_ozon_credentials(api_key: str) -> tuple[str, str] | None:
    if ":" not in api_key:
        return None
    left, right = api_key.split(":", 1)
    if not left.strip() or not right.strip():
        return None
    return left.strip(), right.strip()


def _build_greeting(reviewer_name: str) -> str:
    safe_name = _sanitize_person_name(reviewer_name)
    if safe_name:
        return f"Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ, {safe_name}!"
    return "Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ!"


def _sanitize_person_name(value: str) -> str:
    raw = " ".join((value or "").split())
    if not raw:
        return ""
    allowed = "".join(ch for ch in raw if ch.isalpha() or ch in {" ", "-"})
    compact = " ".join(allowed.split()).strip(" -")
    if len(compact) < 2:
        return ""
    return compact[:42]


def _build_greeting(reviewer_name: str) -> str:
    safe_name = _sanitize_person_name(_repair_mojibake_text(reviewer_name))
    return f"Здравствуйте, {safe_name}!" if safe_name else "Здравствуйте!"


def _fallback_reply(review_text: str, product_name: str, stars: int | None, reviewer_name: str = "") -> str:
    clean_product = _repair_mojibake_text(product_name).replace('"', " ").replace("'", " ").replace("\\", " ").strip() or "товар"
    greeting = _build_greeting(reviewer_name)
    if stars is None:
        return f"{greeting} Спасибо за отзыв о товаре {clean_product}. Мы передали обратную связь команде и учтем ее в работе."
    if stars >= 5:
        variants = [
            f"{greeting} Спасибо за высокую оценку товара {clean_product}. Рады, что покупка оставила хорошее впечатление.",
            f"{greeting} Благодарим за отзыв и отличную оценку. Приятно знать, что товар {clean_product} вам подошел.",
            f"{greeting} Спасибо, что поделились впечатлением. Очень рады, что вы остались довольны товаром {clean_product}.",
        ]
    elif stars == 4:
        variants = [
            f"{greeting} Спасибо за отзыв о товаре {clean_product}. Учтем ваши замечания и постараемся сделать опыт покупки еще лучше.",
            f"{greeting} Благодарим за оценку и обратную связь. Ваш отзыв поможет нам улучшать товар {clean_product} и сервис.",
            f"{greeting} Спасибо, что написали нам. Рады, что товар {clean_product} в целом понравился, замечания обязательно учтем.",
        ]
    elif stars <= 2:
        variants = [
            f"{greeting} Спасибо, что написали о товаре {clean_product}. Нам жаль, что впечатление оказалось не лучшим. Передадим информацию на проверку.",
            f"{greeting} Благодарим за обратную связь. Сожалеем, что товар {clean_product} не оправдал ожидания, разберемся в ситуации.",
            f"{greeting} Спасибо за отзыв. Нам важно разобраться, что пошло не так с товаром {clean_product}, поэтому передадим информацию ответственным коллегам.",
        ]
    else:
        variants = [
            f"{greeting} Спасибо за отзыв о товаре {clean_product}. Нам важно ваше мнение, оно помогает улучшать качество и сервис.",
            f"{greeting} Благодарим за обратную связь по товару {clean_product}. Мы внимательно относимся к таким комментариям.",
            f"{greeting} Спасибо, что поделились впечатлением о товаре {clean_product}. Ваш отзыв поможет нам стать лучше.",
        ]
    seed = int(hashlib.sha1(f"{clean_product}|{review_text}|{stars}".encode("utf-8", errors="ignore")).hexdigest()[:8], 16)
    return variants[seed % len(variants)]


def _fallback_question_reply(question_text: str, product_name: str, reviewer_name: str = "") -> str:
    clean_product = _repair_mojibake_text(product_name).replace('"', " ").replace("'", " ").replace("\\", " ").strip() or "товар"
    greeting = _build_greeting(reviewer_name)
    q = " ".join(_repair_mojibake_text(question_text).split())
    if not q:
        return f"{greeting} Спасибо за вопрос по товару {clean_product}. Пожалуйста, уточните детали, и мы оперативно поможем."
    return (
        f"{greeting} Спасибо за вопрос по товару {clean_product}. "
        "Проверим информацию и подскажем точные параметры. Если можете, уточните нужный размер, модель или условия использования."
    )


def _build_greeting(reviewer_name: str) -> str:
    safe_name = _sanitize_person_name(_repair_mojibake_text(reviewer_name))
    return f"\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435, {safe_name}!" if safe_name else "\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435!"


def _fallback_reply(review_text: str, product_name: str, stars: int | None, reviewer_name: str = "") -> str:
    clean_product = _repair_mojibake_text(product_name).replace('"', " ").replace("'", " ").replace("\\", " ").strip() or "\u0442\u043e\u0432\u0430\u0440"
    greeting = _build_greeting(reviewer_name)
    if stars is None:
        return f"{greeting} \u0421\u043f\u0430\u0441\u0438\u0431\u043e \u0437\u0430 \u043e\u0442\u0437\u044b\u0432 \u043e \u0442\u043e\u0432\u0430\u0440\u0435 {clean_product}. \u041c\u044b \u043f\u0435\u0440\u0435\u0434\u0430\u043b\u0438 \u043e\u0431\u0440\u0430\u0442\u043d\u0443\u044e \u0441\u0432\u044f\u0437\u044c \u043a\u043e\u043c\u0430\u043d\u0434\u0435 \u0438 \u0443\u0447\u0442\u0435\u043c \u0435\u0435 \u0432 \u0440\u0430\u0431\u043e\u0442\u0435."
    if stars >= 5:
        variants = [
            f"{greeting} \u0421\u043f\u0430\u0441\u0438\u0431\u043e \u0437\u0430 \u0432\u044b\u0441\u043e\u043a\u0443\u044e \u043e\u0446\u0435\u043d\u043a\u0443 \u0442\u043e\u0432\u0430\u0440\u0430 {clean_product}. \u0420\u0430\u0434\u044b, \u0447\u0442\u043e \u043f\u043e\u043a\u0443\u043f\u043a\u0430 \u043e\u0441\u0442\u0430\u0432\u0438\u043b\u0430 \u0445\u043e\u0440\u043e\u0448\u0435\u0435 \u0432\u043f\u0435\u0447\u0430\u0442\u043b\u0435\u043d\u0438\u0435.",
            f"{greeting} \u0411\u043b\u0430\u0433\u043e\u0434\u0430\u0440\u0438\u043c \u0437\u0430 \u043e\u0442\u0437\u044b\u0432 \u0438 \u043e\u0442\u043b\u0438\u0447\u043d\u0443\u044e \u043e\u0446\u0435\u043d\u043a\u0443. \u041f\u0440\u0438\u044f\u0442\u043d\u043e \u0437\u043d\u0430\u0442\u044c, \u0447\u0442\u043e \u0442\u043e\u0432\u0430\u0440 {clean_product} \u0432\u0430\u043c \u043f\u043e\u0434\u043e\u0448\u0435\u043b.",
            f"{greeting} \u0421\u043f\u0430\u0441\u0438\u0431\u043e, \u0447\u0442\u043e \u043f\u043e\u0434\u0435\u043b\u0438\u043b\u0438\u0441\u044c \u0432\u043f\u0435\u0447\u0430\u0442\u043b\u0435\u043d\u0438\u0435\u043c. \u041e\u0447\u0435\u043d\u044c \u0440\u0430\u0434\u044b, \u0447\u0442\u043e \u0432\u044b \u043e\u0441\u0442\u0430\u043b\u0438\u0441\u044c \u0434\u043e\u0432\u043e\u043b\u044c\u043d\u044b \u0442\u043e\u0432\u0430\u0440\u043e\u043c {clean_product}.",
        ]
    elif stars == 4:
        variants = [
            f"{greeting} \u0421\u043f\u0430\u0441\u0438\u0431\u043e \u0437\u0430 \u043e\u0442\u0437\u044b\u0432 \u043e \u0442\u043e\u0432\u0430\u0440\u0435 {clean_product}. \u0423\u0447\u0442\u0435\u043c \u0432\u0430\u0448\u0438 \u0437\u0430\u043c\u0435\u0447\u0430\u043d\u0438\u044f \u0438 \u043f\u043e\u0441\u0442\u0430\u0440\u0430\u0435\u043c\u0441\u044f \u0441\u0434\u0435\u043b\u0430\u0442\u044c \u043e\u043f\u044b\u0442 \u043f\u043e\u043a\u0443\u043f\u043a\u0438 \u0435\u0449\u0435 \u043b\u0443\u0447\u0448\u0435.",
            f"{greeting} \u0411\u043b\u0430\u0433\u043e\u0434\u0430\u0440\u0438\u043c \u0437\u0430 \u043e\u0446\u0435\u043d\u043a\u0443 \u0438 \u043e\u0431\u0440\u0430\u0442\u043d\u0443\u044e \u0441\u0432\u044f\u0437\u044c. \u0412\u0430\u0448 \u043e\u0442\u0437\u044b\u0432 \u043f\u043e\u043c\u043e\u0436\u0435\u0442 \u043d\u0430\u043c \u0443\u043b\u0443\u0447\u0448\u0430\u0442\u044c \u0442\u043e\u0432\u0430\u0440 {clean_product} \u0438 \u0441\u0435\u0440\u0432\u0438\u0441.",
        ]
    elif stars <= 2:
        variants = [
            f"{greeting} \u0421\u043f\u0430\u0441\u0438\u0431\u043e, \u0447\u0442\u043e \u043d\u0430\u043f\u0438\u0441\u0430\u043b\u0438 \u043e \u0442\u043e\u0432\u0430\u0440\u0435 {clean_product}. \u041d\u0430\u043c \u0436\u0430\u043b\u044c, \u0447\u0442\u043e \u0432\u043f\u0435\u0447\u0430\u0442\u043b\u0435\u043d\u0438\u0435 \u043e\u043a\u0430\u0437\u0430\u043b\u043e\u0441\u044c \u043d\u0435 \u043b\u0443\u0447\u0448\u0438\u043c. \u041f\u0435\u0440\u0435\u0434\u0430\u0434\u0438\u043c \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044e \u043d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0443.",
            f"{greeting} \u0411\u043b\u0430\u0433\u043e\u0434\u0430\u0440\u0438\u043c \u0437\u0430 \u043e\u0431\u0440\u0430\u0442\u043d\u0443\u044e \u0441\u0432\u044f\u0437\u044c. \u0421\u043e\u0436\u0430\u043b\u0435\u0435\u043c, \u0447\u0442\u043e \u0442\u043e\u0432\u0430\u0440 {clean_product} \u043d\u0435 \u043e\u043f\u0440\u0430\u0432\u0434\u0430\u043b \u043e\u0436\u0438\u0434\u0430\u043d\u0438\u044f, \u0440\u0430\u0437\u0431\u0435\u0440\u0435\u043c\u0441\u044f \u0432 \u0441\u0438\u0442\u0443\u0430\u0446\u0438\u0438.",
        ]
    else:
        variants = [
            f"{greeting} \u0421\u043f\u0430\u0441\u0438\u0431\u043e \u0437\u0430 \u043e\u0442\u0437\u044b\u0432 \u043e \u0442\u043e\u0432\u0430\u0440\u0435 {clean_product}. \u041d\u0430\u043c \u0432\u0430\u0436\u043d\u043e \u0432\u0430\u0448\u0435 \u043c\u043d\u0435\u043d\u0438\u0435, \u043e\u043d\u043e \u043f\u043e\u043c\u043e\u0433\u0430\u0435\u0442 \u0443\u043b\u0443\u0447\u0448\u0430\u0442\u044c \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u043e \u0438 \u0441\u0435\u0440\u0432\u0438\u0441.",
            f"{greeting} \u0411\u043b\u0430\u0433\u043e\u0434\u0430\u0440\u0438\u043c \u0437\u0430 \u043e\u0431\u0440\u0430\u0442\u043d\u0443\u044e \u0441\u0432\u044f\u0437\u044c \u043f\u043e \u0442\u043e\u0432\u0430\u0440\u0443 {clean_product}. \u041c\u044b \u0432\u043d\u0438\u043c\u0430\u0442\u0435\u043b\u044c\u043d\u043e \u043e\u0442\u043d\u043e\u0441\u0438\u043c\u0441\u044f \u043a \u0442\u0430\u043a\u0438\u043c \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u044f\u043c.",
        ]
    seed = int(hashlib.sha1(f"{clean_product}|{review_text}|{stars}".encode("utf-8", errors="ignore")).hexdigest()[:8], 16)
    return variants[seed % len(variants)]


def _fallback_question_reply(question_text: str, product_name: str, reviewer_name: str = "") -> str:
    clean_product = _repair_mojibake_text(product_name).replace('"', " ").replace("'", " ").replace("\\", " ").strip() or "\u0442\u043e\u0432\u0430\u0440"
    greeting = _build_greeting(reviewer_name)
    q = " ".join(_repair_mojibake_text(question_text).split())
    if not q:
        return f"{greeting} \u0421\u043f\u0430\u0441\u0438\u0431\u043e \u0437\u0430 \u0432\u043e\u043f\u0440\u043e\u0441 \u043f\u043e \u0442\u043e\u0432\u0430\u0440\u0443 {clean_product}. \u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0443\u0442\u043e\u0447\u043d\u0438\u0442\u0435 \u0434\u0435\u0442\u0430\u043b\u0438, \u0438 \u043c\u044b \u043e\u043f\u0435\u0440\u0430\u0442\u0438\u0432\u043d\u043e \u043f\u043e\u043c\u043e\u0436\u0435\u043c."
    return (
        f"{greeting} \u0421\u043f\u0430\u0441\u0438\u0431\u043e \u0437\u0430 \u0432\u043e\u043f\u0440\u043e\u0441 \u043f\u043e \u0442\u043e\u0432\u0430\u0440\u0443 {clean_product}. "
        "\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u043c \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044e \u0438 \u043f\u043e\u0434\u0441\u043a\u0430\u0436\u0435\u043c \u0442\u043e\u0447\u043d\u044b\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b. \u0415\u0441\u043b\u0438 \u043c\u043e\u0436\u0435\u0442\u0435, \u0443\u0442\u043e\u0447\u043d\u0438\u0442\u0435 \u043d\u0443\u0436\u043d\u044b\u0439 \u0440\u0430\u0437\u043c\u0435\u0440, \u043c\u043e\u0434\u0435\u043b\u044c \u0438\u043b\u0438 \u0443\u0441\u043b\u043e\u0432\u0438\u044f \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u044f."
    )


def _extract_answer_text(*values: Any) -> str:
    for value in values:
        text = _extract_answer_text_from_value(value)
        if text:
            return text
    return ""


def _extract_photo_urls(*values: Any) -> list[str]:
    seen: set[str] = set()
    urls: list[str] = []

    def add_url(raw: str):
        normalized = _normalize_url(raw)
        if not normalized or normalized in seen:
            return
        seen.add(normalized)
        urls.append(normalized)

    def walk(value: Any):
        if isinstance(value, str):
            maybe = value.strip()
            if maybe.startswith("http://") or maybe.startswith("https://") or maybe.startswith("//"):
                add_url(maybe)
            return
        if isinstance(value, list):
            for item in value:
                walk(item)
            return
        if isinstance(value, dict):
            for key in ("url", "src", "link", "full", "big", "tm", "preview", "small", "value"):
                walk(value.get(key))
            for nested in value.values():
                if isinstance(nested, (list, dict)):
                    walk(nested)
            return

    for value in values:
        walk(value)
    return urls


def _normalize_url(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    if raw.startswith("//"):
        return f"https:{raw}"
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    return ""


def _extract_answer_text_from_value(value: Any) -> str:
    if isinstance(value, str):
        return " ".join(value.split())
    if isinstance(value, dict):
        for key in ("text", "answerText", "answer", "comment", "message", "content", "reply"):
            text = _extract_answer_text_from_value(value.get(key))
            if text:
                return text
        for key in ("comments", "data", "result", "response", "responses"):
            text = _extract_answer_text_from_value(value.get(key))
            if text:
                return text
        return ""
    if isinstance(value, list):
        for item in value:
            text = _extract_answer_text_from_value(item)
            if text:
                return text
    return ""


def _pick_first_path_text(source: dict[str, Any], *paths: str) -> str:
    for path in paths:
        value = _value_by_path(source, path)
        text = _normalize_scalar_text(value)
        if text:
            return text
    return ""


def _value_by_path(source: Any, path: str) -> Any:
    cursor = source
    chunks = [x for x in str(path or "").split(".") if x]
    if not chunks:
        return None
    for chunk in chunks:
        if isinstance(cursor, dict):
            cursor = cursor.get(chunk)
            continue
        if isinstance(cursor, list):
            try:
                idx = int(chunk)
            except Exception:
                return None
            if idx < 0 or idx >= len(cursor):
                return None
            cursor = cursor[idx]
            continue
        return None
    return cursor


def _normalize_scalar_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        text = value.strip()
    elif isinstance(value, bool):
        text = ""
    elif isinstance(value, (int, float)):
        text = str(int(value)) if isinstance(value, float) and value.is_integer() else str(value)
    elif isinstance(value, dict):
        text = _pick_first_str(
            value.get("name"),
            value.get("title"),
            value.get("label"),
            value.get("text"),
            value.get("value"),
            value.get("code"),
            value.get("status"),
            value.get("id"),
        )
    elif isinstance(value, list):
        for item in value:
            text = _normalize_scalar_text(item)
            if text:
                return text
        return ""
    else:
        text = ""
    low = text.strip().lower()
    if low in {"", "-", "вЂ”", "null", "none", "undefined"}:
        return ""
    return text.strip()


def _pick_first_str(*values: Any) -> str:
    for value in values:
        if isinstance(value, str):
            compact = value.strip()
            if compact:
                return compact
        if isinstance(value, (int, float)):
            return str(value)
    return ""


def _join_non_empty(parts: list[str]) -> str:
    return "\n".join([x for x in parts if x])


def _is_truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "y", "ok"}
    return False



