from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session

from app.models import MarketplaceApiCache, Product

try:
    from app.services.wb_modules import _repair_mojibake_text
except Exception:  # pragma: no cover
    def _repair_mojibake_text(value: Any) -> str:
        return str(value or "")


MAX_PRODUCT_SCAN_ROWS = 900
MAX_PRODUCT_CONTEXT_CHARS = 5200
MAX_PRODUCT_DESCRIPTION_CHARS = 520


@dataclass
class ProductMatch:
    score: float
    product: Product
    attributes: dict[str, Any]
    matched_numbers: set[str]


def build_product_ai_context(
    db: Session,
    user_id: int,
    *,
    query_text: str,
    focus_text: str = "",
    marketplace: str = "all",
    content_kind: str = "question",
    owner_member_ids: list[int] | None = None,
    include_unassigned_owner: bool = True,
    max_products: int = 5,
    max_chars: int = MAX_PRODUCT_CONTEXT_CHARS,
) -> str:
    tokens = _query_tokens(query_text)
    if not tokens:
        return ""
    focus_tokens = _query_tokens(focus_text) if str(focus_text or "").strip() else []
    rows = _load_candidate_products(
        db,
        user_id,
        tokens=tokens,
        marketplace=marketplace,
        owner_member_ids=owner_member_ids,
        include_unassigned_owner=include_unassigned_owner,
    )
    if not rows:
        return ""
    matches = _score_products(
        db,
        rows,
        tokens=tokens,
        focus_tokens=focus_tokens,
        query_text=query_text,
        marketplace=marketplace,
    )
    if not matches:
        return ""
    picked = matches[: max(1, min(int(max_products or 1), 8))]
    for match in picked:
        match.attributes = _load_cached_product_attributes(db, match.product)
    requested_specs = {
        token
        for token in (focus_tokens or tokens)
        if _is_compact_numeric_spec(token)
    }
    has_full_number_match = bool(requested_specs) and any(
        requested_specs.issubset(match.matched_numbers)
        for match in picked
    )
    missing_number_match = bool(requested_specs) and not has_full_number_match
    return _format_product_context(
        picked,
        content_kind=content_kind,
        max_chars=max_chars,
        requested_numbers=requested_specs,
        missing_number_match=missing_number_match,
    )


def _load_candidate_products(
    db: Session,
    user_id: int,
    *,
    tokens: list[str],
    marketplace: str,
    owner_member_ids: list[int] | None,
    include_unassigned_owner: bool,
) -> list[Product]:
    safe_market = str(marketplace or "all").strip().lower()
    query = select(Product).where(Product.user_id == int(user_id))
    if safe_market in {"wb", "ozon"}:
        query = query.where(Product.marketplace == safe_market)
    if owner_member_ids is not None:
        ids = [int(x) for x in owner_member_ids if int(x or 0) > 0]
        if not ids:
            if include_unassigned_owner:
                query = query.where(Product.owner_member_id.is_(None))
            else:
                return []
        else:
            owner_filter = Product.owner_member_id.in_(ids)
            if include_unassigned_owner:
                owner_filter = or_(owner_filter, Product.owner_member_id.is_(None))
            query = query.where(owner_filter)

    specific = [token for token in tokens if _is_specific_product_token(token)]
    meaningful = [token for token in (specific or tokens) if len(token) >= 2][:10]
    if meaningful:
        conditions = []
        for token in meaningful:
            pattern = f"%{_escape_like(token)}%"
            conditions.extend(
                [
                    func.lower(func.coalesce(Product.article, "")).like(pattern, escape="\\"),
                    func.lower(func.coalesce(Product.external_id, "")).like(pattern, escape="\\"),
                    func.lower(func.coalesce(Product.barcode, "")).like(pattern, escape="\\"),
                    func.lower(func.coalesce(Product.name, "")).like(pattern, escape="\\"),
                    func.lower(func.coalesce(Product.category_name, "")).like(pattern, escape="\\"),
                    func.lower(func.coalesce(Product.current_description, "")).like(pattern, escape="\\"),
                    func.lower(func.coalesce(Product.target_keywords, "")).like(pattern, escape="\\"),
                ]
            )
        query = query.where(or_(*conditions))
    return db.scalars(query.order_by(desc(Product.updated_at), desc(Product.id)).limit(MAX_PRODUCT_SCAN_ROWS)).all()


