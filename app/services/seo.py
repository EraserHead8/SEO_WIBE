from __future__ import annotations

from datetime import datetime, timedelta

from app.services.marketplace import CompetitorCard, get_keyword_position, get_live_search_position


def discover_keywords(
    product_name: str,
    current_description: str,
    competitors: list[CompetitorCard],
    user_keywords: list[str],
    extra_keywords: list[str],
) -> list[str]:
    score: dict[str, int] = {}

    def boost(values: list[str], weight: int):
        for raw in values:
            token = raw.strip().lower()
            if not _is_valid_keyword(token):
                continue
            score[token] = score.get(token, 0) + weight

    boost(_extract_keywords(product_name), 6)
    boost(_phrase_candidates_from_name(product_name), 10)
    boost(_extract_keywords(current_description), 3)

    for comp in competitors:
        boost(_extract_keywords(comp.name), 4)
        boost(_extract_keywords(comp.description), 2)
        boost([k.strip().lower() for k in comp.keywords], 3)

    boost(user_keywords, 8)
    boost(extra_keywords, 9)

    ranked = sorted(
        score.keys(),
        key=lambda x: (
            -score.get(x, 0),
            0 if " " in x else 1,
            -len(x),
            x,
        ),
    )
    return ranked[:30]


def build_seo_description(
    product_name: str,
    current_description: str,
    keywords: list[str],
    competitors: list[CompetitorCard],
) -> str:
    clean_keywords = [k.strip().lower() for k in keywords if _is_valid_keyword(k)]
    top_phrases = [k for k in clean_keywords if " " in k][:3]
    top_single = [k for k in clean_keywords if " " not in k][:2]

    lead = f"{product_name} подходит для надежного монтажа и стабильной работы системы."
    specs = _normalize_source_line(current_description)
    use_case = _build_use_case_sentence(top_phrases, top_single)
    quality = "Материал рассчитан на длительную эксплуатацию, аккуратную посадку и снижение теплопотерь."
    compatibility = "Перед покупкой проверьте диаметр, толщину и совместимость с вашим типом монтажа."
    trust = _build_trust_sentence(competitors)

    chunks = [lead, specs, use_case, quality, compatibility, trust]
    return " ".join([c for c in chunks if c]).strip()


def summarize_competitors(competitors: list[CompetitorCard]) -> str:
    if not competitors:
        return "Конкуренты не найдены"
    lines = []
    for comp in competitors[:5]:
        lines.append(f"#{comp.position}: {comp.name} | ключи: {', '.join(comp.keywords[:5])}")
    return "\n".join(lines)


def evaluate_position(
    marketplace: str,
    article: str,
    keywords: list[str],
    external_id: str = "",
    product_name: str = "",
    wb_api_key: str = "",
) -> int | None:
    return get_live_search_position(
        marketplace,
        article,
        keywords,
        external_id=external_id,
        product_name=product_name,
        wb_api_key=wb_api_key,
    )


def evaluate_positions_for_keywords(
    marketplace: str,
    article: str,
    keywords: list[str],
    external_id: str = "",
    product_name: str = "",
    wb_api_key: str = "",
) -> dict[str, int]:
    result: dict[str, int] = {}
    for kw in keywords:
        if not kw.strip():
            continue
        pos = get_keyword_position(
            marketplace,
            article,
            kw,
            external_id=external_id,
            product_name=product_name,
            wb_api_key=wb_api_key,
        )
        if pos is None:
            continue
        result[kw] = pos
    return result


def schedule_next_check(current_position: int | None, target_position: int) -> datetime:
    if current_position is not None and current_position <= target_position:
        return datetime.utcnow() + timedelta(days=30)
    return datetime.utcnow() + timedelta(days=3)


def _extract_keywords(text: str) -> list[str]:
    tokens = []
    for part in text.lower().split():
        token = part.strip(".,!?:;()\"'[]{}")
        if _is_valid_keyword(token):
            tokens.append(token)
    return list(dict.fromkeys(tokens))


def _top_competitor_keywords(competitors: list[CompetitorCard]) -> list[str]:
    result: list[str] = []
    for comp in competitors:
        for kw in comp.keywords:
            keyword = kw.strip().lower()
            if keyword and keyword not in result:
                result.append(keyword)
    return result


STOP_WORDS = {
    "бани",
    "будь",
    "даже",
    "дома",
    "доме",
    "пены",
    "себе",
    "того",
    "труб",
    "упор",
    "цвет",
    "цена",
    "купить",
    "очень",
    "этот",
    "того",
    "вашем",
    "ваших",
    "когда",
    "между",
    "после",
    "перед",
    "через",
    "всего",
    "похожий",
    "товар",
    "категории",
    "запросам",
    "карточка",
    "близким",
}


def _is_valid_keyword(value: str) -> bool:
    token = value.strip().lower().strip(".,!?:;()\"'[]{}")
    if len(token) < 4:
        return False
    if token in STOP_WORDS:
        return False
    if token.isdigit():
        return False
    return any(ch.isalpha() for ch in token) or any(ch.isdigit() for ch in token)


def _normalize_source_line(current_description: str) -> str:
    raw = " ".join(current_description.replace("\n", " ").split())
    if not raw:
        return ""
    snippet = raw[:220].rstrip(".,;: ")
    return f"Основные характеристики: {snippet}."


def _build_use_case_sentence(top_phrases: list[str], top_single: list[str]) -> str:
    if top_phrases:
        phrase = ", ".join(top_phrases[:3])
        return f"Подходит для задач: {phrase}."
    if top_single:
        phrase = ", ".join(top_single[:3])
        return f"Подходит для работ, где важны: {phrase}."
    return "Подходит для дома, бани и хозяйственных помещений."


def _build_trust_sentence(competitors: list[CompetitorCard]) -> str:
    return ""


def _phrase_candidates_from_name(name: str) -> list[str]:
    low = name.lower()
    out: list[str] = []
    if "утепл" in low and "труб" in low:
        out.append("утеплитель для труб")
    if "дымоход" in low and "труб" in low:
        out.append("труба для дымохода")
    if "колено" in low and "дымоход" in low:
        out.append("колено дымохода")
    return out
