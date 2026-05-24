from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

from app.models import (
    AuditLog,
    FeedbackAutoReplyLog,
    FeedbackLearningProfile,
    MarketplaceApiCache,
    UserAiSettings,
    UserQuestionAiSettings,
)
from app.services.task_queue import enqueue_task, queue_available

try:
    from app.services.wb_modules import _repair_mojibake_text
except Exception:  # pragma: no cover
    def _repair_mojibake_text(value: Any) -> str:
        return str(value or "")


LEARNING_INTERVAL = timedelta(days=7)
MAX_SOURCE_ROWS = 700
MAX_STORED_EXAMPLES = 120
MAX_PROFILE_PROMPT_CHARS = 6500
MAX_RUNTIME_CONTEXT_CHARS = 4200


def normalize_content_kind(content_kind: str) -> str:
    raw = str(content_kind or "").strip().lower()
    return "question" if raw.startswith("q") or "вопрос" in raw else "review"


def module_code_for_kind(content_kind: str) -> str:
    return "wb_questions_ai" if normalize_content_kind(content_kind) == "question" else "wb_reviews_ai"


def load_feedback_learning_profile(
    db: Session,
    user_id: int,
    content_kind: str,
) -> FeedbackLearningProfile | None:
    return db.scalar(
        select(FeedbackLearningProfile).where(
            FeedbackLearningProfile.user_id == int(user_id),
            FeedbackLearningProfile.content_kind == normalize_content_kind(content_kind),
        )
    )


def learning_profile_meta(profile: FeedbackLearningProfile | None) -> dict[str, Any]:
    if not profile:
        return {
            "enabled": True,
            "status": "missing",
            "source_count": 0,
            "generated_at": None,
            "next_run_at": None,
            "last_source_at": None,
        }
    return {
        "enabled": bool(profile.enabled),
        "status": str(profile.status or "empty"),
        "source_count": int(profile.source_count or 0),
        "generated_at": _iso(profile.generated_at),
        "next_run_at": _iso(profile.next_run_at),
        "last_source_at": _iso(profile.last_source_at),
        "last_error": str(profile.last_error or ""),
    }


def ensure_feedback_learning_profile(
    db: Session,
    user_id: int,
    content_kind: str,
    *,
    force: bool = False,
    allow_inline: bool = False,
) -> FeedbackLearningProfile | None:
    kind = normalize_content_kind(content_kind)
    profile = load_feedback_learning_profile(db, user_id, kind)
    now = datetime.utcnow()
    due = (
        force
        or profile is None
        or profile.generated_at is None
        or profile.next_run_at is None
        or profile.next_run_at <= now
    )
    if not due:
        return profile
    if allow_inline or profile is None or profile.generated_at is None or not queue_available():
        return build_feedback_learning_profile(db, user_id, kind, force=True)
    enqueue_feedback_learning_refresh(user_id, kind, force=force)
    return profile


def enqueue_feedback_learning_refresh(
    user_id: int,
    content_kind: str,
    *,
    force: bool = False,
    dedupe_ttl_sec: int = 6 * 60 * 60,
) -> dict[str, Any]:
    kind = normalize_content_kind(content_kind)
    return enqueue_task(
        "refresh_feedback_learning",
        {"user_id": int(user_id), "content_kind": kind, "force": bool(force)},
        dedupe_key=f"{int(user_id)}:{kind}",
        dedupe_ttl_sec=30 if force else dedupe_ttl_sec,
    )


