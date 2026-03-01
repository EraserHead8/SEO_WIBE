from __future__ import annotations

from datetime import date, datetime, timedelta
import math
import time
from typing import Any

import httpx

from app.config import settings


WB_TIMEOUT = httpx.Timeout(connect=6.0, read=18.0, write=18.0, pool=18.0)
OZON_TIMEOUT = httpx.Timeout(connect=6.0, read=22.0, write=22.0, pool=22.0)


def fetch_wb_reviews(
    api_key: str,
    stars: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    max_pages: int = 12,
) -> dict[str, list[dict[str, Any]]]:
    new_rows = _fetch_reviews_by_answer_state(api_key, is_answered=False, stars=stars, max_pages=max_pages)
    answered_rows = _fetch_reviews_by_answer_state(api_key, is_answered=True, stars=stars, max_pages=max_pages)
    if not answered_rows:
        mixed_rows = _fetch_reviews_mixed(api_key, stars=stars, max_pages=max_pages)
        if mixed_rows:
            for item in mixed_rows:
                if _looks_answered_feedback(item):
                    answered_rows.append(item)
                else:
                    new_rows.append(item)
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
    rows = _fetch_reviews_mixed(api_key, stars=stars, max_pages=1, include_archive=False)
    if not rows:
        rows = _fetch_reviews_by_answer_state(api_key, is_answered=False, stars=stars, max_pages=1, include_archive=False)
        rows.extend(_fetch_reviews_by_answer_state(api_key, is_answered=True, stars=stars, max_pages=1, include_archive=False))
    rows = _dedupe_review_rows(rows)
    normalized_all = [_normalize_review_row(item, is_answered=_looks_answered_feedback(item)) for item in rows]
    normalized_new = [row for row in normalized_all if not row.get("is_answered")]
    normalized_answered = [row for row in normalized_all if row.get("is_answered")]
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
    if not answered_rows:
        mixed_rows = _fetch_wb_questions_mixed(api_key, stars=stars, max_pages=max_pages)
        if mixed_rows:
            for item in mixed_rows:
                if _looks_answered_feedback(item):
                    answered_rows.append(item)
                else:
                    new_rows.append(item)

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
    rows = _fetch_wb_questions_mixed(api_key, stars=stars, max_pages=1, include_archive=False)
    if not rows:
        rows = _fetch_wb_questions_by_answer_state(api_key, is_answered=False, stars=stars, max_pages=1, include_archive=False)
        rows.extend(_fetch_wb_questions_by_answer_state(api_key, is_answered=True, stars=stars, max_pages=1, include_archive=False))
    rows = _dedupe_review_rows(rows)
    normalized_all = [_normalize_wb_question_row(item, is_answered=_looks_answered_feedback(item)) for item in rows]
    normalized_new = [row for row in normalized_all if not row.get("is_answered")]
    normalized_answered = [row for row in normalized_all if row.get("is_answered")]
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
        return False, "WB API ключ не задан."
    kind = (feedback_kind or "reviews").strip().lower()
    endpoint = "https://feedbacks-api.wildberries.ru/api/v1/questions" if kind == "questions" else "https://feedbacks-api.wildberries.ru/api/v1/feedbacks"
    params = {"take": 1, "skip": 0}
    last_error = "WB feedback API недоступен."
    for auth_value in (token, f"Bearer {token}"):
        headers = {"Authorization": auth_value, "Content-Type": "application/json"}
        try:
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
        return False, "Ozon ключ должен быть в формате client_id:api_key."
    payload = {"limit": 1, "last_id": "", "sort_dir": "DESC", "status": "ALL"}
    try:
        with httpx.Client(timeout=OZON_TIMEOUT, follow_redirects=True) as client:
            response = client.post(endpoint, headers=headers, json=payload)
    except Exception:
        return False, "Ozon API недоступен."
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