def _score_products(
    db: Session,
    rows: list[Product],
    *,
    tokens: list[str],
    focus_tokens: list[str] | None = None,
    query_text: str,
    marketplace: str,
) -> list[ProductMatch]:
    safe_market = str(marketplace or "all").strip().lower()
    token_set = set(tokens)
    focus_token_set = set(focus_tokens or [])
    has_textual_query = any(not _is_numeric_spec_token(token) and len(token) >= 3 for token in token_set)
    has_focus_specific = any(_is_specific_product_token(token) or _is_numeric_spec_token(token) for token in focus_token_set)
    matches: list[ProductMatch] = []
    for product in rows:
        fields = {
            "name": _clean(product.name),
            "article": _clean(product.article),
            "external_id": _clean(product.external_id),
            "barcode": _clean(product.barcode),
            "category": _clean(product.category_name),
            "description": _clean(product.current_description),
            "keywords": _clean(product.target_keywords),
        }
        hay_all = " ".join(fields.values()).lower()
        if not hay_all:
            continue
        score = 0.0
        matched_textual = False
        matched_focus = False
        exact_code_match = False
        matched_numbers: set[str] = set()
        for token in token_set:
            if not token:
                continue
            is_number = _is_numeric_spec_token(token)
            is_focus = token in focus_token_set
            if token == fields["article"].lower() or token == fields["external_id"].lower() or token == fields["barcode"].lower():
                score += 260 if is_focus else 220
                exact_code_match = True
                matched_focus = matched_focus or is_focus
            elif token and any(token in fields[key].lower() for key in ("article", "external_id", "barcode")):
                score += 78 if is_focus else (18 if is_number else 42)
                matched_focus = matched_focus or is_focus
            if token in fields["name"].lower():
                score += _token_field_score(token, "name", is_focus=is_focus)
                matched_textual = matched_textual or not is_number
                matched_focus = matched_focus or is_focus
                if is_number:
                    matched_numbers.add(token)
            if token in fields["category"].lower():
                score += _token_field_score(token, "category", is_focus=is_focus)
                matched_textual = matched_textual or not is_number
                matched_focus = matched_focus or is_focus
                if is_number:
                    matched_numbers.add(token)
            if token in fields["keywords"].lower():
                score += _token_field_score(token, "keywords", is_focus=is_focus)
                matched_textual = matched_textual or not is_number
                matched_focus = matched_focus or is_focus
                if is_number:
                    matched_numbers.add(token)
            if token in fields["description"].lower():
                score += _token_field_score(token, "description", is_focus=is_focus)
                matched_textual = matched_textual or not is_number
                matched_focus = matched_focus or is_focus
                if is_number:
                    matched_numbers.add(token)
        query_low = _clean(query_text).lower()
        name_low = fields["name"].lower()
        if name_low and name_low in query_low:
            score += 120
        if safe_market in {"wb", "ozon"} and str(product.marketplace or "").strip().lower() == safe_market:
            score += 8
        if str(product.marketplace or "").strip().lower() == "wb":
            score += 3
        if fields["description"]:
            score += 2
        if has_focus_specific and matched_focus:
            score += 35
        elif has_focus_specific and name_low and name_low in query_low:
            score -= 45
        if has_textual_query and not matched_textual and not exact_code_match:
            continue
        if score < 8:
            continue
        matches.append(ProductMatch(score=score, product=product, attributes={}, matched_numbers=matched_numbers))
    matches.sort(key=lambda item: (item.score, _product_recency_key(item.product)), reverse=True)
    return matches


def _format_product_context(
    matches: list[ProductMatch],
    *,
    content_kind: str,
    max_chars: int,
    requested_numbers: set[str] | None = None,
    missing_number_match: bool = False,
) -> str:
    if not matches:
        return ""
    label = "вопрос" if str(content_kind or "").strip().lower() == "question" else "отзыв"
    parts = [
        "Контекст из модуля товаров SEO WIBE.",
        (
            "Используй эти карточки только если они действительно подходят к обращению клиента. "
            f"Если вопрос про номенклатуру, подбор, размер, совместимость или артикул, опирайся на эти данные. "
            "Если подходящая карточка найдена уверенно, укажи в ответе ее артикул маркетплейса: для WB это WB nmID/артикул WB, для Ozon это product_id. "
            "При подборе из нескольких вариантов можно кратко назвать 1-3 варианта с артикулами. "
            "Не придумывай характеристики, которых нет ниже. Если релевантность сомнительная, попроси уточнить параметры."
        ),
        f"Тип обращения: {label}.",
    ]
    if missing_number_match and requested_numbers:
        numbers = ", ".join(sorted(requested_numbers))
        parts.append(
            f"В обращении есть число/размер {numbers}, но в найденных карточках точное совпадение не подтверждено. "
            "Не выдавай эти товары как точный подбор по размеру; лучше уточни параметры или скажи, что точного совпадения в найденных данных нет. "
            "Не называй артикулы, product_id, nmID, SKU или штрихкоды из вариантов ниже, пока совпадение по размеру не подтверждено."
        )
    include_catalog_codes = not missing_number_match
    for idx, match in enumerate(matches, 1):
        product = match.product
        market = str(product.marketplace or "").strip().upper() or "-"
        article = _clean(product.article)
        external_id = _clean(product.external_id)
        code_parts = [f"площадка: {market}"]
        if include_catalog_codes and article:
            code_parts.append(f"артикул продавца: {article}")
        if include_catalog_codes and external_id:
            if market == "WB":
                code_parts.append(f"WB nmID/артикул WB: {external_id}")
            elif market == "OZON":
                code_parts.append(f"Ozon product_id: {external_id}")
            else:
                code_parts.append(f"external_id: {external_id}")
        if include_catalog_codes and _clean(product.barcode):
            code_parts.append(f"штрихкод: {_clean(product.barcode)}")
        if _clean(product.category_name):
            code_parts.append(f"категория: {_clean(product.category_name)}")
        price = _price_summary(product)
        if price:
            code_parts.append(price)
        parts.append(f"{idx}. {_clean(product.name) or 'Товар'} ({'; '.join(code_parts)}).")
        desc = _clip(_clean(product.current_description), MAX_PRODUCT_DESCRIPTION_CHARS)
        if desc:
            parts.append(f"Описание: {desc}")
        keywords = _clip(_clean(product.target_keywords), 260)
        if keywords:
            parts.append(f"Ключевые слова/заметки: {keywords}")
        attrs = _format_attributes(match.attributes, max_items=8)
        if attrs:
            parts.append(f"Характеристики: {attrs}")
    return _clip("\n".join(parts), max(1200, int(max_chars or MAX_PRODUCT_CONTEXT_CHARS)))