def enqueue_due_feedback_learning_jobs(db: Session, *, limit: int = 20) -> int:
    if not queue_available():
        return 0
    now = datetime.utcnow()
    queued = 0
    profiles = db.scalars(
        select(FeedbackLearningProfile)
        .where(
            FeedbackLearningProfile.enabled == True,  # noqa: E712
            or_(FeedbackLearningProfile.next_run_at == None, FeedbackLearningProfile.next_run_at <= now),  # noqa: E711
        )
        .order_by(FeedbackLearningProfile.next_run_at.asc(), FeedbackLearningProfile.updated_at.asc())
        .limit(max(1, int(limit or 1)))
    ).all()
    for profile in profiles:
        result = enqueue_feedback_learning_refresh(profile.user_id, profile.content_kind)
        if result.get("queued"):
            queued += 1
    if queued >= limit:
        return queued

    user_ids: set[int] = set()
    for row in db.scalars(select(UserAiSettings.user_id).limit(limit * 4)).all():
        user_ids.add(int(row))
    for row in db.scalars(select(UserQuestionAiSettings.user_id).limit(limit * 4)).all():
        user_ids.add(int(row))
    for row in db.scalars(
        select(FeedbackAutoReplyLog.user_id)
        .where(FeedbackAutoReplyLog.reply_text != "")
        .order_by(desc(FeedbackAutoReplyLog.updated_at))
        .limit(limit * 4)
    ).all():
        user_ids.add(int(row))
    for row in db.scalars(
        select(MarketplaceApiCache.user_id)
        .where(MarketplaceApiCache.module_code.in_(["wb_reviews_ai", "wb_questions_ai"]))
        .order_by(desc(MarketplaceApiCache.updated_at))
        .limit(limit * 4)
    ).all():
        user_ids.add(int(row))

    for user_id in sorted(user_ids):
        for kind in ("review", "question"):
            if queued >= limit:
                return queued
            profile = load_feedback_learning_profile(db, user_id, kind)
            if profile and profile.generated_at and profile.next_run_at and profile.next_run_at > now:
                continue
            result = enqueue_feedback_learning_refresh(user_id, kind)
            if result.get("queued"):
                queued += 1
    return queued


def build_feedback_learning_profile(
    db: Session,
    user_id: int,
    content_kind: str,
    *,
    force: bool = False,
) -> FeedbackLearningProfile:
    kind = normalize_content_kind(content_kind)
    profile = load_feedback_learning_profile(db, user_id, kind)
    now = datetime.utcnow()
    if profile and not force and profile.next_run_at and profile.next_run_at > now:
        return profile
    if not profile:
        profile = FeedbackLearningProfile(
            user_id=int(user_id),
            content_kind=kind,
            enabled=True,
            created_at=now,
        )
        db.add(profile)
        db.flush()

    try:
        examples = gather_feedback_learning_examples(db, int(user_id), kind)
        source_hash = _examples_hash(examples)
        if profile.source_hash == source_hash and profile.prompt_text and not force:
            profile.status = "ready" if int(profile.source_count or 0) > 0 else "empty"
            profile.next_run_at = now + LEARNING_INTERVAL
            profile.updated_at = now
            db.add(profile)
            return profile

        stats = _summarize_examples(examples, kind)
        prompt = _build_profile_prompt(examples, stats, kind, now)
        stored_examples = _stored_examples(examples)
        profile.prompt_text = prompt[:MAX_PROFILE_PROMPT_CHARS]
        profile.examples_json = json.dumps(stored_examples, ensure_ascii=False)
        profile.stats_json = json.dumps(stats, ensure_ascii=False, default=str)
        profile.source_hash = source_hash
        profile.source_count = len(examples)
        profile.last_source_at = _latest_source_at(examples)
        profile.generated_at = now
        profile.next_run_at = now + LEARNING_INTERVAL
        profile.status = "ready" if examples else "empty"
        profile.last_error = ""
        profile.updated_at = now
        db.add(profile)
        return profile
    except Exception as exc:
        profile.status = "error"
        profile.last_error = str(exc or "feedback learning failed")[:1000]
        profile.next_run_at = now + timedelta(hours=6)
        profile.updated_at = now
        db.add(profile)
        return profile