def fetch_wb_campaign_details(api_key: str, campaign_id: int) -> dict[str, Any]:
    summary: dict[str, Any] = {"campaign_id": campaign_id}
    raw: dict[str, Any] = {}

    for idx, item in enumerate(_campaign_detail_requests(campaign_id), start=1):
        method = item.get("method", "GET")
        endpoint = str(item.get("endpoint") or "")
        params = item.get("params")
        payload = item.get("payload")
        if not endpoint:
            continue
        data = _request_wb_json(method, endpoint, api_key=api_key, params=params, payload=payload)
        if data is None:
            continue
        raw[f"{idx}:{method}:{endpoint}"] = data
        summary = _merge_campaign_summary(summary, _extract_campaign_summary(data, campaign_id))

    rates: dict[str, Any] = {}
    for campaign_type in ("search", "auto-cpm"):
        data = fetch_wb_campaign_rates(api_key=api_key, campaign_id=campaign_id, campaign_type=campaign_type)
        if data is not None:
            rates[campaign_type] = data

    if summary.get("type") in (None, "", "-"):
        if "search" in rates and "auto-cpm" not in rates:
            summary["type"] = "search"
        elif "auto-cpm" in rates and "search" not in rates:
            summary["type"] = "auto-cpm"
    if summary.get("status") in (None, "", "-") and rates:
        summary["status"] = "available"

    stats = fetch_wb_campaign_stats(api_key=api_key, campaign_id=campaign_id, days=7)
    products = _extract_campaign_products(list(raw.values()))
    return {
        "summary": summary,
        "products": products,
        "rates": rates,
        "stats": stats or {},
        "raw": raw,
    }


def post_wb_review_reply(api_key: str, feedback_id: str, text: str) -> tuple[bool, str]:
    if not feedback_id.strip():
        return False, "Не указан ID отзыва"
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
        try:
            with httpx.Client(timeout=WB_TIMEOUT, follow_redirects=True) as client:
                response = client.post(endpoint, headers=headers, json=payload)
        except Exception:
            continue
        if response.status_code in {200, 204}:
            return True, "Ответ отправлен"
        if response.status_code in {401, 403}:
            continue
        body = _safe_response_text(response)
        return False, f"WB API вернул {response.status_code}: {body}"
    return False, "Не удалось авторизоваться в WB API"


def post_wb_question_reply(api_key: str, question_id: str, text: str) -> tuple[bool, str]:
    if not question_id.strip():
        return False, "Не указан ID вопроса"
    reply = " ".join(text.split())
    if len(reply) < 2:
        return False, "Ответ слишком короткий"
    if len(reply) > 3000:
        return False, "Ответ слишком длинный (максимум 3000 символов)"

    endpoints = [
        "https://feedbacks-api.wildberries.ru/api/v1/questions/answer",
        "https://feedbacks-api.wildberries.ru/api/v1/question/answer",
    ]
    payloads = [{"id": question_id.strip(), "text": reply}, {"questionId": question_id.strip(), "text": reply}]
    last_error = "Не удалось отправить ответ в WB API"
    for endpoint in endpoints:
        for payload in payloads:
            for auth_value in (api_key.strip(), f"Bearer {api_key.strip()}"):
                headers = {"Authorization": auth_value, "Content-Type": "application/json"}
                try:
                    with httpx.Client(timeout=WB_TIMEOUT, follow_redirects=True) as client:
                        response = client.post(endpoint, headers=headers, json=payload)
                except Exception:
                    continue
                if response.status_code in {200, 204}:
                    return True, "Ответ отправлен"
                if response.status_code in {401, 403}:
                    continue
                body = _safe_response_text(response)
                if body:
                    last_error = f"WB API вернул {response.status_code}: {body}"
    return False, last_error


def post_ozon_review_reply(api_key: str, review_id: str, text: str) -> tuple[bool, str]:
    if not review_id.strip():
        return False, "Не указан ID отзыва"
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
            response = _request_ozon_response("POST", endpoint, api_key=api_key, payload=payload)
            if response is None:
                continue
            if response.status_code < 400:
                return True, "Ответ отправлен"
            body = _safe_response_text(response)
            if body:
                last_error = f"Ozon API вернул {response.status_code}: {body}"
    return False, last_error