def _load_cached_product_attributes(db: Session, product: Product) -> dict[str, Any]:
    rows = db.scalars(
        select(MarketplaceApiCache)
        .where(
            MarketplaceApiCache.user_id == int(product.user_id),
            MarketplaceApiCache.module_code == "products_details",
            MarketplaceApiCache.marketplace == str(product.marketplace or "").strip().lower(),
        )
        .order_by(desc(MarketplaceApiCache.updated_at), desc(MarketplaceApiCache.id))
        .limit(80)
    ).all()
    article = _clean(product.article).lower()
    external = _clean(product.external_id).lower()
    product_id = str(product.id)
    for row in rows:
        cache_key = str(row.cache_key or "").lower()
        payload = _loads(row.payload_json, {})
        if not isinstance(payload, dict):
            continue
        raw_text = _clean(json.dumps(payload, ensure_ascii=False)).lower()
        matched = (
            product_id in cache_key
            or bool(article and article in raw_text)
            or bool(external and external in raw_text)
        )
        if not matched:
            continue
        attrs = payload.get("attributes")
        if isinstance(attrs, dict) and attrs:
            return attrs
    return {}


def _format_attributes(attrs: dict[str, Any], *, max_items: int) -> str:
    if not isinstance(attrs, dict) or not attrs:
        return ""
    items: list[str] = []
    for key, value in attrs.items():
        if len(items) >= max_items:
            break
        name = _clean(key)
        if not name:
            continue
        text = _clean(value if not isinstance(value, (dict, list)) else json.dumps(value, ensure_ascii=False))
        if not text:
            continue
        items.append(f"{name}: {_clip(text, 120)}")
    return "; ".join(items)


def _price_summary(product: Product) -> str:
    values = [
        ("цена", float(product.price_discount or product.price_base or 0.0)),
        ("мин. цена", float(product.price_min or 0.0)),
    ]
    parts = [f"{label}: {amount:.0f}" for label, amount in values if amount > 0]
    return "; ".join(parts)


def _query_tokens(text: str) -> list[str]:
    raw = _clean(text).lower()
    words = re.findall(r"[a-zа-яё0-9_./,хx-]{2,}", raw, flags=re.IGNORECASE)
    stop = {
        "для", "что", "как", "или", "при", "это", "эта", "этот", "они", "она", "оно", "вам", "вас", "нас", "наш", "мы",
        "под", "над", "без", "есть", "можно", "нужно", "добрый", "день", "час", "товар", "ozon", "wb",
        "на", "по", "от", "до", "из", "за", "ли", "же", "бы", "вы", "мы", "он", "она",
        "подойдет", "подходит", "подойдут", "подходят", "нужен", "нужна", "нужны", "какой", "какая", "какие",
        "скажите", "подскажите", "посоветуйте", "здравствуйте", "спасибо", "артикул", "номер", "код",
        "выбрать", "выбери", "выбрат", "характеристики", "характеристик", "размер", "размеры", "мм", "см",
        "the", "and", "with", "for", "you", "your", "this", "that",
    }
    out: list[str] = []
    seen: set[str] = set()
    for word in words:
        token = word.strip(" -_/.,;:()[]{}\"'")
        if not token or token in stop or token in seen:
            continue
        for variant in _token_variants(token):
            if not variant or variant in stop or variant in seen:
                continue
            seen.add(variant)
            out.append(variant)
            if len(out) >= 48:
                return out
    return out[:48]