def gather_feedback_learning_examples(db: Session, user_id: int, content_kind: str) -> list[dict[str, Any]]:
    kind = normalize_content_kind(content_kind)
    cache_examples = _examples_from_market_cache(db, user_id, kind)
    cache_index = {
        (str(item.get("marketplace") or ""), str(item.get("item_id") or "")): item
        for item in cache_examples
        if str(item.get("marketplace") or "") and str(item.get("item_id") or "")
    }
    examples: list[dict[str, Any]] = list(cache_examples)
    examples.extend(_examples_from_auto_reply_logs(db, user_id, kind, cache_index))
    examples.extend(_examples_from_audit_logs(db, user_id, kind, cache_index))
    examples = _dedupe_examples(examples)
    examples.sort(key=lambda item: _parse_dt(item.get("source_at")) or datetime.min, reverse=True)
    return examples[:MAX_SOURCE_ROWS]


def compose_feedback_learning_prompt(
    db: Session,
    user_id: int,
    content_kind: str,
    *,
    query_text: str = "",
    rating: int | None = None,
    max_chars: int = MAX_RUNTIME_CONTEXT_CHARS,
) -> str:
    kind = normalize_content_kind(content_kind)
    profile = load_feedback_learning_profile(db, user_id, kind)
    if not profile or not profile.enabled or not str(profile.prompt_text or "").strip():
        return ""
    parts = [str(profile.prompt_text or "").strip()]
    examples = _load_examples(profile.examples_json)
    picked = _pick_relevant_examples(examples, query_text=query_text, rating=rating, limit=3)
    if picked:
        label = "вопросов" if kind == "question" else "отзывов"
        parts.append(f"Релевантные реальные примеры {label} и наших ответов. Не копируй дословно, используй как стиль и логику:")
        for idx, item in enumerate(picked, 1):
            market = str(item.get("marketplace") or "").upper()
            stars = int(item.get("rating") or 0)
            stars_label = f", {stars}★" if kind == "review" and stars > 0 else ""
            source = _clip(_clean_text(item.get("text")), 360)
            answer = _clip(_clean_text(item.get("answer")), 420)
            if not answer:
                continue
            if source:
                parts.append(f"{idx}. [{market}{stars_label}] Клиент: {source}\nНаш ответ: {answer}")
            else:
                parts.append(f"{idx}. [{market}{stars_label}] Наш ответ: {answer}")
    safety = _runtime_safety_prompt(kind, query_text=query_text)
    limit = max(1000, int(max_chars or 0))
    reserve = min(max(700, len(safety) + 24), max(700, limit // 2))
    body = _clip("\n\n".join(part for part in parts if part), max(400, limit - reserve))
    return "\n\n".join(part for part in (body, safety) if part)


def feedback_learning_settings_payload(
    db: Session,
    user_id: int,
    content_kind: str,
    *,
    manual_prompt: str,
) -> dict[str, Any]:
    kind = normalize_content_kind(content_kind)
    profile = load_feedback_learning_profile(db, user_id, kind)
    learned = str(profile.prompt_text or "").strip() if profile and profile.enabled else ""
    effective = _join_prompt_layers(str(manual_prompt or ""), learned)
    return {
        "learned_prompt": learned,
        "effective_prompt": effective,
        "learning_meta": learning_profile_meta(profile),
    }


def append_learning_to_prompt(manual_prompt: str, learned_prompt: str) -> str:
    return _join_prompt_layers(manual_prompt, learned_prompt)


def _join_prompt_layers(manual_prompt: str, learned_prompt: str) -> str:
    manual = str(manual_prompt or "").strip()
    learned = str(learned_prompt or "").strip()
    if manual and learned:
        return f"{manual}\n\n{learned}"
    return manual or learned


def _examples_from_market_cache(db: Session, user_id: int, kind: str) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(MarketplaceApiCache)
        .where(
            MarketplaceApiCache.user_id == int(user_id),
            MarketplaceApiCache.module_code == module_code_for_kind(kind),
        )
        .order_by(desc(MarketplaceApiCache.updated_at), desc(MarketplaceApiCache.id))
        .limit(120)
    ).all()
    examples: list[dict[str, Any]] = []
    for cache in rows:
        payload = _loads(cache.payload_json, {})
        if not isinstance(payload, dict):
            continue
        rows_data: list[Any] = []
        for bucket in ("answered", "new", "items", "rows", "data", "result"):
            value = payload.get(bucket)
            if isinstance(value, list):
                rows_data.extend(value)
        if not rows_data and isinstance(payload.get("review"), dict):
            rows_data.append(payload.get("review"))
        if not rows_data and isinstance(payload.get("question"), dict):
            rows_data.append(payload.get("question"))
        for row in rows_data:
            if not isinstance(row, dict):
                continue
            answer = _extract_answer(row)
            if not answer:
                continue
            example = _example_from_feedback_row(
                row,
                marketplace=str(cache.marketplace or "").strip().lower(),
                kind=kind,
                source="market_cache",
                source_at=cache.updated_at or cache.fetched_at or cache.created_at,
            )
            if _example_has_signal(example):
                examples.append(example)
    return examples


def _examples_from_auto_reply_logs(
    db: Session,
    user_id: int,
    kind: str,
    cache_index: dict[tuple[str, str], dict[str, Any]],
) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(FeedbackAutoReplyLog)
        .where(
            FeedbackAutoReplyLog.user_id == int(user_id),
            FeedbackAutoReplyLog.item_type == kind,
            FeedbackAutoReplyLog.reply_text != "",
        )
        .order_by(desc(FeedbackAutoReplyLog.sent_at), desc(FeedbackAutoReplyLog.updated_at), desc(FeedbackAutoReplyLog.id))
        .limit(MAX_SOURCE_ROWS)
    ).all()
    examples: list[dict[str, Any]] = []
    for log in rows:
        payload = _loads(log.payload_json, {})
        cached = cache_index.get((str(log.marketplace or ""), str(log.item_external_id or "")), {})
        text = _clean_text(payload.get("text") or payload.get("review_text") or cached.get("text"))
        product = _clean_text(payload.get("product") or payload.get("product_name") or cached.get("product"))
        answer = _clean_text(log.reply_text)
        source_at = log.sent_at or log.updated_at or log.created_at
        example = {
            "source": "auto_reply_log",
            "marketplace": str(log.marketplace or "").strip().lower(),
            "item_type": kind,
            "item_id": str(log.item_external_id or ""),
            "rating": int(log.rating or payload.get("rating") or cached.get("rating") or 0),
            "product": product,
            "text": text,
            "answer": answer,
            "user": _clean_text(payload.get("reviewer_name") or payload.get("user") or cached.get("user")),
            "date": str(payload.get("date") or cached.get("date") or "")[:32],
            "source_at": _iso(source_at),
        }
        if _example_has_signal(example):
            examples.append(example)
    return examples