def post_ozon_question_reply(api_key: str, question_id: str, text: str) -> tuple[bool, str]:
    if not question_id.strip():
        return False, "Не указан ID вопроса"
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

    payloads: list[dict[str, Any]] = [
        {"question_id": raw_id, "text": reply},
        {"id": raw_id, "text": reply},
    ]
    if int_id is not None:
        payloads.extend([{"question_id": int_id, "text": reply}, {"id": int_id, "text": reply}])

    endpoints = [
        "https://api-seller.ozon.ru/v1/question/answer/create",
        "https://api-seller.ozon.ru/v1/question/answer/update",
        "https://api-seller.ozon.ru/v1/question/answer",
    ]
    last_error = "Не удалось отправить ответ в Ozon API"
    for endpoint in endpoints:
        for payload in payloads:
            response = _request_ozon_response("POST", endpoint, api_key=api_key, payload=payload)
            if response is None:
                continue
            if response.status_code < 400:
                return True, "Ответ отправлен"
            body = _safe_response_text(response)
            if body:
                last_error = f"Ozon API вернул {response.status_code}: {body}"
    return False, last_error


def generate_review_reply(
    review_text: str,
    product_name: str,
    stars: int | None,
    prompt: str = "",
    reviewer_name: str = "",
    marketplace: str = "wb",
    content_kind: str = "review",
) -> str:
    review = (review_text or "").strip()
    product = (product_name or "").strip() or "товар"
    rating = stars if isinstance(stars, int) else None
    custom_prompt = (prompt or "").strip()
    customer_name = _sanitize_person_name(reviewer_name)
    mp = "Ozon" if (marketplace or "").strip().lower() == "ozon" else "WB"
    kind = "question" if (content_kind or "").strip().lower() == "question" else "review"

    fallback = _fallback_question_reply(review, product, customer_name) if kind == "question" else _fallback_reply(review, product, rating, customer_name)
    if not settings.openai_api_key:
        return fallback

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
            f"Товар: {product}\n"
            f"Маркетплейс: {mp}\n\n"
            "Сформируй только текст ответа клиенту."
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
            f"Товар: {product}\n"
            f"Маркетплейс: {mp}\n"
            f"Оценка: {rating if rating is not None else 'не указана'}\n\n"
            "Сформируй только текст ответа клиенту."
        )
    payload = {
        "model": settings.openai_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.6,
        "max_tokens": 260,
    }
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client(timeout=WB_TIMEOUT, follow_redirects=True) as client:
            response = client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        if response.status_code >= 400:
            return fallback
        data = response.json()
        reply = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
        if not reply:
            return fallback
        return " ".join(reply.split())
    except Exception:
        return fallback


def fetch_wb_campaigns(api_key: str, enrich: bool = True) -> list[dict[str, Any]]:
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

    discovered_ids: list[int] = []
    for method, endpoint, payload in attempts:
        data = _request_wb_json(method, endpoint, api_key=api_key, payload=payload)
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
        count_data = _request_wb_json(method, endpoint, api_key=api_key, payload=payload)
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


def fetch_wb_campaign_summaries(api_key: str, campaign_ids: list[int], fallback_limit: int = 120) -> dict[str, dict[str, Any]]:
    ids = sorted({int(x) for x in campaign_ids if int(x) > 0})
    if not ids:
        return {}

    out: dict[str, dict[str, Any]] = {}
    detail_map = _fetch_wb_campaign_detail_map(api_key, ids)
    for cid in ids:
        row = detail_map.get(str(cid))
        if row:
            out[str(cid)] = _extract_campaign_summary(row, cid)

    missing = [cid for cid in ids if _summary_needs_enrichment(out.get(str(cid), {}), cid)]
    for cid in missing[: max(0, int(fallback_limit))]:
        quick_map = _fetch_wb_campaign_detail_map(api_key, [cid])
        quick_row = quick_map.get(str(cid))
        if quick_row:
            quick_summary = _extract_campaign_summary(quick_row, cid)
            out[str(cid)] = _merge_campaign_summary(out.get(str(cid), {"campaign_id": cid}), quick_summary)
            if not _summary_needs_enrichment(out.get(str(cid), {}), cid):
                continue
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
    rows: list[dict[str, Any]] = []
    for chunk_start in range(0, len(ids), 40):
        chunk = ids[chunk_start:chunk_start + 40]
        ids_csv = ",".join(str(x) for x in chunk)
        got_chunk = False
        for endpoint in endpoints:
            params = {"ids": ids_csv, "beginDate": left.isoformat(), "endDate": right.isoformat()}
            data = _request_wb_json("GET", endpoint, api_key=api_key, params=params)
            dict_rows = _as_dict_list(data) if data is not None else []
            if dict_rows:
                rows.extend(dict_rows)
                got_chunk = True
                break

            payload_variants: list[dict[str, Any]] = [
                {"ids": chunk, "from": left.isoformat(), "to": right.isoformat()},
                {"id": chunk, "from": left.isoformat(), "to": right.isoformat()},
                {"advertIds": chunk, "from": left.isoformat(), "to": right.isoformat()},
            ]
            posted = False
            for payload in payload_variants:
                pdata = _request_wb_json("POST", endpoint, api_key=api_key, payload=payload)
                dict_rows = _as_dict_list(pdata) if pdata is not None else []
                if dict_rows:
                    rows.extend(dict_rows)
                    posted = True
                    break
            if posted:
                got_chunk = True
                break

        if not got_chunk:
            continue

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


