from __future__ import annotations

from datetime import date, datetime, timedelta
import math
import re
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

    fid = feedback_id.strip()
    payloads: list[dict[str, Any]] = [
        {"id": fid, "text": reply},
        {"feedbackId": fid, "text": reply},
        {"feedback_id": fid, "text": reply},
        {"id": fid, "answer": reply},
        {"feedbackId": fid, "answer": reply},
    ]
    if fid.isdigit():
        fid_int = int(fid)
        payloads.extend(
            [
                {"id": fid_int, "text": reply},
                {"feedbackId": fid_int, "text": reply},
                {"feedback_id": fid_int, "text": reply},
            ]
        )
    attempts: list[tuple[str, str, dict[str, Any]]] = []
    for endpoint in (
        "https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answer",
        "https://feedbacks-api.wildberries.ru/api/v1/feedbacks/answers",
    ):
        for method in ("POST", "PATCH"):
            for payload in payloads:
                attempts.append((method, endpoint, payload))
    return _post_wb_reply_with_fallback(api_key, attempts, entity_label="отзыв")


def post_wb_question_reply(api_key: str, question_id: str, text: str) -> tuple[bool, str]:
    if not question_id.strip():
        return False, "Не указан ID вопроса"
    reply = " ".join(text.split())
    if len(reply) < 2:
        return False, "Ответ слишком короткий"
    if len(reply) > 3000:
        return False, "Ответ слишком длинный (максимум 3000 символов)"

    qid = question_id.strip()
    payloads: list[dict[str, Any]] = [
        {"id": qid, "text": reply},
        {"questionId": qid, "text": reply},
        {"question_id": qid, "text": reply},
        {"id": qid, "answer": reply},
        {"questionId": qid, "answer": reply},
    ]
    if qid.isdigit():
        qid_int = int(qid)
        payloads.extend(
            [
                {"id": qid_int, "text": reply},
                {"questionId": qid_int, "text": reply},
                {"question_id": qid_int, "text": reply},
            ]
        )
    attempts: list[tuple[str, str, dict[str, Any]]] = []
    for endpoint in (
        "https://feedbacks-api.wildberries.ru/api/v1/questions/answer",
        "https://feedbacks-api.wildberries.ru/api/v1/questions/answers",
        "https://feedbacks-api.wildberries.ru/api/v1/question/answer",
        "https://feedbacks-api.wildberries.ru/api/v1/question/answers",
    ):
        for method in ("POST", "PATCH"):
            for payload in payloads:
                attempts.append((method, endpoint, payload))
    return _post_wb_reply_with_fallback(api_key, attempts, entity_label="вопрос")


def _post_wb_reply_with_fallback(
    api_key: str,
    attempts: list[tuple[str, str, dict[str, Any]]],
    entity_label: str = "элемент",
) -> tuple[bool, str]:
    token = str(api_key or "").strip()
    if not token:
        return False, "WB API ключ не задан"
    if not attempts:
        return False, "Не задан маршрут отправки ответа в WB API"

    # Дедуп, чтобы не стучаться одинаковыми комбинациями.
    seen: set[tuple[str, str, str]] = set()
    normalized_attempts: list[tuple[str, str, dict[str, Any]]] = []
    for method, endpoint, payload in attempts:
        signature = (
            str(method or "POST").upper().strip(),
            str(endpoint or "").strip(),
            str(sorted((payload or {}).items())),
        )
        if signature in seen:
            continue
        seen.add(signature)
        normalized_attempts.append((signature[0], signature[1], payload))

    last_error = "Не удалось отправить ответ в WB API"
    saw_auth_error = False
    with httpx.Client(timeout=WB_TIMEOUT, follow_redirects=True) as client:
        for method, endpoint, payload in normalized_attempts:
            for auth_value in (token, f"Bearer {token}"):
                headers = {"Authorization": auth_value, "Content-Type": "application/json"}
                try:
                    response = client.request(method, endpoint, headers=headers, json=payload)
                except Exception:
                    continue
                if response.status_code in {200, 201, 202, 204}:
                    return True, "Ответ отправлен"
                if response.status_code in {401, 403}:
                    saw_auth_error = True
                    last_error = "WB API отклонил ключ (401/403). Проверьте тип ключа и права."
                    continue
                body = _safe_response_text(response)
                if response.status_code == 429:
                    return False, "WB API вернул 429 (лимит запросов). Повторите позже."
                # 404/405/422 часто означают несовместимый endpoint/payload,
                # поэтому пробуем другие варианты, а не падаем сразу.
                if response.status_code in {404, 405, 409, 422}:
                    if body:
                        last_error = f"WB API вернул {response.status_code}: {body}"
                    else:
                        last_error = f"WB API вернул {response.status_code}"
                    continue
                if response.status_code >= 500:
                    if body:
                        last_error = f"WB API временно недоступен ({response.status_code}): {body}"
                    else:
                        last_error = f"WB API временно недоступен ({response.status_code})"
                    continue
                if body:
                    last_error = f"WB API вернул {response.status_code}: {body}"
                else:
                    last_error = f"WB API вернул {response.status_code}"

    if saw_auth_error and "401/403" in last_error:
        return False, last_error
    return (
        False,
        f"Не удалось отправить ответ на {entity_label}: {last_error}",
    )


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
    api_key: str = "",
    model: str = "",
    provider: str = "openai",
    base_url: str = "",
) -> str:
    review = (review_text or "").strip()
    product = (product_name or "").strip() or "товар"
    rating = stars if isinstance(stars, int) else None
    custom_prompt = (prompt or "").strip()
    customer_name = _sanitize_person_name(reviewer_name)
    mp = "Ozon" if (marketplace or "").strip().lower() == "ozon" else "WB"
    kind = "question" if (content_kind or "").strip().lower() == "question" else "review"

    if kind == "question":
        fallback_base = _contextual_question_reply(
            question_text=review,
            product_name=product,
            reviewer_name=customer_name,
            prompt_text=custom_prompt,
        )
    else:
        fallback_base = _fallback_reply(review, product, rating, customer_name)
    fallback = _sanitize_customer_reply(fallback_base) or fallback_base
    token = (api_key or "").strip() or (settings.openai_api_key or "").strip()
    if not token:
        return fallback
    resolved_model = _resolve_provider_model(provider=provider, model=(model or "").strip() or settings.openai_model)

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
        "model": resolved_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.35,
        "max_tokens": 260,
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    endpoint = _resolve_ai_chat_endpoint(provider=provider, base_url=base_url)
    try:
        with httpx.Client(timeout=WB_TIMEOUT, follow_redirects=True) as client:
            response = client.post(endpoint, headers=headers, json=payload)
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
        safe_reply = _sanitize_customer_reply(reply)
        if not safe_reply:
            return fallback
        return safe_reply
    except Exception:
        return fallback