def _examples_from_audit_logs(
    db: Session,
    user_id: int,
    kind: str,
    cache_index: dict[tuple[str, str], dict[str, Any]],
) -> list[dict[str, Any]]:
    actions = [f"wb_{kind}_reply", f"ozon_{kind}_reply"]
    rows = db.scalars(
        select(AuditLog)
        .where(
            AuditLog.user_id == int(user_id),
            AuditLog.action.in_(actions),
            AuditLog.status == "ok",
        )
        .order_by(desc(AuditLog.created_at), desc(AuditLog.id))
        .limit(MAX_SOURCE_ROWS)
    ).all()
    examples: list[dict[str, Any]] = []
    for row in rows:
        details = _loads(row.details, {})
        if not isinstance(details, dict):
            continue
        marketplace = _clean_text(details.get("marketplace")).lower() or ("ozon" if str(row.action or "").startswith("ozon") else "wb")
        item_id = _clean_text(
            details.get("review_id")
            or details.get("question_id")
            or details.get("item_external_id")
            or row.entity_id
        )
        cached = cache_index.get((marketplace, item_id), {})
        answer = _clean_text(details.get("reply") or details.get("answer") or cached.get("answer"))
        example = {
            "source": "audit_log",
            "marketplace": marketplace,
            "item_type": kind,
            "item_id": item_id,
            "rating": int(cached.get("rating") or 0),
            "product": _clean_text(cached.get("product")),
            "text": _clean_text(cached.get("text")),
            "answer": answer,
            "user": _clean_text(cached.get("user")),
            "date": str(cached.get("date") or "")[:32],
            "source_at": _iso(row.created_at),
        }
        if _example_has_signal(example):
            examples.append(example)
    return examples