def _fetch_wb_campaign_detail_map(api_key: str, ids: list[int]) -> dict[str, dict[str, Any]]:
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
    for cid in ids[:60]:
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


def fetch_wb_campaign_rates(api_key: str, campaign_id: int, campaign_type: str) -> dict[str, Any] | None:
    ctype = (campaign_type or "").strip().lower()
    if ctype == "search":
        endpoint = f"https://advert-api.wb.ru/adv/v1/search/{campaign_id}/rates"
    elif ctype == "auto-cpm":
        endpoint = f"https://advert-api.wb.ru/adv/v1/auto-cpm/{campaign_id}/rates"
    else:
        return None
    return _request_wb_json("GET", endpoint, api_key=api_key)


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


def fetch_wb_campaign_stats(api_key: str, campaign_id: int, days: int = 7) -> dict[str, Any] | None:
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
        "https://advert-api.wb.ru/adv/v3/fullstats",
        "https://advert-api.wildberries.ru/adv/v3/fullstats",
    ]
    for endpoint in endpoints:
        for params in params_variants:
            data = _request_wb_json("GET", endpoint, api_key=api_key, params=params)
            if isinstance(data, dict):
                return data
            if isinstance(data, list):
                return {"items": data}
        for payload in payload_variants:
            data = _request_wb_json("POST", endpoint, api_key=api_key, payload=payload)
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


def _merge_campaign_summary(base: dict[str, Any], extra: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in extra.items():
        if value in (None, "", "-", [], {}):
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

    name = _pick_first_str(
        target_row.get("name"),
        target_row.get("campaignName"),
        target_row.get("campaign_name"),
        settings.get("name"),
        settings.get("title"),
        target_row.get("subject"),
        target_row.get("title"),
    )
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
        target_row.get("typeName"),
        target_row.get("bid_type"),
        settings.get("bid_type"),
        settings.get("type"),
    )
    budget = _pick_first_str(
        target_row.get("dailyBudget"),
        target_row.get("budget"),
        target_row.get("sum"),
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
    include_archive: bool = True,
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
    include_archive: bool = True,
) -> list[dict[str, Any]]:
    endpoints = ["https://feedbacks-api.wildberries.ru/api/v1/questions"]
    if include_archive:
        endpoints.append("https://feedbacks-api.wildberries.ru/api/v1/questions/archive")
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
    endpoints = ["https://feedbacks-api.wildberries.ru/api/v1/questions"]
    if include_archive:
        endpoints.append("https://feedbacks-api.wildberries.ru/api/v1/questions/archive")
    rows: list[dict[str, Any]] = []
    for endpoint in endpoints:
        rows.extend(_fetch_wb_question_rows(api_key, endpoint=endpoint, is_answered=None, stars=stars, max_pages=max_pages))
    return _dedupe_review_rows(rows)