def generate_help_assistant_reply(
    question: str,
    context_text: str,
    prompt: str = "",
    *,
    api_key: str = "",
    model: str = "",
    provider: str = "openai",
    base_url: str = "",
) -> str:
    q = " ".join((question or "").split()).strip()
    if not q:
        return "Уточните вопрос, и я помогу пошагово."
    token = (api_key or "").strip() or (settings.openai_api_key or "").strip()
    fallback = _fallback_help_reply(q, context_text=context_text)
    if not token:
        return fallback
    resolved_model = _resolve_provider_model(provider=provider, model=(model or "").strip() or settings.openai_model)
    sys_prompt = (prompt or "").strip() or (
        "Ты AI-помощник сервиса SEO WIBE для продавцов маркетплейсов. "
        "Помогай по WB, Ozon и по самому сервису. "
        "Отвечай кратко, структурно, по шагам. "
        "Если информации мало, сначала задай один уточняющий вопрос. "
        "Не выдумывай факты и API-правила."
    )
    user_prompt = (
        f"Вопрос пользователя:\n{q}\n\n"
        f"Контекст справки сервиса:\n{(context_text or '').strip()[:9000] or '[контекст не передан]'}\n\n"
        "Сформируй практичный ответ на русском языке."
    )
    payload = {
        "model": resolved_model,
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.45,
        "max_tokens": 550,
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    endpoint = _resolve_ai_chat_endpoint(provider=provider, base_url=base_url)
    try:
        with httpx.Client(timeout=OZON_TIMEOUT, follow_redirects=True) as client:
            response = client.post(endpoint, headers=headers, json=payload)
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
        compact = " ".join(reply.split())
        safe_reply = _sanitize_customer_reply(compact)
        return safe_reply or fallback
    except Exception:
        return fallback


def _resolve_ai_chat_endpoint(provider: str, base_url: str) -> str:
    raw_base = str(base_url or "").strip()
    if raw_base:
        base = raw_base.rstrip("/")
        if base.endswith("/chat/completions"):
            return base
        if base.endswith("/v1"):
            return f"{base}/chat/completions"
        return f"{base}/v1/chat/completions"
    code = str(provider or "").strip().lower()
    endpoints = {
        "openai": "https://api.openai.com/v1/chat/completions",
        "openrouter": "https://openrouter.ai/api/v1/chat/completions",
        "deepseek": "https://api.deepseek.com/chat/completions",
        "groq": "https://api.groq.com/openai/v1/chat/completions",
        "together": "https://api.together.xyz/v1/chat/completions",
        "mistral": "https://api.mistral.ai/v1/chat/completions",
        "xai": "https://api.x.ai/v1/chat/completions",
    }
    return endpoints.get(code, endpoints["openai"])


def _resolve_provider_model(provider: str, model: str) -> str:
    code = str(provider or "").strip().lower()
    raw = " ".join(str(model or "").split()).strip()
    if code == "deepseek":
        if not raw:
            return "deepseek-chat"
        low = raw.lower()
        # DeepSeek does not accept OpenAI family model IDs.
        if low.startswith("gpt-") or low in {"o1", "o1-mini", "o3", "o4-mini"}:
            return "deepseek-chat"
        return raw
    return raw or (settings.openai_model or "gpt-4o-mini")


def _fallback_help_reply(question: str, context_text: str = "") -> str:
    text = str(question or "").strip().lower()
    if (
        ("сколько" in text and "лун" in text and "марс" in text)
        or ("how many" in text and "moon" in text and "mars" in text)
    ):
        return "У Марса 2 естественных спутника: Фобос и Деймос."
    context_based = _contextual_help_reply(question=question, context_text=context_text)
    if context_based:
        return context_based
    if "api" in text and ("ключ" in text or "key" in text):
        return (
            "Проверьте API-ключи в «Профиль»: для WB нужен токен, для Ozon формат client_id:api_key. "
            "После сохранения нажмите «Проверить» и обновите нужный модуль."
        )
    if "статист" in text or "sales" in text:
        return (
            "Откройте «Статистика и дашборд», выберите маркетплейс и период, затем нажмите обновление. "
            "При предупреждении 429 повторите запрос позже."
        )
    if "отзыв" in text or "вопрос" in text:
        return (
            "В модуле «Отзывы/Вопросы» сначала обновите список, затем сгенерируйте текст кнопкой AI "
            "и отправьте ответ кнопкой отправки в строке."
        )
    return (
        "Я помогу. Уточните, пожалуйста: это вопрос по WB/Ozon, по статистике, по рекламе или по работе модулей SEO WIBE?"
    )


def _contextual_help_reply(question: str, context_text: str) -> str:
    snippets = _best_context_snippets(
        context_text=context_text,
        query_text=question,
        limit=2,
        max_chars=240,
    )
    if not snippets:
        return ""
    if len(snippets) == 1:
        return f"По справке сервиса: {snippets[0]}"
    return f"По справке сервиса: 1) {snippets[0]} 2) {snippets[1]}"


def fetch_wb_campaigns(
    api_key: str,
    enrich: bool = True,
    fast_mode: bool = False,
    request_timeout: httpx.Timeout | None = None,
    max_attempts: int = 4,
) -> list[dict[str, Any]]:
    safe_attempts = max(1, int(max_attempts or 1))
    if fast_mode:
        attempts: list[tuple[str, str, dict[str, Any] | list[Any] | None]] = [
            ("GET", "https://advert-api.wb.ru/adv/v1/promotion/count", None),
            ("POST", "https://advert-api.wb.ru/adv/v1/promotion/count", {}),
            ("GET", "https://advert-api.wildberries.ru/adv/v1/promotion/count", None),
            ("POST", "https://advert-api.wildberries.ru/adv/v1/promotion/count", {}),
        ]
    else:
        attempts = [
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
        data = _request_wb_json(
            method,
            endpoint,
            api_key=api_key,
            payload=payload,
            timeout=request_timeout,
            max_attempts=safe_attempts,
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
            timeout=request_timeout,
            max_attempts=safe_attempts,
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
    fast_mode: bool = False,
    request_timeout: httpx.Timeout | None = None,
    max_attempts: int = 4,
    chunk_size: int = 40,
    max_chunks: int | None = None,
) -> dict[str, dict[str, Any]]:
    ids = [int(x) for x in campaign_ids if int(x) > 0]
    ids = sorted(set(ids))
    if not ids:
        return {}
    safe_chunk_size = max(1, int(chunk_size or 1))
    safe_attempts = max(1, int(max_attempts or 1))

    left = _parse_iso_date(date_from) or (date.today() - timedelta(days=6))
    right = _parse_iso_date(date_to) or date.today()
    if left > right:
        left, right = right, left

    endpoints = [
        "https://advert-api.wb.ru/adv/v3/fullstats",
        "https://advert-api.wildberries.ru/adv/v3/fullstats",
    ]
    payload_variants: list[dict[str, Any]]
    if fast_mode:
        payload_variants = [{"ids": [], "from": left.isoformat(), "to": right.isoformat()}]
    else:
        payload_variants = [
            {"ids": [], "from": left.isoformat(), "to": right.isoformat()},
            {"id": [], "from": left.isoformat(), "to": right.isoformat()},
            {"advertIds": [], "from": left.isoformat(), "to": right.isoformat()},
        ]

    rows: list[dict[str, Any]] = []
    for chunk_idx, chunk_start in enumerate(range(0, len(ids), safe_chunk_size)):
        if max_chunks is not None and chunk_idx >= max(0, int(max_chunks)):
            break
        chunk = ids[chunk_start:chunk_start + safe_chunk_size]
        ids_csv = ",".join(str(x) for x in chunk)
        got_chunk = False
        for endpoint in endpoints:
            params = {"ids": ids_csv, "beginDate": left.isoformat(), "endDate": right.isoformat()}
            data = _request_wb_json(
                "GET",
                endpoint,
                api_key=api_key,
                params=params,
                timeout=request_timeout,
                max_attempts=safe_attempts,
            )
            dict_rows = _as_dict_list(data) if data is not None else []
            if dict_rows:
                rows.extend(dict_rows)
                got_chunk = True
                break

            posted = False
            for payload_template in payload_variants:
                payload = dict(payload_template)
                if "ids" in payload:
                    payload["ids"] = chunk
                if "id" in payload:
                    payload["id"] = chunk
                if "advertIds" in payload:
                    payload["advertIds"] = chunk
                pdata = _request_wb_json(
                    "POST",
                    endpoint,
                    api_key=api_key,
                    payload=payload,
                    timeout=request_timeout,
                    max_attempts=safe_attempts,
                )
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
    timeout: httpx.Timeout | None = None,
    max_attempts: int = 4,
    auth_variants: list[str] | None = None,
) -> dict[str, Any] | list[dict[str, Any]] | None:
    token = api_key.strip()
    if not token:
        return None
    auth_values = auth_variants or [token, f"Bearer {token}"]
    safe_attempts = max(1, int(max_attempts or 1))
    timeout_cfg = timeout or WB_TIMEOUT
    method_up = str(method or "GET").upper()
    for auth_value in auth_values:
        headers = {"Authorization": auth_value, "Content-Type": "application/json"}
        for attempt in range(safe_attempts):
            response = None
            try:
                with httpx.Client(timeout=timeout_cfg, follow_redirects=True) as client:
                    if method_up == "POST":
                        response = client.post(url, headers=headers, params=params, json=payload)
                    elif method_up == "PATCH":
                        response = client.patch(url, headers=headers, params=params, json=payload)
                    elif method_up == "PUT":
                        response = client.put(url, headers=headers, params=params, json=payload)
                    else:
                        response = client.get(url, headers=headers, params=params)
            except Exception:
                response = None
            if response is None:
                if attempt < safe_attempts - 1:
                    time.sleep(0.35 * (attempt + 1))
                continue
            if response.status_code == 429:
                if attempt < safe_attempts - 1:
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
        "id": _pick_first_str(
            row.get("id"),
            row.get("feedbackId"),
            row.get("feedback_id"),
            row.get("reviewId"),
            row.get("review_id"),
            row.get("commentId"),
            row.get("comment_id"),
        ),
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
    by_key: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    tail: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        rid = _pick_first_str(
            row.get("id"),
            row.get("feedbackId"),
            row.get("feedback_id"),
            row.get("reviewId"),
            row.get("review_id"),
            row.get("questionId"),
            row.get("question_id"),
            row.get("commentId"),
            row.get("comment_id"),
        )
        signature = _feedback_signature_key(row)
        key = f"id:{rid}" if rid else (f"sig:{signature}" if signature else "")
        if not key:
            tail.append(row)
            continue
        prev = by_key.get(key)
        if prev is None:
            by_key[key] = row
            order.append(key)
            continue
        if _feedback_row_score(row) >= _feedback_row_score(prev):
            by_key[key] = row
    return [by_key[key] for key in order] + tail


def _feedback_signature_key(row: dict[str, Any]) -> str:
    if not isinstance(row, dict):
        return ""
    product = row.get("productDetails") if isinstance(row.get("productDetails"), dict) else {}
    created = _pick_first_str(
        row.get("createdDate"),
        row.get("createdAt"),
        row.get("published_at"),
        row.get("date"),
    )
    article = _pick_first_str(
        row.get("article"),
        row.get("nmId"),
        row.get("offerId"),
        product.get("nmId") if isinstance(product, dict) else "",
    )
    barcode = _pick_first_str(
        row.get("barcode"),
        product.get("barcode") if isinstance(product, dict) else "",
        product.get("imtId") if isinstance(product, dict) else "",
    )
    user_name = _pick_first_str(
        row.get("user"),
        row.get("userName"),
        row.get("customerName"),
        row.get("buyerName"),
        row.get("author"),
        row.get("authorName"),
    )
    stars = _pick_first_str(row.get("stars"), row.get("rating"), row.get("score"), row.get("productValuation"))
    text = _join_non_empty(
        [
            str(row.get("text") or "").strip(),
            str(row.get("question") or "").strip(),
            str(row.get("content") or "").strip(),
            str(row.get("message") or "").strip(),
            str(row.get("pros") or "").strip(),
            str(row.get("cons") or "").strip(),
        ]
    )
    answer = _extract_answer_text(
        row.get("answer"),
        row.get("answerText"),
        row.get("supplierAnswer"),
        row.get("sellerAnswer"),
        row.get("response"),
        row.get("reply"),
    )
    payload = "|".join(
        [
            created.strip().lower(),
            article.strip().lower(),
            barcode.strip().lower(),
            user_name.strip().lower(),
            stars.strip().lower(),
            text.strip().lower(),
            answer.strip().lower(),
        ]
    )
    if not payload or not payload.replace("|", "").strip():
        return ""
    return payload[:520]


def _feedback_row_score(row: dict[str, Any]) -> int:
    if not isinstance(row, dict):
        return 0
    score = 0
    if _looks_answered_feedback(row):
        score += 100
    answer = _extract_answer_text(
        row.get("answer"),
        row.get("answerText"),
        row.get("supplierAnswer"),
        row.get("sellerAnswer"),
        row.get("response"),
        row.get("reply"),
    )
    text = _join_non_empty(
        [
            str(row.get("text") or "").strip(),
            str(row.get("question") or "").strip(),
            str(row.get("content") or "").strip(),
            str(row.get("message") or "").strip(),
        ]
    )
    score += min(len(answer), 60)
    score += min(len(text), 40)
    if _pick_first_str(row.get("createdDate"), row.get("createdAt"), row.get("published_at"), row.get("date")):
        score += 10
    if _pick_first_str(row.get("user"), row.get("userName"), row.get("customerName"), row.get("author")):
        score += 5
    return score


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


def _contextual_question_reply(question_text: str, product_name: str, reviewer_name: str, prompt_text: str) -> str:
    base = _fallback_question_reply(question_text, product_name, reviewer_name)
    knowledge_text = _extract_knowledge_text(prompt_text)
    if not knowledge_text:
        return base
    snippets = _best_context_snippets(
        context_text=knowledge_text,
        query_text=f"{question_text} {product_name}",
        limit=2,
        max_chars=220,
    )
    if not snippets:
        return base
    clean_product = product_name.replace('"', " ").replace("'", " ").replace("\\", " ").strip()
    greeting = _build_greeting(reviewer_name)
    facts = " ".join(snippets).strip()
    if facts and not re.search(r"[.!?]\s*$", facts):
        facts = f"{facts}."
    reply = f"{greeting} По товару {clean_product}: {facts}"
    if len(reply) < 260:
        reply += " Если нужны точные параметры под вашу задачу, уточните условия применения."
    return reply


def _extract_knowledge_text(prompt_text: str) -> str:
    raw = str(prompt_text or "").strip()
    if not raw:
        return ""
    lowered = raw.lower()
    marker_pos = -1
    marker_len = 0
    for marker in ("база знаний:", "knowledge base:"):
        pos = lowered.find(marker)
        if pos >= 0 and (marker_pos < 0 or pos < marker_pos):
            marker_pos = pos
            marker_len = len(marker)
    body = raw[marker_pos + marker_len:] if marker_pos >= 0 else raw
    parts = re.split(r"[\n\r]+", body)
    clean_lines: list[str] = []
    instruction_bits = (
        "сформируй только текст ответа",
        "ты менеджер",
        "ты профессиональный",
        "ты проффесиональный",
        "твоя задача",
        "используй базу знаний",
        "служебные инструкции",
    )
    instruction_patterns = (
        r"\bты\s+проф+ес+иональ\w*[^.!?]*[.!?]?",
        r"\bты\s+менеджер[^.!?]*[.!?]?",
        r"\bтвоя\s+задача[^.!?]*[.!?]?",
        r"\bнеобходимо\s+будет[^.!?]*[.!?]?",
        r"\bклиент\s+задает\s+вопросы[^.!?]*[.!?]?",
        r"\bсформируй\s+только\s+текст\s+ответа[^.!?]*[.!?]?",
    )
    for line in parts:
        compact = " ".join(str(line or "").split()).strip()
        if not compact:
            continue
        sentences = re.split(r"(?<=[.!?])\s+", compact)
        kept: list[str] = []
        for sentence in sentences:
            seg = " ".join(sentence.split()).strip()
            if not seg:
                continue
            low = seg.lower()
            if any(bit in low for bit in instruction_bits):
                continue
            kept.append(seg)
        if not kept:
            cleaned = compact
            for pattern in instruction_patterns:
                cleaned = re.sub(pattern, " ", cleaned, flags=re.IGNORECASE)
            cleaned = " ".join(cleaned.split()).strip(" -:;,.")
            if cleaned:
                kept.append(cleaned)
        if kept:
            clean_lines.append(" ".join(kept))
    return "\n".join(clean_lines)[:14000]


def _best_context_snippets(context_text: str, query_text: str, limit: int = 2, max_chars: int = 220) -> list[str]:
    source = " ".join(str(context_text or "").split())
    if not source:
        return []
    query_tokens = _context_tokens(query_text)
    chunks = re.split(r"[.!?\n;]+", source)
    ranked: list[tuple[int, str]] = []
    for chunk in chunks:
        text = " ".join(chunk.split()).strip()
        if len(text) < 18:
            continue
        low = text.lower()
        overlap = sum(1 for token in query_tokens if token in low) if query_tokens else 0
        if query_tokens and overlap <= 0:
            continue
        ranked.append((overlap, text[:max_chars]))
    if not ranked:
        fallback = source[:max_chars].strip()
        return [fallback] if fallback else []
    ranked.sort(key=lambda x: (x[0], len(x[1])), reverse=True)
    out: list[str] = []
    seen: set[str] = set()
    for _, text in ranked:
        normalized = text.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        out.append(text)
        if len(out) >= max(1, int(limit or 1)):
            break
    return out


def _context_tokens(text: str) -> list[str]:
    words = re.findall(r"[a-zA-Zа-яА-Я0-9_]{3,}", str(text or "").lower())
    stop = {
        "для", "это", "что", "как", "или", "если", "при", "без", "его", "еще", "ещё",
        "with", "this", "that", "from", "into", "about", "your", "have", "will", "would",
    }
    out: list[str] = []
    seen: set[str] = set()
    for word in words:
        if word in stop or word in seen:
            continue
        seen.add(word)
        out.append(word)
        if len(out) >= 40:
            break
    return out


def _sanitize_customer_reply(text: str) -> str:
    compact = " ".join((text or "").split()).strip()
    if not compact:
        return ""
    lowered = compact.lower()
    leak_markers = (
        "база знаний:",
        "используй базу знаний",
        "служебный контекст",
        "сформируй только текст ответа клиенту",
        "ты профессиональный менеджер",
        "ты профессиональный менеджер маркетплейсов",
        "ты проффесиональный менеджер",
        "твоя задача на текущем месте работы",
        "клиент задает вопросы",
        "клиент задает вопросы на",
        "you are a marketplace manager",
        "knowledge base:",
        "system prompt",
    )
    cut_at: int | None = None
    for marker in leak_markers:
        idx = lowered.find(marker)
        if idx <= 0:
            continue
        if cut_at is None or idx < cut_at:
            cut_at = idx
    for pattern in (
        r"\bты\s+проф+ес+иональ\w*\s+менеджер",
        r"\bтвоя\s+задача\b",
        r"\bклиент\s+задает\s+вопросы\b",
    ):
        match = re.search(pattern, lowered)
        if not match:
            continue
        idx = int(match.start())
        if idx <= 0:
            continue
        if cut_at is None or idx < cut_at:
            cut_at = idx
    if cut_at is not None:
        compact = compact[:cut_at].strip(" \t\r\n-:;,.")
    if len(compact) > 3000:
        compact = compact[:3000].rsplit(" ", 1)[0].strip()
    return compact


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


def fetch_wb_returns(
    api_key: str,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 200,
) -> dict[str, Any]:
    safe_limit = max(1, min(int(limit or 1), 500))
    payloads: list[dict[str, Any]] = [
        {"limit": safe_limit},
        {"take": safe_limit, "skip": 0},
        {"is_archive": False, "limit": safe_limit},
    ]
    if status:
        for pl in payloads:
            pl["status"] = status
    rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    for endpoint in (
        "https://marketplace-api.wildberries.ru/api/v1/claims",
        "https://supplies-api.wildberries.ru/api/v1/claims",
    ):
        for payload in payloads:
            data = _request_wb_json("POST", endpoint, api_key=api_key, payload=payload, auth_variants=[api_key.strip(), f"Bearer {api_key.strip()}"])
            if data is None:
                continue
            parsed = _extract_first_dict_list(data, preferred_keys=("claims", "items", "data", "result", "list"))
            if parsed:
                rows = parsed
                break
            if isinstance(data, dict):
                single_id = _pick_first_str(data.get("id"), data.get("claim_id"), data.get("claimId"))
                if single_id:
                    rows = [data]
                    break
        if rows:
            break
    normalized = [_normalize_wb_return_row(x) for x in rows if isinstance(x, dict)]
    normalized = _filter_rows_by_period(normalized, date_from=date_from, date_to=date_to)
    return {"rows": normalized, "warnings": warnings}


def fetch_wb_return_details(api_key: str, claim_id: str) -> dict[str, Any] | None:
    rid = str(claim_id or "").strip()
    if not rid:
        return None
    endpoints = (
        "https://marketplace-api.wildberries.ru/api/v1/claim",
        "https://supplies-api.wildberries.ru/api/v1/claim",
        "https://marketplace-api.wildberries.ru/api/v1/claims",
    )
    for endpoint in endpoints:
        for method, params, payload in (
            ("GET", {"id": rid}, None),
            ("GET", {"claimId": rid}, None),
            ("POST", None, {"id": rid}),
            ("POST", None, {"claim_id": rid}),
            ("POST", None, {"claimId": rid}),
        ):
            data = _request_wb_json(method, endpoint, api_key=api_key, params=params, payload=payload, auth_variants=[api_key.strip(), f"Bearer {api_key.strip()}"])
            if data is None:
                continue
            if isinstance(data, dict):
                candidate = data.get("claim") if isinstance(data.get("claim"), dict) else data
                cid = _pick_first_str(candidate.get("id"), candidate.get("claim_id"), candidate.get("claimId"))
                if cid and cid == rid:
                    return _normalize_wb_return_row(candidate)
                rows = _extract_first_dict_list(data, preferred_keys=("claims", "items", "data", "result", "list"))
                for row in rows:
                    if _pick_first_str(row.get("id"), row.get("claim_id"), row.get("claimId")) == rid:
                        return _normalize_wb_return_row(row)
            if isinstance(data, list):
                for row in data:
                    if isinstance(row, dict) and _pick_first_str(row.get("id"), row.get("claim_id"), row.get("claimId")) == rid:
                        return _normalize_wb_return_row(row)
    return None


def action_wb_return(api_key: str, claim_id: str, action: str, comment: str = "") -> tuple[bool, str, dict[str, Any] | None]:
    rid = str(claim_id or "").strip()
    if not rid:
        return False, "Не указан ID заявки на возврат", None
    op = str(action or "").strip().lower()
    if op not in {"approve", "accept", "reject", "decline", "comment"}:
        return False, "Недопустимое действие возврата", None

    mapped = "approve" if op in {"approve", "accept"} else ("reject" if op in {"reject", "decline"} else "comment")
    payloads: list[dict[str, Any]] = [
        {"id": rid, "action": mapped, "comment": comment or ""},
        {"claim_id": rid, "status": mapped, "comment": comment or ""},
        {"claimId": rid, "status": mapped, "comment": comment or ""},
    ]
    endpoints = (
        "https://marketplace-api.wildberries.ru/api/v1/claim/action",
        "https://marketplace-api.wildberries.ru/api/v1/claims/action",
        "https://supplies-api.wildberries.ru/api/v1/claim/action",
    )
    last_error = "WB API возвратов недоступен"
    for endpoint in endpoints:
        for payload in payloads:
            response = _request_wb_json("PATCH", endpoint, api_key=api_key, payload=payload, auth_variants=[api_key.strip(), f"Bearer {api_key.strip()}"])
            if response is not None:
                return True, "Действие по возврату отправлено", response if isinstance(response, dict) else {"raw": response}
    return False, last_error, None


def fetch_ozon_ads_campaigns(api_key: str, limit: int = 200) -> dict[str, Any]:
    safe_limit = max(1, min(int(limit or 1), 500))
    warnings: list[str] = []
    rows: list[dict[str, Any]] = []
    payloads: list[dict[str, Any]] = [
        {"limit": safe_limit, "offset": 0},
        {"page": 1, "page_size": min(safe_limit, 100)},
    ]
    endpoints = (
        "https://performance.ozon.ru:443/api/client/campaign",
        "https://api-seller.ozon.ru/v1/advertising/campaign/list",
        "https://api-seller.ozon.ru/v2/advertising/campaign/list",
    )
    for endpoint in endpoints:
        for payload in payloads:
            data = _request_ozon_json("POST", endpoint, api_key=api_key, payload=payload)
            if data is None:
                continue
            parsed = _extract_first_dict_list(data, preferred_keys=("campaigns", "items", "list", "data", "result"))
            if parsed:
                rows = parsed
                break
        if rows:
            break
    if not rows:
        warnings.append("Ozon Ads API не вернул список кампаний (возможны ограничения ключа).")
    normalized = [_normalize_ozon_ads_campaign_row(x) for x in rows if isinstance(x, dict)]
    return {"rows": normalized, "warnings": warnings}


def fetch_ozon_ads_analytics(
    api_key: str,
    date_from: str | None = None,
    date_to: str | None = None,
    campaign_id: int | None = None,
) -> dict[str, Any]:
    left = _parse_iso_date(date_from) or (date.today() - timedelta(days=6))
    right = _parse_iso_date(date_to) or date.today()
    if left > right:
        left, right = right, left
    payloads: list[dict[str, Any]] = [
        {"date_from": left.isoformat(), "date_to": right.isoformat(), "campaign_id": campaign_id},
        {"from": left.isoformat(), "to": right.isoformat(), "campaign_id": campaign_id},
    ]
    warnings: list[str] = []
    rows: list[dict[str, Any]] = []
    for endpoint in (
        "https://performance.ozon.ru:443/api/client/statistics/campaign",
        "https://api-seller.ozon.ru/v1/advertising/statistics",
    ):
        for payload in payloads:
            data = _request_ozon_json("POST", endpoint, api_key=api_key, payload=payload)
            if data is None:
                continue
            parsed = _extract_first_dict_list(data, preferred_keys=("rows", "campaigns", "items", "data", "result", "list"))
            if parsed:
                rows = parsed
                break
        if rows:
            break
    if not rows:
        warnings.append("Ozon Ads аналитика недоступна по текущему ключу.")
    out_rows = [_normalize_ozon_ads_analytics_row(x) for x in rows if isinstance(x, dict)]
    if campaign_id and int(campaign_id or 0) > 0:
        out_rows = [x for x in out_rows if int(x.get("campaign_id") or 0) == int(campaign_id)]
    totals = {
        "views": float(round(sum(float(x.get("views") or 0.0) for x in out_rows), 3)),
        "clicks": float(round(sum(float(x.get("clicks") or 0.0) for x in out_rows), 3)),
        "orders": float(round(sum(float(x.get("orders") or 0.0) for x in out_rows), 3)),
        "spent": float(round(sum(float(x.get("spent") or 0.0) for x in out_rows), 3)),
        "ctr_avg": float(round((sum(float(x.get("ctr") or 0.0) for x in out_rows) / len(out_rows)) if out_rows else 0.0, 4)),
        "cr_avg": float(round((sum(float(x.get("cr") or 0.0) for x in out_rows) / len(out_rows)) if out_rows else 0.0, 4)),
    }
    return {
        "date_from": left.isoformat(),
        "date_to": right.isoformat(),
        "rows": out_rows,
        "totals": totals,
        "warnings": warnings,
    }


def fetch_ozon_returns(
    api_key: str,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 200,
) -> dict[str, Any]:
    safe_limit = max(1, min(int(limit or 1), 500))
    warnings: list[str] = []
    rows: list[dict[str, Any]] = []
    payloads: list[dict[str, Any]] = [
        {
            "filter": {
                "status": status or "",
                "date_from": date_from or "",
                "date_to": date_to or "",
            },
            "limit": safe_limit,
            "offset": 0,
        },
        {"limit": safe_limit, "offset": 0},
    ]
    for endpoint in (
        "https://api-seller.ozon.ru/v1/returns/company/fbs",
        "https://api-seller.ozon.ru/v1/returns/list",
    ):
        for payload in payloads:
            data = _request_ozon_json("POST", endpoint, api_key=api_key, payload=payload)
            if data is None:
                continue
            parsed = _extract_first_dict_list(data, preferred_keys=("returns", "items", "list", "data", "result"))
            if parsed:
                rows = parsed
                break
        if rows:
            break
    if not rows:
        warnings.append("Ozon returns API не вернул данные (staged режим).")
    normalized = [_normalize_ozon_return_row(x) for x in rows if isinstance(x, dict)]
    normalized = _filter_rows_by_period(normalized, date_from=date_from, date_to=date_to)
    return {"rows": normalized, "warnings": warnings}


def fetch_ozon_return_details(api_key: str, return_id: str) -> dict[str, Any] | None:
    rid = str(return_id or "").strip()
    if not rid:
        return None
    payloads = [
        {"return_id": rid},
        {"id": rid},
    ]
    for endpoint in (
        "https://api-seller.ozon.ru/v1/returns/company/fbs/info",
        "https://api-seller.ozon.ru/v1/returns/info",
    ):
        for payload in payloads:
            data = _request_ozon_json("POST", endpoint, api_key=api_key, payload=payload)
            if data is None:
                continue
            if isinstance(data, dict):
                candidate = data.get("result") if isinstance(data.get("result"), dict) else data
                cid = _pick_first_str(candidate.get("id"), candidate.get("return_id"), candidate.get("returnId"))
                if cid and cid == rid:
                    return _normalize_ozon_return_row(candidate)
            rows = _extract_first_dict_list(data, preferred_keys=("returns", "items", "list", "data", "result"))
            for row in rows:
                if _pick_first_str(row.get("id"), row.get("return_id"), row.get("returnId")) == rid:
                    return _normalize_ozon_return_row(row)
    return None


def _normalize_wb_return_row(row: dict[str, Any]) -> dict[str, Any]:
    claim_id = _pick_first_str(row.get("id"), row.get("claim_id"), row.get("claimId"), row.get("return_id"))
    status = _pick_first_str(row.get("status"), row.get("state"), row.get("claim_status"), row.get("claimState")) or "-"
    created = _pick_first_str(row.get("created_at"), row.get("createdAt"), row.get("date"), row.get("dt"))
    product = _pick_first_str(row.get("product_name"), row.get("name"), row.get("subject"), row.get("title"), "WB возврат")
    article = _pick_first_str(row.get("article"), row.get("offer_id"), row.get("nm_id"), row.get("nmId"))
    reason = _pick_first_str(row.get("reason"), row.get("description"), row.get("comment"), row.get("text"))
    photos = _extract_photo_urls(row.get("photos"), row.get("images"), row.get("photo"), row.get("photo_urls"), row.get("media"))
    return {
        "id": claim_id,
        "date": created[:10] if created else "",
        "created_at": created,
        "marketplace": "wb",
        "status": status,
        "product": product,
        "article": article,
        "reason": reason,
        "description": reason,
        "photos": photos,
        "raw": row,
    }


def _normalize_ozon_return_row(row: dict[str, Any]) -> dict[str, Any]:
    rid = _pick_first_str(row.get("id"), row.get("return_id"), row.get("returnId"))
    status = _pick_first_str(row.get("status"), row.get("state"), row.get("return_status")) or "-"
    created = _pick_first_str(row.get("created_at"), row.get("createdAt"), row.get("date"), row.get("posting_date"))
    product = _pick_first_str(row.get("product_name"), row.get("name"), row.get("title"), "Ozon возврат")
    article = _pick_first_str(row.get("offer_id"), row.get("article"), row.get("sku"), row.get("product_id"))
    reason = _pick_first_str(row.get("reason"), row.get("description"), row.get("comment"), row.get("text"))
    photos = _extract_photo_urls(row.get("photos"), row.get("images"), row.get("photo"), row.get("photo_urls"), row.get("media"))
    return {
        "id": rid,
        "date": created[:10] if created else "",
        "created_at": created,
        "marketplace": "ozon",
        "status": status,
        "product": product,
        "article": article,
        "reason": reason,
        "description": reason,
        "photos": photos,
        "raw": row,
    }


def _normalize_ozon_ads_campaign_row(row: dict[str, Any]) -> dict[str, Any]:
    cid = _to_int(_pick_first_str(row.get("id"), row.get("campaign_id"), row.get("campaignId"), row.get("advertId"))) or 0
    name = _pick_first_str(row.get("name"), row.get("title"), row.get("campaign_name"), f"Ozon {cid}" if cid else "Ozon campaign")
    status = _pick_first_str(row.get("status"), row.get("state"), row.get("campaign_status")) or "-"
    ctype = _pick_first_str(row.get("type"), row.get("campaign_type"), row.get("adType")) or "-"
    budget = _pick_first_str(row.get("budget"), row.get("daily_budget"), row.get("sum")) or "-"
    return {
        "campaign_id": cid,
        "name": name,
        "status": status,
        "type": ctype,
        "budget": budget,
    }


def _normalize_ozon_ads_analytics_row(row: dict[str, Any]) -> dict[str, Any]:
    cid = _to_int(_pick_first_str(row.get("campaign_id"), row.get("campaignId"), row.get("id"), row.get("advertId"))) or 0
    views = float(_to_float(row.get("views")) or _to_float(row.get("impressions")) or 0.0)
    clicks = float(_to_float(row.get("clicks")) or 0.0)
    orders = float(_to_float(row.get("orders")) or _to_float(row.get("orders_count")) or 0.0)
    spent = float(_to_float(row.get("spent")) or _to_float(row.get("cost")) or _to_float(row.get("sum")) or 0.0)
    ctr = float(_to_float(row.get("ctr")) or ((clicks / views * 100.0) if views > 0 else 0.0))
    cr = float(_to_float(row.get("cr")) or ((orders / clicks * 100.0) if clicks > 0 else 0.0))
    cpc = float(_to_float(row.get("cpc")) or ((spent / clicks) if clicks > 0 else 0.0))
    cpo = float(_to_float(row.get("cpo")) or ((spent / orders) if orders > 0 else 0.0))
    return {
        "campaign_id": cid,
        "name": _pick_first_str(row.get("name"), row.get("title"), row.get("campaign_name"), f"Ozon {cid}" if cid else "Ozon campaign"),
        "status": _pick_first_str(row.get("status"), row.get("state"), row.get("campaign_status")) or "-",
        "type": _pick_first_str(row.get("type"), row.get("campaign_type"), row.get("adType")) or "-",
        "budget": _pick_first_str(row.get("budget"), row.get("daily_budget"), row.get("sum")) or "-",
        "views": float(round(views, 3)),
        "clicks": float(round(clicks, 3)),
        "orders": float(round(orders, 3)),
        "spent": float(round(spent, 3)),
        "ctr": float(round(ctr, 4)),
        "cr": float(round(cr, 4)),
        "cpc": float(round(cpc, 4)),
        "cpo": float(round(cpo, 4)),
    }