def _example_from_feedback_row(
    row: dict[str, Any],
    *,
    marketplace: str,
    kind: str,
    source: str,
    source_at: datetime | None,
) -> dict[str, Any]:
    return {
        "source": source,
        "marketplace": marketplace,
        "item_type": kind,
        "item_id": _clean_text(row.get("id") or row.get("review_id") or row.get("question_id")),
        "rating": _safe_int(row.get("stars") or row.get("rating") or row.get("productValuation")),
        "product": _clean_text(row.get("product") or row.get("product_name") or row.get("productName")),
        "text": _extract_source_text(row, kind),
        "answer": _extract_answer(row),
        "user": _clean_text(row.get("user") or row.get("user_name") or row.get("author")),
        "date": _clean_text(row.get("date") or row.get("created_at") or row.get("createdAt"))[:32],
        "source_at": _iso(source_at),
    }


def _extract_source_text(row: dict[str, Any], kind: str) -> str:
    if kind == "question":
        return _clean_text(
            row.get("text")
            or row.get("question")
            or row.get("question_text")
            or row.get("content")
            or row.get("message")
        )
    return _clean_text(
        row.get("text")
        or row.get("review_text")
        or row.get("comment")
        or row.get("content")
        or " ".join(str(row.get(key) or "") for key in ("pros", "cons"))
    )


def _extract_answer(row: dict[str, Any]) -> str:
    for key in ("answer", "reply", "reply_text", "answerText", "sellerAnswer", "supplierAnswer", "response", "comment"):
        text = _extract_answer_value(row.get(key))
        if text:
            return text
    return ""


def _extract_answer_value(value: Any) -> str:
    if isinstance(value, str):
        return _clean_text(value)
    if isinstance(value, dict):
        for key in ("text", "answer", "reply", "comment", "message", "content", "body"):
            text = _extract_answer_value(value.get(key))
            if text:
                return text
        for nested in value.values():
            if isinstance(nested, (dict, list)):
                text = _extract_answer_value(nested)
                if text:
                    return text
    if isinstance(value, list):
        for item in value:
            text = _extract_answer_value(item)
            if text:
                return text
    return ""