def _fetch_wb_question_rows(
    api_key: str,
    endpoint: str,
    is_answered: bool | None,
    stars: int | None,
    max_pages: int = 12,
) -> list[dict[str, Any]]:
    take = 100
    skip = 0
    max_pages = max(1, min(int(max_pages or 1), 20))
    all_rows: list[dict[str, Any]] = []
    for _ in range(max_pages):
        params: dict[str, Any] = {"take": take, "skip": skip}
        if is_answered is not None:
            params["isAnswered"] = is_answered
        if isinstance(stars, int) and 1 <= stars <= 5:
            params["rating"] = stars
        data = _request_wb_json("GET", endpoint, api_key=api_key, params=params)
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
    take = 100
    skip = 0
    max_pages = max(1, min(int(max_pages or 1), 20))
    all_rows: list[dict[str, Any]] = []
    for _ in range(max_pages):
        params: dict[str, Any] = {"take": take, "skip": skip}
        if is_answered is not None:
            params["isAnswered"] = is_answered
        if isinstance(stars, int) and 1 <= stars <= 5:
            params["rating"] = stars
        data = _request_wb_json("GET", endpoint, api_key=api_key, params=params)
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
) -> dict[str, Any] | list[dict[str, Any]] | None:
    token = api_key.strip()
    if not token:
        return None
    auth_variants = [token, f"Bearer {token}"]
    for auth_value in auth_variants:
        headers = {"Authorization": auth_value, "Content-Type": "application/json"}
        for attempt in range(4):
            response = None
            try:
                with httpx.Client(timeout=WB_TIMEOUT, follow_redirects=True) as client:
                    if method == "POST":
                        response = client.post(url, headers=headers, params=params, json=payload)
                    else:
                        response = client.get(url, headers=headers, params=params)
            except Exception:
                response = None
            if response is None:
                if attempt < 3:
                    time.sleep(0.35 * (attempt + 1))
                continue
            if response.status_code == 429:
                if attempt < 3:
                    time.sleep(0.65 * (attempt + 1))
                    continue
                break
            if response.status_code in {401, 403}:
                break
            if response.status_code >= 400:
                break
            try:
                parsed = response.json()
                if isinstance(parsed, (dict, list)):
                    return parsed
            except Exception:
                break
    return None


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
        "barcode": _pick_first_str(product.get("imtId"), product.get("barcode"), row.get("barcode")),
        "stars": stars,
        "text": text,
        "user": user_name,
        "answer": answer_text.strip(),
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
    article = _pick_first_str(
        core.get("offer_id"),
        core.get("sku"),
        core.get("product_id"),
        product.get("offer_id") if isinstance(product, dict) else "",
        product.get("sku") if isinstance(product, dict) else "",
        mapped.get("article"),
    )
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
        "barcode": barcode,
        "stars": stars,
        "text": text,
        "user": user_name,
        "answer": answer_text,
        "is_answered": is_answered,
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
        "product": str(product.get("productName") or product.get("nmId") or row.get("productName") or "Товар WB"),
        "article": str(product.get("nmId") or row.get("nmId") or row.get("offerId") or ""),
        "barcode": _pick_first_str(product.get("barcode"), row.get("barcode")),
        "stars": stars,
        "text": text,
        "user": user_name,
        "answer": answer_text.strip(),
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
    article = _pick_first_str(
        core.get("offer_id"),
        core.get("sku"),
        core.get("product_id"),
        product.get("offer_id") if isinstance(product, dict) else "",
        product.get("sku") if isinstance(product, dict) else "",
        mapped.get("article"),
    )
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
        "barcode": barcode,
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
    settings = row.get("settings") if isinstance(row.get("settings"), dict) else {}
    for key in ("name", "campaignName", "campaign_name", "status", "state", "type", "adType", "campaignType", "bid_type"):
        value = row.get(key)
        if value not in (None, "", "-", []):
            return True
    for key in ("name", "title", "status", "type", "bid_type"):
        value = settings.get(key)
        if value not in (None, "", "-", []):
            return True
    return False


def _summary_has_context(summary: dict[str, Any]) -> bool:
    if not isinstance(summary, dict):
        return False
    for key in ("name", "status", "type", "budget"):
        value = summary.get(key)
        if value not in (None, "", "-", []):
            return True
    return False


def _summary_needs_enrichment(summary: dict[str, Any], campaign_id: int) -> bool:
    if not isinstance(summary, dict):
        return True
    name = _pick_first_str(summary.get("name"))
    if not name or name == f"Кампания {campaign_id}":
        return True
    if _pick_first_str(summary.get("status")) in {"", "-"}:
        return True
    return False