def _token_variants(token: str) -> list[str]:
    base = str(token or "").strip().lower()
    if not base:
        return []
    variants = [base]
    if re.search(r"\d", base):
        for item in _numeric_token_variants(base):
            if item and item not in variants:
                variants.append(item)
    if re.search(r"\d+[xх]\d+", base):
        swapped = base.replace("x", "х")
        if swapped not in variants:
            variants.append(swapped)
        swapped = base.replace("х", "x")
        if swapped not in variants:
            variants.append(swapped)
        for part in re.split(r"[xх/]", base):
            part = part.strip(" -_/.,;:")
            if len(part) >= 2 and part not in variants:
                variants.append(part)
    if re.search(r"[а-яё]", base, flags=re.IGNORECASE):
        stem = _russian_light_stem(base)
        if stem and stem != base:
            variants.append(stem)
        if len(base) >= 7:
            prefix = base[:6]
            if prefix not in variants:
                variants.append(prefix)
    return variants


def _numeric_token_variants(token: str) -> list[str]:
    raw = str(token or "").strip().lower()
    variants: list[str] = []
    swapped_decimal = raw.replace(",", ".") if "," in raw else raw.replace(".", ",")
    if swapped_decimal != raw:
        variants.append(swapped_decimal)
    for match in re.finditer(r"\d+[.,]\d+", raw):
        num = match.group(0)
        for value in (num, num.replace(".", ","), num.replace(",", ".")):
            if value not in variants:
                variants.append(value)
    for match in re.finditer(r"\d{2,4}(?:[xх/]\d{2,4})+", raw):
        value = match.group(0)
        for item in (value, value.replace("x", "х"), value.replace("х", "x")):
            if item not in variants:
                variants.append(item)
    return variants


def _is_numeric_spec_token(token: str) -> bool:
    value = str(token or "").strip().lower()
    if not value:
        return False
    if value.isdigit():
        return True
    return bool(
        re.fullmatch(r"\d+[.,]\d+(?:мм|см|м)?", value)
        or re.fullmatch(r"\d+(?:[xх/]\d+)+(?:мм|см|м)?", value)
        or re.fullmatch(r"\d+(?:мм|см|м)", value)
    )


def _is_compact_numeric_spec(token: str) -> bool:
    value = str(token or "").strip().lower()
    if not _is_numeric_spec_token(value):
        return False
    if len(value) > 8:
        return False
    if value.endswith("м") and not value.endswith(("мм", "см")):
        return False
    return True


def _token_field_score(token: str, field: str, *, is_focus: bool) -> int:
    numeric = _is_numeric_spec_token(token)
    if field == "name":
        base = 18
    elif field == "category":
        base = 10
    elif field == "keywords":
        base = 9
    else:
        base = 5
    if numeric:
        base = 4 if not is_focus else (14 if not str(token or "").isdigit() else max(3, base // 2))
    if is_focus:
        base += 26 if numeric else 10
    return base


def _is_specific_product_token(token: str) -> bool:
    value = str(token or "").strip().lower()
    if _is_numeric_spec_token(value):
        return not value.isdigit()
    if len(value) < 4:
        return False
    generic = {
        "труб", "труба", "трубы", "трубу", "трубе", "метр", "метра", "метров",
        "штук", "штуки", "штука", "размер", "диаметр", "диамет", "характеристик",
        "совместимость", "совместим", "подбор", "выбрат", "выбрать",
    }
    return value not in generic


def _russian_light_stem(token: str) -> str:
    endings = (
        "иями", "ями", "ами", "ением", "ения", "ение", "ении", "иях", "ого", "ему", "ыми", "ими",
        "ая", "яя", "ое", "ее", "ые", "ие", "ый", "ий", "ой", "ам", "ям", "ах", "ях", "ов", "ев",
        "ом", "ем", "ою", "ею", "ою", "ую", "юю", "ия", "ья", "а", "я", "ы", "и", "у", "ю", "е",
    )
    for ending in endings:
        if token.endswith(ending) and len(token) - len(ending) >= 4:
            return token[: -len(ending)]
    return token


def _escape_like(value: str) -> str:
    return str(value or "").replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_").lower()


def _product_recency_key(product: Product) -> float:
    try:
        return float(product.updated_at.timestamp()) if product.updated_at else 0.0
    except Exception:
        return 0.0


def _loads(raw: Any, fallback: Any) -> Any:
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(str(raw or ""))
    except Exception:
        return fallback


def _clean(value: Any) -> str:
    return " ".join(_repair_mojibake_text(value).split())


def _clip(value: str, max_chars: int) -> str:
    text = _clean(value)
    limit = max(0, int(max_chars or 0))
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "…"