def _dedupe_examples(examples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in examples:
        answer = _clean_text(item.get("answer"))
        if len(answer) < 4:
            continue
        item["answer"] = answer
        item["text"] = _clean_text(item.get("text"))
        item["product"] = _clean_text(item.get("product"))
        marketplace = str(item.get("marketplace") or "").strip().lower()
        item_id = str(item.get("item_id") or "").strip()
        key_raw = f"{marketplace}:{item.get('item_type')}:{item_id}:{answer[:220]}"
        if not item_id:
            key_raw = f"{marketplace}:{item.get('item_type')}:{item.get('text')}:{answer[:220]}"
        key = hashlib.sha1(key_raw.encode("utf-8", errors="ignore")).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def _example_has_signal(example: dict[str, Any]) -> bool:
    answer = _clean_text(example.get("answer"))
    if len(answer) < 4:
        return False
    text = _clean_text(example.get("text"))
    product = _clean_text(example.get("product"))
    return bool(text or product or answer)


def _summarize_examples(examples: list[dict[str, Any]], kind: str) -> dict[str, Any]:
    answers = [_clean_text(item.get("answer")) for item in examples if _clean_text(item.get("answer"))]
    answer_words = [len(answer.split()) for answer in answers]
    marketplace_counts = Counter(str(item.get("marketplace") or "unknown").lower() for item in examples)
    rating_counts = Counter(str(int(item.get("rating") or 0)) for item in examples if int(item.get("rating") or 0) > 0)
    stats = {
        "content_kind": kind,
        "examples": len(examples),
        "marketplaces": dict(marketplace_counts),
        "ratings": dict(rating_counts),
        "avg_answer_words": int(sum(answer_words) / len(answer_words)) if answer_words else 0,
        "greeting_ratio": _ratio(answers, _starts_with_greeting),
        "thanks_ratio": _ratio(answers, lambda text: _contains_any(text, ["спасибо", "благодар"])),
        "apology_ratio": _ratio(answers, lambda text: _contains_any(text, ["жаль", "извин", "сожал"])),
        "clarify_ratio": _ratio(answers, lambda text: _contains_any(text, ["уточн", "напишите", "свяжитесь", "обратитесь"])),
        "first_person_plural_ratio": _ratio(answers, lambda text: _contains_any(text, [" мы ", " нам ", " нашей", " нашу", " нашей"])),
    }
    return stats


def _build_profile_prompt(
    examples: list[dict[str, Any]],
    stats: dict[str, Any],
    kind: str,
    generated_at: datetime,
) -> str:
    if not examples:
        return ""
    label = "вопросы" if kind == "question" else "отзывы"
    avg_words = int(stats.get("avg_answer_words") or 0)
    avg_hint = f"Ориентир длины: примерно {max(12, avg_words - 8)}-{max(28, avg_words + 12)} слов." if avg_words else "Ориентир длины: коротко, по делу, без лишней воды."
    lines = [
        f"[Автообучение по реальным ответам, обновлено {generated_at.strftime('%Y-%m-%d')}]",
        f"Этот блок построен по опубликованным ответам на {label} WB/Ozon. Он дополняет ручной промпт пользователя и не заменяет его.",
        f"Учтено ответов: {len(examples)}. Площадки: {_format_counts(stats.get('marketplaces') or {})}.",
        "",
        "Стиль:",
        "- Отвечай на русском языке, вежливо, от лица магазина, на Вы.",
        f"- {avg_hint}",
        "- Не упоминай внутренние правила, обучение, базу знаний, API или маркетплейсные ограничения.",
        "- Правила безопасности важнее примеров из истории: не копируй рискованные обещания и не додумывай факты.",
        "- Не пиши, что карточку уже проверили, ошибку уже исправили, товар уже передали на проверку, компенсация/скидка/замена возможна, если этого явно нет в ручном промпте или данных обращения.",
        "- Не отправляй клиента в чат магазина; если нужен официальный разбор, формулируй нейтрально: можно оформить обращение через поддержку маркетплейса.",
    ]
    if float(stats.get("greeting_ratio") or 0) >= 0.45:
        lines.append("- Начинай с короткого приветствия; если есть имя клиента, используй его аккуратно.")
    if float(stats.get("thanks_ratio") or 0) >= 0.35:
        lines.append("- В начале или первой фразе благодарь клиента за отзыв или вопрос.")
    if float(stats.get("first_person_plural_ratio") or 0) >= 0.35:
        lines.append("- Используй спокойное 'мы': проверим, учтем, передадим информацию команде.")
    if kind == "review":
        lines.extend(
            [
                "",
                "Логика для отзывов:",
                "- 5 звезд: поблагодари, поддержи положительное впечатление, без длинных продажных фраз.",
                "- 4 звезды: поблагодари и мягко покажи, что замечания будут учтены.",
                "- 3 звезды: признай обратную связь, попроси детали только если они реально нужны.",
                "- 1-2 звезды: извинись или вырази сожаление, покажи готовность разобраться, не спорь с клиентом.",
                "- Не обещай компенсации, скидки, замену или сроки, если этого нет в ручном промпте или данных товара.",
                "- Если клиент указывает ошибку в комплектации/описании, поблагодари и напиши, что информация будет проверена, без утверждений 'уже исправили'.",
            ]
        )
    else:
        lines.extend(
            [
                "",
                "Логика для вопросов:",
                "- Сначала дай прямой ответ на вопрос, затем короткое пояснение.",
                "- Если точных характеристик нет в вопросе, товаре или базе знаний, честно попроси уточнить деталь.",
                "- Не придумывай размеры, состав, совместимость, гарантию, сроки доставки и остатки.",
                "- Если название товара выглядит обобщенно ('Товар Ozon', пустое название) или не хватает характеристик, не называй бренд, модель, диаметр, состав и точную совместимость.",
                "- Для вопросов про электричество, безопасность, монтаж, отопление и совместимость отвечай осторожно: укажи, что нужно сверить с характеристиками товара и инструкцией по монтажу.",
                "- Если вопрос про подбор, помоги выбрать по условиям использования и попроси недостающий параметр.",
            ]
        )
    if float(stats.get("apology_ratio") or 0) >= 0.18 and kind == "review":
        lines.append("- Для негативных отзывов сохраняй тон сожаления без обвинений клиента.")
    if float(stats.get("clarify_ratio") or 0) >= 0.25:
        lines.append("- Уточнение проси только тогда, когда без него нельзя дать полезный ответ.")
    return "\n".join(lines).strip()


def _stored_examples(examples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    stored: list[dict[str, Any]] = []
    for item in examples:
        if _answer_has_risky_claim(item.get("answer")):
            continue
        stored.append(
            {
                "marketplace": str(item.get("marketplace") or "")[:30],
                "item_type": str(item.get("item_type") or "")[:30],
                "item_id": str(item.get("item_id") or "")[:128],
                "rating": int(item.get("rating") or 0),
                "product": _clip(_clean_text(item.get("product")), 220),
                "text": _clip(_clean_text(item.get("text")), 900),
                "answer": _clip(_clean_text(item.get("answer")), 900),
                "date": str(item.get("date") or "")[:32],
                "source_at": str(item.get("source_at") or "")[:32],
            }
        )
        if len(stored) >= MAX_STORED_EXAMPLES:
            break
    return stored


def _runtime_safety_prompt(kind: str, *, query_text: str = "") -> str:
    query_low = _clean_text(query_text).lower()
    base = [
        "Критичные ограничения для текущего ответа:",
        "- Не выдумывай факты о товаре, бренде, составе, размерах, совместимости, наличии, сроках, гарантии или безопасности.",
        "- Не утверждай 'мы уже проверили', 'ошибку исправили', 'карточку исправили', 'передали производителю', если этого нет во входных данных.",
        "- Не обещай компенсацию, скидку, замену, возврат денег или личный чат.",
        "- Если данных мало, отвечай честно и осторожно: поблагодари, скажи что информацию нужно сверить/проверить, попроси уточнить недостающий параметр.",
    ]
    if normalize_content_kind(kind) == "question":
        base.extend(
            [
                "- Если товар указан как 'Товар Ozon' или название пустое, не называй конкретную марку/модель и не подтверждай точную совместимость.",
                "- Для технических вопросов формулируй через 'по характеристикам товара нужно сверить...' и рекомендуй монтаж по инструкции/со специалистом.",
            ]
        )
        if "товар ozon" in query_low or "товар wb" in query_low:
            base.append(
                "- В текущем вопросе название товара не определено. Запрещено отвечать 'да, подойдет' или 'нет, не подойдет'. Ответ должен быть осторожным: нужно сверить точные характеристики в карточке товара, например внутренний диаметр, материал, условия монтажа."
            )
        if any(marker in query_low for marker in ("электр", "статичес", "инфракрас", "заземл", "напряж", "безопасн", "пленк", "плёнк")):
            base.append(
                "- В текущем техническом вопросе нельзя утверждать, будет или не будет статическое электричество/опасность. Ответь без категоричного вывода: нужно сверить инструкцию, схему монтажа и требования электробезопасности, при необходимости обратиться к монтажному специалисту."
            )
    return "\n".join(base)


def _answer_has_risky_claim(value: Any) -> bool:
    text = _clean_text(value).lower()
    if not text:
        return False
    patterns = (
        "компенсац",
        "скидк",
        "замен",
        "возврат денег",
        "деньги вер",
        "уже исправ",
        "карточку исправ",
        "уже провер",
        "напишите нам в чат",
        "пишите нам в чат",
    )
    return any(pattern in text for pattern in patterns)


def _pick_relevant_examples(
    examples: list[dict[str, Any]],
    *,
    query_text: str,
    rating: int | None,
    limit: int,
) -> list[dict[str, Any]]:
    if not examples:
        return []
    query_tokens = set(_tokens(query_text))
    scored: list[tuple[float, int, dict[str, Any]]] = []
    for idx, item in enumerate(examples):
        hay = " ".join([str(item.get("product") or ""), str(item.get("text") or ""), str(item.get("answer") or "")])
        item_tokens = set(_tokens(hay))
        score = float(len(query_tokens & item_tokens) * 5)
        if rating is not None and int(item.get("rating") or 0) > 0:
            score += max(0, 4 - abs(int(item.get("rating") or 0) - int(rating)))
        if not query_tokens:
            score += max(0, 3 - idx * 0.05)
        if _clean_text(item.get("text")):
            score += 1.0
        scored.append((score, -idx, item))
    scored.sort(key=lambda row: (row[0], row[1]), reverse=True)
    return [item for score, _, item in scored[: max(1, int(limit or 1))] if score > 0 or not query_tokens]


def _tokens(text: Any) -> list[str]:
    raw = _clean_text(text).lower()
    words = re.findall(r"[a-zа-яё0-9_]{3,}", raw, flags=re.IGNORECASE)
    stop = {
        "это", "для", "что", "как", "или", "при", "его", "она", "они", "вам", "вас", "наш", "нам", "мы",
        "the", "and", "with", "for", "you", "your", "this", "that",
    }
    out: list[str] = []
    seen: set[str] = set()
    for word in words:
        if word in stop or word in seen:
            continue
        seen.add(word)
        out.append(word)
    return out[:80]


def _examples_hash(examples: list[dict[str, Any]]) -> str:
    serializable = [
        {
            "marketplace": item.get("marketplace"),
            "item_id": item.get("item_id"),
            "rating": item.get("rating"),
            "text": _clip(_clean_text(item.get("text")), 280),
            "answer": _clip(_clean_text(item.get("answer")), 420),
        }
        for item in examples
    ]
    raw = json.dumps(serializable, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(raw.encode("utf-8", errors="ignore")).hexdigest()


def _latest_source_at(examples: list[dict[str, Any]]) -> datetime | None:
    dates = [_parse_dt(item.get("source_at")) for item in examples]
    dates = [value for value in dates if value is not None]
    return max(dates) if dates else None


def _load_examples(raw: str) -> list[dict[str, Any]]:
    value = _loads(raw, [])
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _loads(raw: Any, fallback: Any) -> Any:
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(str(raw or ""))
    except Exception:
        return fallback


def _safe_int(value: Any) -> int:
    try:
        return int(value or 0)
    except Exception:
        return 0


def _clean_text(value: Any) -> str:
    text = _repair_mojibake_text(value)
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    return text


def _clip(text: Any, max_chars: int) -> str:
    clean = _clean_text(text)
    limit = max(0, int(max_chars or 0))
    if len(clean) <= limit:
        return clean
    return clean[: max(0, limit - 1)].rstrip() + "…"


def _ratio(values: list[str], predicate) -> float:
    if not values:
        return 0.0
    return round(sum(1 for value in values if predicate(value)) / len(values), 3)


def _contains_any(text: str, needles: list[str]) -> bool:
    lowered = f" {text.lower()} "
    return any(needle in lowered for needle in needles)


def _starts_with_greeting(text: str) -> bool:
    lowered = text.lower().strip()
    return lowered.startswith(("здравствуйте", "добрый день", "добрый вечер", "доброе утро", "привет"))


def _format_counts(value: dict[str, Any]) -> str:
    if not value:
        return "нет данных"
    return ", ".join(f"{key}: {count}" for key, count in sorted(value.items()))


def _iso(value: datetime | None) -> str | None:
    if not value:
        return None
    try:
        return value.replace(microsecond=0).isoformat()
    except Exception:
        return None


def _parse_dt(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None