def _merge_detail_rows(base: dict[str, Any] | None, incoming: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(base, dict):
        return dict(incoming or {})
    if not isinstance(incoming, dict):
        return dict(base)
    merged = dict(base)
    for key, value in incoming.items():
        if value in (None, "", [], {}, "-"):
            continue
        prev = merged.get(key)
        if prev in (None, "", [], {}, "-"):
            merged[key] = value
            continue
        if isinstance(prev, dict) and isinstance(value, dict):
            nested = dict(prev)
            for nkey, nval in value.items():
                if nval not in (None, "", [], {}):
                    nested[nkey] = nval
            merged[key] = nested
    return merged


def _build_campaign_stat_row(row: dict[str, Any]) -> dict[str, Any]:
    views = _sum_metric_by_aliases(row, {"views", "shows", "impressions", "showscount", "impressionscount"})
    clicks = _sum_metric_by_aliases(row, {"clicks", "click", "clickscount"})
    orders = _sum_metric_by_aliases(row, {"orders", "orderscount", "ordercount"})
    add_to_cart = _sum_metric_by_aliases(row, {"atbs", "addtocart", "add_to_cart", "basketadds"})
    spent = _sum_metric_by_aliases(row, {"sum", "spent", "cost", "expense", "expenses"})
    ctr_value = _sum_metric_by_aliases(row, {"ctr"})
    cr_value = _sum_metric_by_aliases(row, {"cr"})

    ctr = ctr_value if ctr_value > 0 else ((clicks / views * 100.0) if views > 0 else 0.0)
    cr = cr_value if cr_value > 0 else ((orders / clicks * 100.0) if clicks > 0 else 0.0)
    cpc = (spent / clicks) if clicks > 0 else 0.0
    cpo = (spent / orders) if orders > 0 else 0.0
    return {
        "views": float(round(views, 3)),
        "clicks": float(round(clicks, 3)),
        "orders": float(round(orders, 3)),
        "add_to_cart": float(round(add_to_cart, 3)),
        "spent": float(round(spent, 3)),
        "ctr": float(round(ctr, 4)),
        "cr": float(round(cr, 4)),
        "cpc": float(round(cpc, 4)),
        "cpo": float(round(cpo, 4)),
    }


def _sum_metric_by_aliases(value: Any, aliases: set[str]) -> float:
    alias_set = {x.strip().lower() for x in aliases if x and x.strip()}
    total = 0.0

    def walk(node: Any):
        nonlocal total
        if isinstance(node, dict):
            for key, nested in node.items():
                key_low = str(key).strip().lower()
                if key_low in alias_set:
                    number = _to_float(nested)
                    if number is not None:
                        total += number
                walk(nested)
            return
        if isinstance(node, list):
            for item in node:
                walk(item)

    walk(value)
    return total


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


def _fallback_reply(review_text: str, product_name: str, stars: int | None, reviewer_name: str = "") -> str:
    clean_product = product_name.replace('"', " ").replace("'", " ").replace("\\", " ").strip()
    greeting = _build_greeting(reviewer_name)
    if stars is None:
        return f"{greeting} Спасибо за отзыв о товаре {clean_product}. Мы ценим обратную связь и обязательно разберемся в вашем вопросе."
    if stars >= 5:
        return f"{greeting} Спасибо за высокую оценку товара {clean_product}. Благодарим, что выбрали нас."
    if stars == 4:
        return f"{greeting} Спасибо за отзыв о товаре {clean_product}. Благодарим за оценку и будем признательны, если подскажете, что можно улучшить."
    if stars <= 2:
        return (
            f"{greeting} Спасибо за отзыв о товаре {clean_product}. "
            "Сожалеем, что возникла такая ситуация. Пожалуйста, оформите возврат по браку через личный кабинет, "
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
        return f"{greeting} Спасибо за вопрос по товару {clean_product}. Уточните, пожалуйста, детали, и мы подскажем точнее."
    return (
        f"{greeting} Спасибо за вопрос по товару {clean_product}. "
        "Проверим по вашей ситуации и подскажем точные параметры. "
        "Если можете, уточните нужный размер/модель и условия использования."
    )


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
        return f"Здравствуйте, {safe_name}!"
    return "Здравствуйте!"


def _sanitize_person_name(value: str) -> str:
    raw = " ".join((value or "").split())
    if not raw:
        return ""
    allowed = "".join(ch for ch in raw if ch.isalpha() or ch in {" ", "-"})
    compact = " ".join(allowed.split()).strip(" -")
    if len(compact) < 2:
        return ""
    return compact[:42]


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
