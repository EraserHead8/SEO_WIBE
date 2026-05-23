from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
import os
import re
import time
from typing import Any
from urllib.parse import quote_plus, urlsplit
try:
    import httpx
except Exception:  # pragma: no cover
    httpx = None
try:
    from playwright.sync_api import sync_playwright
except Exception:  # pragma: no cover
    sync_playwright = None

WB_CONNECT_TIMEOUT = 4.0
WB_READ_TIMEOUT = 8.0
WB_MAX_PAGES = 40
WB_PER_PAGE = 100
WB_CACHE_TTL_SEC = 45
WB_BROWSER_MAX_PAGES = 6
WB_POSITION_LIMIT = 500
WB_POSITION_OVERFLOW = 501

_WB_SEARCH_CACHE: dict[tuple[str, int, int], tuple[float, list[dict[str, Any]] | None]] = {}
_WB_ANALYTICS_CACHE: dict[tuple[str, str, str], tuple[float, int | None]] = {}
_OZON_CATEGORY_TREE_CACHE: dict[str, tuple[float, dict[tuple[int, int], str]]] = {}
_OZON_CATEGORY_TREE_TTL_SEC = 12 * 60 * 60
_PUBLIC_BASE_URL = str(os.getenv("SEO_WIBE_PUBLIC_BASE_URL") or "https://seowibe.ru").strip().rstrip("/")


@dataclass
class MarketplaceProduct:
    article: str
    external_id: str
    barcode: str
    photo_url: str
    name: str
    description: str
    category_name: str = ""
    photos: list[str] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class CompetitorCard:
    name: str
    description: str
    keywords: list[str]
    position: int
    url: str = ""


def fetch_products_from_marketplace(marketplace: str, api_key: str, articles: list[str], import_all: bool) -> list[MarketplaceProduct]:
    """
    Заглушка для MVP.
    Здесь добавляется реальная интеграция с WB/Ozon API.
    """
    if httpx and marketplace == "wb":
        live = _fetch_wb_products(api_key, articles, import_all)
        if live is not None:
            return live
    if httpx and marketplace == "ozon":
        live = _fetch_ozon_products(api_key, articles, import_all)
        if live is not None:
            return live

    demo_names = [
        "Дымоходная труба 110 мм",
        "Сэндвич-дымоход нержавеющий",
        "Колено дымохода 45 градусов",
        "Труба дымохода утепленная",
    ]
    result: list[MarketplaceProduct] = []
    source_articles = articles if articles else ["ART-000001", "ART-000002", "ART-000003"]
    if import_all:
        source_articles = [f"{marketplace.upper()}-ART-{100000 + i}" for i in range(1, 31)]

    for i, article in enumerate(source_articles):
        name = demo_names[i % len(demo_names)]
        barcode = build_demo_barcode(i + 1)
        result.append(
            MarketplaceProduct(
                article=article,
                external_id="",
                barcode=barcode,
                photo_url=f"https://picsum.photos/seed/{marketplace}-{i+1}/120/120",
                name=name,
                description=(
                    f"{name}. Подходит для безопасного отвода дыма. "
                    "Усиленная сталь, стабильная тяга, монтаж без лишней сложности."
                ),
                photos=[f"https://picsum.photos/seed/{marketplace}-{i+1}/120/120"],
            )
        )
    return result


def find_competitors(
    marketplace: str,
    product_name: str,
    current_description: str,
    exclude_external_id: str = "",
) -> list[CompetitorCard]:
    """
    Заглушка поиска конкурентов в живой выдаче.
    При интеграции с WB/Ozon/аналитикой здесь нужно подставить реальные данные.
    """
    seed_keywords = _extract_keywords(product_name + " " + current_description)
    base_words = seed_keywords[:6] if seed_keywords else ["дымоход", "труба", "нержавейка"]

    if httpx and marketplace == "wb":
        live = _find_wb_competitors(base_words, product_name, exclude_external_id=exclude_external_id)
        if live:
            return live

    competitors: list[CompetitorCard] = []
    low_name = product_name.lower()
    extra_kw: list[str] = []
    if "утепл" in low_name and "труб" in low_name:
        extra_kw.append("утеплитель для труб")
    if "дымоход" in low_name:
        extra_kw.append("дымоходная труба")
    fallback_query = " ".join((extra_kw or base_words[:3])[:3]).strip() or product_name
    for i in range(1, 6):
        kw = list(dict.fromkeys(base_words[:6] + extra_kw))
        competitors.append(
            CompetitorCard(
                name=f"Похожая карточка выдачи #{i}",
                description=(
                    f"Похожая карточка из выдачи {marketplace.upper()} по близким запросам категории."
                ),
                keywords=kw,
                position=i,
                url=_build_marketplace_search_url(marketplace, fallback_query),
            )
        )
    return competitors


def update_product_description(
    marketplace: str,
    api_key: str,
    article: str,
    description: str,
    external_id: str = "",
) -> bool:
    """
    Заглушка для MVP. Реальная отправка изменений в WB/Ozon.
    """
    try:
        if not httpx:
            return False
        if marketplace == "wb":
            return _update_wb_description(api_key, article, description, external_id=external_id)
        if marketplace == "ozon":
            return _update_ozon_description(api_key, article, description)
    except Exception:
        return False
    return False


def update_product_photos_order(
    marketplace: str,
    api_key: str,
    article: str,
    external_id: str,
    photos: list[str],
) -> tuple[bool, str]:
    """
    Best-effort reorder of product media on marketplace.
    Returns tuple: (ok, reason) to keep UI transparent on API limitations.
    """
    try:
        normalized = _dedupe_photo_urls(list(photos or []))
        if not normalized:
            return False, "empty_photos"
        if not httpx:
            return False, "http_client_unavailable"
        safe_market = str(marketplace or "").strip().lower()
        if safe_market == "wb":
            ok = _update_wb_photos_order(api_key, article, external_id, normalized)
            return (ok, "ok" if ok else "wb_api_rejected")
        if safe_market == "ozon":
            ok = _update_ozon_photos_order(api_key, article, external_id, normalized)
            return (ok, "ok" if ok else "ozon_api_rejected")
    except Exception as exc:
        return False, str(exc)[:180]
    return False, "unsupported_marketplace"


def get_live_search_position(
    marketplace: str,
    article: str,
    keywords: list[str],
    external_id: str = "",
    product_name: str = "",
    wb_api_key: str = "",
) -> int | None:
    active_keywords = [k.strip() for k in keywords if k.strip()]
    if not active_keywords:
        return None

    # For WB we try real search ranking by the first high-signal keywords.
    if marketplace == "wb":
        if not httpx:
            return None
        sample = active_keywords[:5]
        found_by_kw: dict[str, int] = {}
        for kw in sample:
            pos = get_keyword_position(
                marketplace,
                article,
                kw,
                external_id=external_id,
                product_name=product_name,
                wb_api_key=wb_api_key,
            )
            normalized = _normalize_position(pos)
            if normalized is not None:
                found_by_kw[kw] = normalized
        if found_by_kw:
            primary = sample[0]
            if primary in found_by_kw:
                return found_by_kw[primary]
            return min(found_by_kw.values())
        return None

    # Fallback deterministic score when live search is unavailable.
    diversity = len(set(k.lower() for k in active_keywords))
    article_boost = (sum(ord(ch) for ch in article) % 7) + 1
    base = 35 - min(diversity * 2, 20) - article_boost
    return max(1, min(WB_POSITION_LIMIT, base))


def get_keyword_position(
    marketplace: str,
    article: str,
    keyword: str,
    external_id: str = "",
    product_name: str = "",
    wb_api_key: str = "",
) -> int | None:
    if marketplace == "wb":
        if not httpx:
            return None
        pos = _wb_keyword_position(
            article,
            keyword,
            external_id=external_id,
            product_name=product_name,
            wb_api_key=wb_api_key,
        )
        return _normalize_position(pos)

    # Fallback deterministic score when live search is unavailable.
    raw = sum(ord(ch) for ch in f"{marketplace}:{article}:{keyword.lower()}")
    return (raw % 50) + 1


def build_demo_barcode(num: int) -> str:
    # Имитация EAN-13
    base = f"200000000{num:04d}"
    return base[:13]


def _extract_keywords(text: str) -> list[str]:
    cleaned = []
    for token in text.lower().split():
        word = token.strip(".,!?:;()[]{}\"'")
        if len(word) >= 4 and any(ch.isalpha() for ch in word):
            cleaned.append(word)
    return list(dict.fromkeys(cleaned))


def _find_wb_competitors(base_words: list[str], product_name: str, exclude_external_id: str = "") -> list[CompetitorCard]:
    if not httpx:
        return []
    product_tokens = _topic_tokens(product_name)
    query_tokens = product_tokens[:3] if product_tokens else base_words[:3]
    query = " ".join(query_tokens).strip()
    if not query:
        return []
    products = _wb_search_products(query, page=1, per_page=60)
    if products is None:
        return []
    if not products:
        return []
    excluded_nm = _normalize_code(exclude_external_id)
    relevant_products = []
    for p in products:
        nm_raw = str(p.get("id") or p.get("nm") or "")
        if excluded_nm and _normalize_code(nm_raw) == excluded_nm:
            continue
        pname = str(p.get("name") or p.get("brand") or "")
        pdesc = str(p.get("supplier") or "")
        if _is_relevant_competitor(pname, pdesc, product_tokens):
            relevant_products.append(p)

    products = relevant_products if relevant_products else [p for p in products if _normalize_code(str(p.get("id") or p.get("nm") or "")) != excluded_nm]
    result: list[CompetitorCard] = []
    for idx, product in enumerate(products[:8], start=1):
        nm_id = product.get("id") or product.get("nm")
        url = f"https://www.wildberries.ru/catalog/{nm_id}/detail.aspx" if nm_id else ""
        name = str(product.get("name") or product.get("brand") or f"WB товар {idx}")
        desc = str(product.get("supplier") or "")
        keywords = _extract_keywords(f"{name} {desc} {' '.join(base_words)}")[:10]
        result.append(
            CompetitorCard(
                name=name,
                description=desc,
                keywords=keywords if keywords else base_words[:5],
                position=idx,
                url=url,
            )
        )
    if not result:
        return []
    return result[:5]


def _wb_keyword_position(
    article: str,
    keyword: str,
    external_id: str = "",
    product_name: str = "",
    wb_api_key: str = "",
) -> int | None:
    query = " ".join(keyword.strip().split())
    if not query:
        return None

    normalized_article = _normalize_code(article)
    normalized_external = _normalize_code(external_id)
    normalized_name = _normalize_code(product_name)
    name_tokens = _topic_tokens(product_name)
    pages = WB_MAX_PAGES
    per_page = WB_PER_PAGE
    started = time.monotonic()

    for page in range(1, pages + 1):
        if time.monotonic() - started > 45.0:
            break
        products = _wb_search_products(query, page=page, per_page=per_page)
        if products is None:
            break
        if not products:
            break

        page_offset = (page - 1) * per_page
        if page_offset >= WB_POSITION_LIMIT:
            break
        page_limit = max(0, WB_POSITION_LIMIT - page_offset)
        for idx, product in enumerate(products[:page_limit]):
            if _wb_product_matches(normalized_article, normalized_external, normalized_name, name_tokens, product):
                return _normalize_position(page_offset + idx + 1)
    # Fallback: WB seller analytics report can return keyword position by nmID.
    analytics_pos = _wb_keyword_position_analytics(wb_api_key=wb_api_key, external_id=external_id, keyword=query)
    if analytics_pos is not None:
        return _normalize_position(analytics_pos)
    return _normalize_position(_wb_keyword_position_browser(query=query, external_id=external_id, article=article))


def _wb_keyword_position_analytics(wb_api_key: str, external_id: str, keyword: str) -> int | None:
    if not httpx:
        return None
    token = wb_api_key.strip()
    nm_id = _normalize_code(external_id)
    query = " ".join(keyword.strip().split())
    if not token or not nm_id.isdigit() or not query:
        return None

    cache_key = (nm_id, query.lower(), "orders_v2")
    cached = _WB_ANALYTICS_CACHE.get(cache_key)
    now = time.monotonic()
    if cached and now - cached[0] <= 120:
        return cached[1]

    today = date.today()
    begin = today - timedelta(days=14)
    payload = {
        "period": {"begin": begin.isoformat(), "end": today.isoformat()},
        "nmId": int(nm_id),
        "searchTexts": [query],
    }
    headers = {"Authorization": token, "Content-Type": "application/json"}
    timeout = httpx.Timeout(connect=WB_CONNECT_TIMEOUT, read=max(WB_READ_TIMEOUT, 10.0), write=max(WB_READ_TIMEOUT, 10.0), pool=max(WB_READ_TIMEOUT, 10.0))
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            response = client.post(
                "https://seller-analytics-api.wildberries.ru/api/v2/search-report/product/orders",
                headers=headers,
                json=payload,
            )
            if response.status_code >= 400:
                _WB_ANALYTICS_CACHE[cache_key] = (now, None)
                return None
            data = response.json()
    except Exception:
        _WB_ANALYTICS_CACHE[cache_key] = (now, None)
        return None

    positions: list[int] = []
    _collect_positions_from_payload(data, positions)
    if not positions:
        _WB_ANALYTICS_CACHE[cache_key] = (now, None)
        return None
    result = min(positions)
    _WB_ANALYTICS_CACHE[cache_key] = (now, result)
    return result


def _collect_positions_from_payload(node: Any, out: list[int]) -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            low = key.lower()
            if "position" in low and isinstance(value, (int, float)):
                pos = int(round(float(value)))
                if 1 <= pos <= 5000:
                    out.append(pos)
            _collect_positions_from_payload(value, out)
    elif isinstance(node, list):
        for item in node:
            _collect_positions_from_payload(item, out)


def _wb_keyword_position_browser(query: str, external_id: str, article: str = "") -> int | None:
    if not sync_playwright:
        return None
    normalized_external = _normalize_code(external_id)
    normalized_article = _normalize_code(article)
    if not normalized_external:
        # Without external id we still can try by vendor/article via card details.
        if not normalized_article:
            return None
    safe_query = quote_plus(" ".join(query.strip().split()))
    if not safe_query:
        return None

    scanned = 0
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                locale="ru-RU",
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                ),
            )
            page = context.new_page()
            page.set_default_timeout(20000)

            for page_num in range(1, WB_BROWSER_MAX_PAGES + 1):
                if scanned >= WB_POSITION_LIMIT:
                    break
                url = f"https://www.wildberries.ru/catalog/0/search.aspx?search={safe_query}&page={page_num}"
                page.goto(url, wait_until="domcontentloaded")
                # Let WB client render product links after initial load/challenge.
                page.wait_for_timeout(2500)
                html = page.content()
                ids = _extract_wb_ids_from_html(html)
                if not ids:
                    continue
                ids = ids[: max(0, WB_POSITION_LIMIT - scanned)]
                for idx, nm_id in enumerate(ids):
                    if _normalize_code(nm_id) == normalized_external:
                        context.close()
                        browser.close()
                        return _normalize_position(scanned + idx + 1)
                if normalized_article:
                    details_limit = min(len(ids), 140)
                    details = _wb_fetch_card_details(ids[:details_limit])
                    if details:
                        for idx, nm_id in enumerate(ids[:details_limit]):
                            card = details.get(str(nm_id), {})
                            vendor = _normalize_code(
                                str(
                                    card.get("supplierVendorCode")
                                    or card.get("vendorCode")
                                    or card.get("suppliervendorcode")
                                    or ""
                                )
                            )
                            if vendor and _codes_equal(vendor, normalized_article):
                                context.close()
                                browser.close()
                                return _normalize_position(scanned + idx + 1)
                scanned += len(ids)
            context.close()
            browser.close()
    except Exception:
        return None
    return None


def _wb_search_products(query: str, page: int = 1, per_page: int = 30) -> list[dict[str, Any]] | None:
    if not httpx:
        return []
    normalized_query = " ".join(query.lower().strip().split())
    cache_key = (normalized_query, page, per_page)
    cached = _WB_SEARCH_CACHE.get(cache_key)
    now = time.monotonic()
    if cached and now - cached[0] <= WB_CACHE_TTL_SEC:
        return cached[1]

    endpoint_variants = [
        "https://search.wb.ru/exactmatch/ru/common/v4/search",
        "https://search.wb.ru/exactmatch/ru/common/v5/search",
        "https://search.wb.ru/exactmatch/ru/common/v9/search",
        "https://search.wb.ru/exactmatch/ru/common/v13/search",
    ]
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json",
    }
    params_base = {
        "query": normalized_query,
        "resultset": "catalog",
        "limit": per_page,
        "page": page,
        "appType": 1,
        "curr": "rub",
        "spp": 30,
        "locale": "ru",
        "lang": "ru",
    }
    # WB выдача может отличаться по региону; пробуем несколько популярных dest.
    dest_variants = [-1257786, -1029256, -2133464]

    timeout = httpx.Timeout(connect=WB_CONNECT_TIMEOUT, read=WB_READ_TIMEOUT, write=WB_READ_TIMEOUT, pool=WB_READ_TIMEOUT)
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        for endpoint in endpoint_variants:
            for dest in dest_variants:
                params = dict(params_base)
                params["dest"] = dest
                try:
                    response = client.get(endpoint, params=params, headers=headers)
                    if response.status_code == 429:
                        continue
                    if response.status_code >= 400:
                        continue
                    if "application/json" not in response.headers.get("content-type", ""):
                        body = response.text[:300].lower()
                        if "too many requests" in body or "почти готово" in body:
                            continue
                        continue
                    data = response.json()
                    products = _extract_wb_products_from_payload(data)
                    if isinstance(products, list):
                        _WB_SEARCH_CACHE[cache_key] = (now, products)
                        return products
                    routed_products = _wb_search_products_via_shard(
                        client=client,
                        base_data=data,
                        headers=headers,
                        params_base=params,
                    )
                    if isinstance(routed_products, list):
                        _WB_SEARCH_CACHE[cache_key] = (now, routed_products)
                        return routed_products
                except Exception:
                    continue
    html_products = _wb_search_products_html(query, page=page, per_page=per_page)
    if html_products:
        _WB_SEARCH_CACHE[cache_key] = (now, html_products)
        return html_products
    return None


def _extract_wb_products_from_payload(data: dict[str, Any]) -> list[dict[str, Any]] | None:
    if not isinstance(data, dict):
        return None
    candidates = [
        data.get("data", {}).get("products"),
        data.get("products"),
        data.get("search_result", {}).get("products"),
        data.get("result", {}).get("products"),
    ]
    for item in candidates:
        if isinstance(item, list):
            return item
    return None


def _wb_search_products_via_shard(
    client: Any,
    base_data: dict[str, Any],
    headers: dict[str, str],
    params_base: dict[str, Any],
) -> list[dict[str, Any]] | None:
    if not isinstance(base_data, dict):
        return None
    shard_key = str(base_data.get("shardKey") or "").strip().strip("/")
    routed_query = str(base_data.get("query") or "").strip()
    if not shard_key or not routed_query:
        return None

    # WB часто возвращает preset-роут вместо products; повторяем запрос в shard endpoint.
    shard_endpoints = [
        f"https://search.wb.ru/exactmatch/ru/{shard_key}/v13/search",
        f"https://search.wb.ru/exactmatch/ru/{shard_key}/v9/search",
    ]
    for endpoint in shard_endpoints:
        try:
            params = dict(params_base)
            params["query"] = routed_query
            response = client.get(endpoint, params=params, headers=headers)
            if response.status_code == 429 or response.status_code >= 400:
                continue
            if "application/json" not in response.headers.get("content-type", ""):
                continue
            data = response.json()
            products = _extract_wb_products_from_payload(data)
            if isinstance(products, list):
                return products
        except Exception:
            continue
    return None


def _wb_search_products_html(query: str, page: int = 1, per_page: int = 30) -> list[dict[str, Any]]:
    if not httpx:
        return []
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
    }
    params = {"search": query}
    if page > 1:
        params["page"] = page
    timeout = httpx.Timeout(connect=WB_CONNECT_TIMEOUT, read=WB_READ_TIMEOUT, write=WB_READ_TIMEOUT, pool=WB_READ_TIMEOUT)
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            response = client.get("https://www.wildberries.ru/catalog/0/search.aspx", params=params, headers=headers)
            if response.status_code >= 400:
                return []
            html = response.text
    except Exception:
        return []

    ids = _extract_wb_ids_from_html(html)
    if not ids:
        return []
    batch = ids[:per_page]
    if not batch:
        return []
    products = [{"id": nm_id} for nm_id in batch]
    details = _wb_fetch_card_details(batch)
    if details:
        for product in products:
            nm_id = str(product.get("id") or "")
            detail = details.get(nm_id)
            if detail:
                product.update(detail)
    return products


def _extract_wb_ids_from_html(html: str) -> list[str]:
    ids = re.findall(r"/catalog/(\d+)/detail\.aspx", html)
    unique: list[str] = []
    seen: set[str] = set()
    for nm_id in ids:
        if nm_id in seen:
            continue
        seen.add(nm_id)
        unique.append(nm_id)
    return unique


def _wb_fetch_card_details(ids: list[str]) -> dict[str, dict[str, Any]]:
    if not httpx or not ids:
        return {}
    endpoint = "https://card.wb.ru/cards/v2/detail"
    params = {
        "appType": 1,
        "curr": "rub",
        "dest": -1257786,
        "spp": 30,
        "nm": ";".join(ids[:30]),
    }
    timeout = httpx.Timeout(connect=WB_CONNECT_TIMEOUT, read=WB_READ_TIMEOUT, write=WB_READ_TIMEOUT, pool=WB_READ_TIMEOUT)
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            response = client.get(endpoint, params=params)
            if response.status_code >= 400:
                return {}
            data = response.json()
    except Exception:
        return {}

    products = data.get("data", {}).get("products", [])
    out: dict[str, dict[str, Any]] = {}
    if not isinstance(products, list):
        return out
    for item in products:
        nm_id = str(item.get("id") or "")
        if not nm_id:
            continue
        out[nm_id] = {
            "id": item.get("id"),
            "name": item.get("name") or item.get("brand") or "",
            "supplier": item.get("supplier") or "",
            "supplierVendorCode": item.get("supplierVendorCode") or item.get("vendorCode") or "",
        }
    return out


def _wb_product_matches(
    normalized_article: str,
    normalized_external: str,
    normalized_name: str,
    name_tokens: list[str],
    product: dict[str, Any],
) -> bool:
    vendor = _extract_wb_vendor_code(product)
    nm_id = _extract_wb_nm_id(product)
    name = _normalize_code(str(product.get("name") or product.get("title") or product.get("brand") or ""))
    subject = _normalize_code(str(product.get("subjectName") or product.get("subject") or ""))

    if normalized_external and nm_id and _codes_equal(normalized_external, nm_id):
        return True
    if normalized_external and nm_id and len(normalized_external) >= 6 and (normalized_external in nm_id or nm_id in normalized_external):
        return True

    if normalized_article and vendor and _codes_equal(normalized_article, vendor):
        return True
    if normalized_article and vendor and len(normalized_article) >= 6 and (normalized_article in vendor or vendor in normalized_article):
        return True
    if normalized_article and nm_id and normalized_article.isdigit() and _codes_equal(normalized_article, nm_id):
        return True
    if normalized_article and name and len(normalized_article) >= 6 and normalized_article in name:
        return True
    if normalized_article and subject and len(normalized_article) >= 6 and normalized_article in subject:
        return True
    if normalized_name and name:
        shared = 0
        for token in name_tokens[:4]:
            if token and token in name:
                shared += 1
        if shared >= 2:
            return True
    # Important: avoid fuzzy "name overlap" matches here to prevent false positives.
    # If we cannot match by stable identifiers, position should be considered not found.
    return False


def _extract_wb_vendor_code(product: dict[str, Any]) -> str:
    if not isinstance(product, dict):
        return ""
    direct = _normalize_code(
        str(
            product.get("supplierVendorCode")
            or product.get("vendorCode")
            or product.get("suppliervendorcode")
            or product.get("vendor_code")
            or ""
        )
    )
    if direct:
        return direct
    nested = product.get("extended") if isinstance(product.get("extended"), dict) else {}
    ext_code = _normalize_code(str(nested.get("vendorCode") or nested.get("supplierVendorCode") or ""))
    if ext_code:
        return ext_code
    return ""


def _extract_wb_nm_id(product: dict[str, Any]) -> str:
    if not isinstance(product, dict):
        return ""
    return _normalize_code(str(product.get("id") or product.get("nm") or product.get("nmId") or product.get("nm_id") or ""))


def _codes_equal(left: str, right: str) -> bool:
    if not left or not right:
        return False
    if left == right:
        return True
    if left.isdigit() and right.isdigit():
        return int(left) == int(right)
    return False


def _normalize_position(value: int | None) -> int | None:
    if value is None:
        return None
    try:
        pos = int(value)
    except Exception:
        return None
    if pos <= 0:
        return None
    if pos > WB_POSITION_LIMIT:
        return WB_POSITION_OVERFLOW
    return pos


def _normalize_code(value: str) -> str:
    return "".join(ch for ch in value.lower().strip() if ch.isalnum())


def _topic_tokens(text: str) -> list[str]:
    stop = {
        "для",
        "под",
        "над",
        "или",
        "товар",
        "мм",
        "см",
        "м",
        "метр",
        "метров",
        "комплект",
    }
    out: list[str] = []
    for token in text.lower().replace("/", " ").replace("-", " ").split():
        t = "".join(ch for ch in token if ch.isalnum())
        if len(t) < 4 or t in stop:
            continue
        if t not in out:
            out.append(t)
    return out


def _is_relevant_competitor(name: str, desc: str, topic_tokens: list[str]) -> bool:
    if not topic_tokens:
        return True
    hay = f"{name} {desc}".lower()
    bad = ("кроссовк", "платье", "ботинк", "костюм", "рубашк", "купальник")
    if any(x in hay for x in bad):
        return False
    overlaps = 0
    for tok in topic_tokens[:5]:
        root = tok[:5]
        if root and root in hay:
            overlaps += 1
    return overlaps >= 1


def test_marketplace_credentials(marketplace: str, api_key: str) -> tuple[bool, str]:
    if not httpx:
        return False, "Не установлен пакет httpx. Выполните: pip install -r requirements.txt"
    try:
        if marketplace == "wb":
            products = _fetch_wb_products(api_key, [], False, limit=1)
            if products is not None:
                return True, "WB ключ валиден"
            return False, "WB ключ не прошел проверку"
        if marketplace == "ozon":
            products = _fetch_ozon_products(api_key, [], False, limit=1)
            if products is not None:
                return True, "Ozon ключ валиден"
            return False, "Ozon ключ не прошел проверку"
    except Exception as exc:
        return False, f"Ошибка проверки ключа: {exc}"
    return False, "Неизвестный маркетплейс"


def _fetch_wb_products(
    api_key: str,
    articles: list[str],
    import_all: bool,
    limit: int = 100,
    timeout_sec: float = 20.0,
) -> list[MarketplaceProduct] | None:
    if not httpx:
        return None
    endpoint = "https://content-api.wildberries.ru/content/v2/get/cards/list"
    headers = {"Authorization": api_key, "Content-Type": "application/json"}
    page_limit = max(1, min(int(limit or 100), 100))
    requested_articles = [str(x or "").strip() for x in articles or [] if str(x or "").strip()]
    article_search_mode = bool(requested_articles and not import_all)
    max_pages = 1000 if import_all else (3 if article_search_mode else 1)
    cards: list[dict[str, Any]] = []
    with httpx.Client(timeout=timeout_sec) as client:
        searches = requested_articles[:100] if article_search_mode else [""]
        for text_search in searches:
            cursor: dict[str, Any] = {}
            seen_cursor: set[str] = set()
            for _ in range(max_pages):
                filter_payload: dict[str, Any] = {"withPhoto": -1}
                if text_search:
                    filter_payload["textSearch"] = text_search
                payload: dict[str, Any] = {
                    "settings": {
                        "sort": {"ascending": True},
                        "cursor": {"limit": page_limit, **cursor},
                        "filter": filter_payload,
                    }
                }
                response = None
                for attempt in range(4):
                    try:
                        response = client.post(endpoint, headers=headers, json=payload)
                    except Exception:
                        response = None
                    if response is not None and response.status_code not in {429, 500, 502, 503, 504}:
                        break
                    time.sleep(0.8 + attempt * 0.9)
                if response is None:
                    if not cards:
                        return None
                    break
                if response.status_code >= 400:
                    if not cards:
                        return None
                    break
                data = response.json()
                chunk = data.get("cards") or data.get("data", {}).get("cards") or []
                if not isinstance(chunk, list) or not chunk:
                    break
                cards.extend([row for row in chunk if isinstance(row, dict)])
                if not import_all and not article_search_mode:
                    break
                cursor_node = data.get("cursor") or data.get("data", {}).get("cursor") or {}
                if not isinstance(cursor_node, dict):
                    break
                try:
                    total_int = int(cursor_node.get("total") or 0)
                except Exception:
                    total_int = 0
                if total_int > 0 and total_int < page_limit:
                    break
                if len(chunk) < page_limit:
                    break
                next_cursor: dict[str, Any] = {}
                for key in ("updatedAt", "nmID"):
                    value = cursor_node.get(key)
                    if value not in (None, ""):
                        next_cursor[key] = value
                marker = f"{next_cursor.get('updatedAt', '')}|{next_cursor.get('nmID', '')}"
                if not next_cursor or marker in seen_cursor:
                    break
                seen_cursor.add(marker)
                cursor = next_cursor
                if import_all:
                    time.sleep(0.15)

    mapped: list[MarketplaceProduct] = []
    seen_cards: set[tuple[str, str]] = set()
    for card in cards:
        article = str(card.get("vendorCode") or card.get("nmID") or "")
        if not article:
            continue
        external_id = str(card.get("nmID") or "")
        card_key = (article.strip().lower(), external_id.strip())
        if card_key in seen_cards:
            continue
        seen_cards.add(card_key)
        name = str(card.get("title") or card.get("object") or "Товар")
        description = str(card.get("description") or "")
        barcode = _extract_wb_barcode(card)
        photos = _extract_wb_photos(card)
        photo_url = photos[0] if photos else _extract_wb_photo(card)
        category_name = str(card.get("subjectName") or card.get("subject") or card.get("object") or "").strip()
        mapped.append(
            MarketplaceProduct(
                article=article,
                external_id=external_id,
                barcode=barcode,
                photo_url=photo_url,
                name=name,
                description=description,
                category_name=category_name,
                photos=photos,
                raw=card if isinstance(card, dict) else {},
            )
        )

    if articles:
        article_set = {str(x or "").strip().lower() for x in articles if str(x or "").strip()}
        mapped = [
            x
            for x in mapped
            if str(x.article or "").strip().lower() in article_set
            or str(x.external_id or "").strip().lower() in article_set
        ]
    if not import_all:
        mapped = mapped[: min(30, len(mapped))]
    return mapped


def _extract_ozon_info_items(data: Any) -> list[dict[str, Any]]:
    if not isinstance(data, dict):
        return []
    direct = data.get("items")
    if isinstance(direct, list):
        return [row for row in direct if isinstance(row, dict)]
    result = data.get("result")
    if isinstance(result, list):
        return [row for row in result if isinstance(row, dict)]
    if isinstance(result, dict):
        items = result.get("items")
        if isinstance(items, list):
            return [row for row in items if isinstance(row, dict)]
    return []


def _to_int_or_zero(value: Any) -> int:
    try:
        return int(value or 0)
    except Exception:
        return 0


def _fetch_ozon_category_lookup(client: Any, headers: dict[str, str]) -> dict[tuple[int, int], str]:
    cache_key = str(headers.get("Client-Id") or "default")
    now = time.time()
    cached = _OZON_CATEGORY_TREE_CACHE.get(cache_key)
    if cached and now - cached[0] < _OZON_CATEGORY_TREE_TTL_SEC:
        return cached[1]

    lookup: dict[tuple[int, int], str] = {}
    try:
        resp = client.post(
            "https://api-seller.ozon.ru/v1/description-category/tree",
            headers=headers,
            json={"language": "RU"},
        )
        if resp.status_code >= 400:
            return {}
        data = resp.json()
    except Exception:
        return {}

    roots = data.get("result") if isinstance(data, dict) else []
    if isinstance(roots, dict):
        roots = roots.get("categories") or roots.get("children") or []

    def walk(nodes: Any, parent_category: str = "", parent_desc_id: int = 0) -> None:
        if not isinstance(nodes, list):
            return
        for node in nodes:
            if not isinstance(node, dict):
                continue
            category = str(node.get("category_name") or parent_category or "").strip()
            desc_id = _to_int_or_zero(node.get("description_category_id")) or parent_desc_id
            type_id = _to_int_or_zero(node.get("type_id"))
            type_name = str(node.get("type_name") or "").strip()
            if desc_id and category:
                lookup.setdefault((desc_id, 0), category)
            if desc_id and type_id:
                lookup[(desc_id, type_id)] = type_name or category
            walk(node.get("children") or [], category, desc_id)

    walk(roots)
    if lookup:
        _OZON_CATEGORY_TREE_CACHE[cache_key] = (now, lookup)
    return lookup


def _fetch_ozon_products(api_key: str, articles: list[str], import_all: bool, limit: int = 1000) -> list[MarketplaceProduct] | None:
    if not httpx:
        return None
    creds = _parse_ozon_credentials(api_key)
    if not creds:
        return None
    client_id, token = creds

    headers = {
        "Client-Id": client_id,
        "Api-Key": token,
        "Content-Type": "application/json",
    }
    list_endpoint = "https://api-seller.ozon.ru/v3/product/list"
    info_endpoint = "https://api-seller.ozon.ru/v3/product/info/list"
    list_limit = max(1, min(int(limit or 1000), 1000))
    max_pages = 1000 if import_all else 1
    product_ids: list[int] = []
    last_id = ""
    info_items: list[dict[str, Any]] = []
    category_lookup: dict[tuple[int, int], str] = {}
    requested_articles = [str(x or "").strip() for x in articles or [] if str(x or "").strip()]
    with httpx.Client(timeout=25.0) as client:
        if requested_articles and not import_all:
            for idx in range(0, len(requested_articles), 1000):
                chunk = requested_articles[idx : idx + 1000]
                product_chunk = [int(x) for x in chunk if str(x).isdigit()]
                info_resp = client.post(
                    info_endpoint,
                    headers=headers,
                    json={"offer_id": chunk, "product_id": product_chunk, "sku": []},
                )
                if info_resp.status_code >= 400:
                    continue
                info_items.extend(_extract_ozon_info_items(info_resp.json()))
        for _ in range(max_pages):
            list_resp = client.post(
                list_endpoint,
                headers=headers,
                json={"filter": {"visibility": "ALL"}, "last_id": last_id, "limit": list_limit},
            )
            if list_resp.status_code >= 400:
                if not product_ids:
                    return None
                break
            list_data = list_resp.json().get("result", {})
            items = list_data.get("items", [])
            if not isinstance(items, list) or not items:
                break
            for item in items:
                pid = item.get("product_id") if isinstance(item, dict) else None
                if pid:
                    try:
                        product_ids.append(int(pid))
                    except Exception:
                        continue
            if not import_all:
                break
            next_last_id = str(list_data.get("last_id") or "").strip()
            if not next_last_id or next_last_id == last_id:
                break
            last_id = next_last_id

        unique_ids: list[int] = []
        seen_ids: set[int] = set()
        for pid in product_ids:
            if pid in seen_ids:
                continue
            seen_ids.add(pid)
            unique_ids.append(pid)
        product_ids = unique_ids
        if not product_ids and not info_items:
            return []

        info_items = list(info_items)
        for idx in range(0, len(product_ids), 1000):
            chunk = product_ids[idx: idx + 1000]
            info_resp = client.post(info_endpoint, headers=headers, json={"product_id": chunk})
            if info_resp.status_code >= 400:
                if not info_items and idx == 0:
                    return None
                continue
            info_items.extend(_extract_ozon_info_items(info_resp.json()))
        if info_items:
            needs_category_lookup = any(
                isinstance(row, dict)
                and (
                    _to_int_or_zero(row.get("description_category_id") or row.get("category_id"))
                    or _to_int_or_zero(row.get("type_id"))
                    or (
                        isinstance(row.get("product_info"), dict)
                        and (
                            _to_int_or_zero(row["product_info"].get("description_category_id") or row["product_info"].get("category_id"))
                            or _to_int_or_zero(row["product_info"].get("type_id"))
                        )
                    )
                )
                for row in info_items
            )
            if needs_category_lookup:
                category_lookup = _fetch_ozon_category_lookup(client, headers)

    deduped_info_items: list[dict[str, Any]] = []
    seen_info_items: set[tuple[str, str]] = set()
    for item in info_items:
        item_map = item if isinstance(item, dict) else {}
        source = item_map.get("product_info") if isinstance(item_map.get("product_info"), dict) else {}
        offer = str(item_map.get("offer_id") or source.get("offer_id") or "").strip().lower()
        product_id = str(
            item_map.get("product_id")
            or item_map.get("id")
            or source.get("product_id")
            or source.get("id")
            or ""
        ).strip()
        info_key = (offer, product_id)
        if info_key in seen_info_items:
            continue
        seen_info_items.add(info_key)
        deduped_info_items.append(item_map)
    info_items = deduped_info_items

    mapped: list[MarketplaceProduct] = []
    for item in info_items:
        source_raw = item.get("product_info") if isinstance(item, dict) and isinstance(item.get("product_info"), dict) else {}
        source = source_raw if isinstance(source_raw, dict) else {}
        item_map = item if isinstance(item, dict) else {}
        merged_source: dict[str, Any] = {}
        if item_map:
            merged_source.update(item_map)
        if source:
            merged_source.update(source)
        article = str(merged_source.get("offer_id") or merged_source.get("id") or merged_source.get("product_id") or "")
        if not article:
            continue
        name = str(merged_source.get("name") or "Товар Ozon")
        description = str(merged_source.get("description") or merged_source.get("marketing_description") or "")
        barcode = _extract_ozon_barcode(merged_source)
        photos = _dedupe_photo_urls(_extract_ozon_photos(merged_source) + _extract_ozon_photos(item_map))
        photo_url = photos[0] if photos else _extract_ozon_photo(merged_source)
        category_name = _extract_ozon_category_name(merged_source, category_lookup) or _extract_ozon_category_name(item_map, category_lookup)
        mapped.append(
            MarketplaceProduct(
                article=article,
                external_id=str(merged_source.get("id") or merged_source.get("product_id") or ""),
                barcode=barcode,
                photo_url=photo_url,
                name=name,
                description=description,
                category_name=category_name,
                photos=photos,
                raw=item if isinstance(item, dict) else {},
            )
        )

    if articles:
        article_set = {str(x or "").strip().lower() for x in articles if str(x or "").strip()}
        mapped = [
            x
            for x in mapped
            if str(x.article or "").strip().lower() in article_set
            or str(x.external_id or "").strip().lower() in article_set
        ]
    if not import_all:
        mapped = mapped[: min(30, len(mapped))]
    return mapped


def fetch_marketplace_product_details(marketplace: str, api_key: str, article: str, external_id: str = "") -> dict[str, Any]:
    safe_market = str(marketplace or "").strip().lower()
    if safe_market == "wb":
        return _fetch_wb_product_details(api_key=api_key, article=article, external_id=external_id)
    if safe_market == "ozon":
        return _fetch_ozon_product_details(api_key=api_key, article=article, external_id=external_id)
    return {"photos": [], "attributes": {}, "raw": {}}


def _fetch_wb_product_details(api_key: str, article: str, external_id: str = "") -> dict[str, Any]:
    lookup_values = [x for x in [article, external_id] if str(x or "").strip()]
    products = _fetch_wb_products(api_key, lookup_values, False, limit=100, timeout_sec=8.0) or []
    norm_article = _normalize_code(article)
    norm_external = _normalize_code(external_id)
    best: MarketplaceProduct | dict[str, Any] | None = None
    for row in products:
        if isinstance(row, MarketplaceProduct):
            vendor = _normalize_code(str(row.article or ""))
            nm_id = _normalize_code(str(row.external_id or ""))
        else:
            vendor = _extract_wb_vendor_code(row)
            nm_id = _extract_wb_nm_id(row)
        if norm_external and nm_id and _codes_equal(norm_external, nm_id):
            best = row
            break
        if norm_article and vendor and _codes_equal(norm_article, vendor):
            best = row
            break
    if best is None:
        for row in products:
            if isinstance(row, MarketplaceProduct):
                name = _normalize_code(str(row.name or ""))
            else:
                name = _normalize_code(str(row.get("name") or row.get("title") or ""))
            if norm_article and norm_article in name:
                best = row
                break
    if best is None and products:
        best = products[0]
    if not best:
        return {"photos": [], "attributes": {}, "raw": {}}

    if isinstance(best, MarketplaceProduct):
        photos_raw: list[str] = []
        for raw in best.photos or []:
            normalized = _normalize_photo_url(raw)
            if normalized:
                photos_raw.append(normalized)
        photos = [x for x in dict.fromkeys(photos_raw)]
        if not photos:
            fallback = _normalize_photo_url(best.photo_url)
            if fallback:
                photos = [fallback]
        attrs: dict[str, Any] = {
            "category_name": str(best.category_name or "").strip(),
            "vendor_code": str(best.article or "").strip(),
            "nm_id": str(best.external_id or "").strip(),
            "name": str(best.name or "").strip(),
        }
        raw_source = best.raw if isinstance(best.raw, dict) else {}
        raw = {
            "vendorCode": str(best.article or "").strip(),
            "id": str(best.external_id or "").strip(),
            "name": str(best.name or "").strip(),
            "subjectName": str(best.category_name or "").strip(),
            "photos": photos,
        }
        if raw_source:
            merged = dict(raw_source)
            for key, value in raw.items():
                if key not in merged or merged.get(key) in (None, "", [], {}):
                    merged[key] = value
            raw = merged
        return {"photos": photos, "attributes": attrs, "raw": raw}

    def _collect_photo_urls(value: Any) -> list[str]:
        out: list[str] = []
        if isinstance(value, str):
            url = _normalize_photo_url(value)
            if url:
                out.append(url)
        elif isinstance(value, dict):
            for key in ("big", "c516x688", "tm", "x1", "x2", "url"):
                if key in value and value[key]:
                    out.extend(_collect_photo_urls(value[key]))
        elif isinstance(value, list):
            for item in value:
                out.extend(_collect_photo_urls(item))
        return out

    photos: list[str] = []
    photos.extend(_collect_photo_urls(best.get("photos") or []))
    if not photos:
        for fallback_key in ("mediaFiles", "photoLinks", "images", "pics", "img"):
            photos.extend(_collect_photo_urls(best.get(fallback_key)))
    photos = [x for x in dict.fromkeys([p for p in photos if p])]
    attrs: dict[str, Any] = {
        "category_name": str(best.get("subjectName") or best.get("subject") or "").strip(),
        "brand": str(best.get("brand") or "").strip(),
        "vendor_code": str(best.get("supplierVendorCode") or best.get("vendorCode") or "").strip(),
        "nm_id": str(best.get("id") or "").strip(),
        "name": str(best.get("name") or "").strip(),
    }
    return {"photos": photos, "attributes": attrs, "raw": best}


def _fetch_ozon_product_details(api_key: str, article: str, external_id: str = "") -> dict[str, Any]:
    if not httpx:
        return {"photos": [], "attributes": {}, "raw": {}}
    creds = _parse_ozon_credentials(api_key)
    if not creds:
        return {"photos": [], "attributes": {}, "raw": {}}
    client_id, token = creds
    headers = {
        "Client-Id": client_id,
        "Api-Key": token,
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {"offer_id": [], "product_id": [], "sku": []}
    if article:
        payload["offer_id"] = [str(article).strip()]
    if str(external_id or "").isdigit():
        payload["product_id"] = [int(str(external_id))]
    if not payload["offer_id"] and not payload["product_id"]:
        return {"photos": [], "attributes": {}, "raw": {}}
    endpoint = "https://api-seller.ozon.ru/v3/product/info/list"
    price_info: dict[str, Any] = {}
    category_lookup: dict[tuple[int, int], str] = {}
    try:
        with httpx.Client(timeout=25.0) as client:
            resp = client.post(endpoint, headers=headers, json=payload)
            if resp.status_code >= 400:
                return {"photos": [], "attributes": {}, "raw": {}}
            data = resp.json()
            category_lookup = _fetch_ozon_category_lookup(client, headers)
    except Exception:
        return {"photos": [], "attributes": {}, "raw": {}}
    items = _extract_ozon_info_items(data)
    if not items:
        return {"photos": [], "attributes": {}, "raw": {}}
    item = items[0] if isinstance(items, list) else {}
    if isinstance(items, list) and len(items) > 1:
        target_offer = str(article or "").strip()
        target_offer_low = target_offer.lower()
        target_external = str(external_id or "").strip()
        best_item: dict[str, Any] | None = None
        best_score = -1
        for candidate in items:
            if not isinstance(candidate, dict):
                continue
            candidate_info = candidate.get("product_info") if isinstance(candidate.get("product_info"), dict) else {}
            nodes: list[dict[str, Any]] = [candidate]
            if isinstance(candidate_info, dict):
                nodes.append(candidate_info)
            offers: list[str] = []
            product_ids: list[str] = []
            for node in nodes:
                if not isinstance(node, dict):
                    continue
                for key in ("offer_id", "offerId", "vendor_code", "vendorCode"):
                    value = str(node.get(key) or "").strip()
                    if value:
                        offers.append(value)
                for key in ("id", "product_id", "productId"):
                    value = str(node.get(key) or "").strip()
                    if value:
                        product_ids.append(value)
            score = 0
            if target_external:
                if any(pid == target_external for pid in product_ids):
                    score = max(score, 120)
                elif target_external.isdigit():
                    try:
                        target_external_num = int(target_external)
                    except Exception:
                        target_external_num = 0
                    if target_external_num > 0:
                        for pid in product_ids:
                            if pid.isdigit() and int(pid) == target_external_num:
                                score = max(score, 115)
                                break
            if target_offer:
                if any(offer == target_offer for offer in offers):
                    score = max(score, 100)
                elif target_offer_low and any(offer.lower() == target_offer_low for offer in offers):
                    score = max(score, 95)
                if target_offer.isdigit():
                    try:
                        offer_num = int(target_offer)
                    except Exception:
                        offer_num = 0
                    if offer_num > 0:
                        for pid in product_ids:
                            if pid.isdigit() and int(pid) == offer_num:
                                score = max(score, 90)
                                break
            if score > best_score:
                best_score = score
                best_item = candidate
                if score >= 120:
                    break
        if best_item is not None and best_score > 0:
            item = best_item
    item_map = item if isinstance(item, dict) else {}
    source_raw = item_map.get("product_info") if isinstance(item_map.get("product_info"), dict) else {}
    source = source_raw if isinstance(source_raw, dict) else {}
    merged_source: dict[str, Any] = {}
    if item_map:
        merged_source.update(item_map)
    if source:
        merged_source.update(source)
    if not merged_source:
        merged_source = source or item_map
    try:
        with httpx.Client(timeout=25.0) as client:
            price_info = _fetch_ozon_price_snapshot(
                client=client,
                headers=headers,
                source=[item_map] if isinstance(item_map, dict) else [],
                article=article,
                external_id=external_id,
            )
    except Exception:
        price_info = {}

    def _collect_photo_urls(value: Any) -> list[str]:
        out: list[str] = []
        if isinstance(value, str):
            url = _normalize_photo_url(value)
            if url:
                out.append(url)
        elif isinstance(value, dict):
            for key in ("url", "image", "x1", "x2", "src", "link", "href", "path", "big", "orig", "preview", "photo"):
                if key in value and value[key]:
                    out.extend(_collect_photo_urls(value[key]))
            for key, nested in value.items():
                key_text = str(key or "").strip().lower()
                if re.search(r"(photo|image|picture|media|preview)", key_text):
                    out.extend(_collect_photo_urls(nested))
        elif isinstance(value, list):
            for item in value:
                out.extend(_collect_photo_urls(item))
        return out

    photos: list[str] = []
    for container in (merged_source, source, item_map):
        if not isinstance(container, dict):
            continue
        photos.extend(_extract_ozon_photos(container))
        for key in ("primary_image", "images", "images360", "images_stream", "photo_urls", "photos", "image_urls"):
            photos.extend(_collect_photo_urls(container.get(key)))
    photos = _dedupe_photo_urls(photos)

    def _to_amount(value: Any) -> float:
        text = str(value or "").replace("\u00a0", " ").strip()
        if not text:
            return 0.0
        compact = re.sub(r"[^0-9,.\-]", "", text)
        if not compact:
            return 0.0
        if "," in compact and "." in compact:
            if compact.rfind(",") > compact.rfind("."):
                compact = compact.replace(".", "").replace(",", ".")
            else:
                compact = compact.replace(",", "")
        else:
            compact = compact.replace(",", ".")
        try:
            value_num = float(compact)
        except Exception:
            return 0.0
        if not (value_num == value_num):  # NaN guard
            return 0.0
        return value_num

    def _pick_first_by_keys(nodes: list[Any], keys: set[str]) -> str:
        wanted = {str(key or "").strip().lower() for key in keys if str(key or "").strip()}
        if not wanted:
            return ""
        queue: list[Any] = list(nodes)
        seen_ids: set[int] = set()
        fallback = ""
        while queue:
            node = queue.pop(0)
            if node is None:
                continue
            if isinstance(node, (dict, list)):
                node_id = id(node)
                if node_id in seen_ids:
                    continue
                seen_ids.add(node_id)
            if isinstance(node, dict):
                for raw_key, value in node.items():
                    key = str(raw_key or "").strip().lower()
                    if key in wanted and not isinstance(value, (dict, list)):
                        text = str(value or "").strip()
                        if text and not fallback:
                            fallback = text
                        if text and _to_amount(text) > 0:
                            return text
                    if isinstance(value, (dict, list)):
                        queue.append(value)
            elif isinstance(node, list):
                for value in node[:200]:
                    if isinstance(value, (dict, list)):
                        queue.append(value)
                    else:
                        text = str(value or "").strip()
                        if text and not fallback:
                            fallback = text
        return fallback

    attrs: dict[str, Any] = {
        "category_name": _extract_ozon_category_name(merged_source, category_lookup) or _extract_ozon_category_name(item_map, category_lookup),
        "name": str(merged_source.get("name") or "").strip(),
        "offer_id": str(merged_source.get("offer_id") or "").strip(),
        "product_id": str(merged_source.get("id") or merged_source.get("product_id") or "").strip(),
        "barcode": _extract_ozon_barcode(merged_source),
        "brand": str(merged_source.get("brand") or "").strip(),
        "description": str(merged_source.get("description") or merged_source.get("marketing_description") or "").strip(),
    }
    price_sources = [price_info, merged_source, source, item_map]
    price_value = _pick_first_by_keys(
        price_sources,
        {"price", "sale_price", "discount_price", "discounted_price", "price_with_discount", "final_price", "current_price"},
    )
    old_price_value = _pick_first_by_keys(
        price_sources,
        {"old_price", "base_price", "list_price", "price_without_discount", "before_discount_price", "original_price"},
    )
    min_price_value = _pick_first_by_keys(
        price_sources,
        {"min_price", "minimum_price", "min_ozon_price", "price_min", "auto_action_min_price"},
    )
    marketing_price_value = _pick_first_by_keys(
        price_sources,
        {"marketing_price", "promo_price", "promotion_price", "action_price", "campaign_price", "recommended_price", "premium_price"},
    )
    currency_code_value = _pick_first_by_keys(price_sources, {"currency_code", "currency", "currency_id"})
    vat_value = _pick_first_by_keys(price_sources, {"vat", "vat_rate", "nds"})
    if price_value:
        attrs["price"] = price_value
        attrs["price_with_discount"] = price_value
    if old_price_value:
        attrs["old_price"] = old_price_value
        attrs["price_without_discount"] = old_price_value
    if min_price_value:
        attrs["min_price"] = min_price_value
        attrs["price_min"] = min_price_value
    if marketing_price_value:
        attrs["marketing_price"] = marketing_price_value
        attrs["promo_price"] = marketing_price_value
    if currency_code_value:
        attrs["currency_code"] = currency_code_value
    if vat_value:
        attrs["vat"] = vat_value

    attrs_source = merged_source.get("attributes")
    if not isinstance(attrs_source, list):
        attrs_source = source.get("attributes") if isinstance(source.get("attributes"), list) else []
    for attr in (attrs_source or []):
        if not isinstance(attr, dict):
            continue
        title = str(attr.get("name") or attr.get("attribute_name") or attr.get("id") or "").strip()
        if not title:
            continue
        values = attr.get("values") or []
        normalized_values: list[str] = []
        if isinstance(values, list):
            for val in values:
                if isinstance(val, dict):
                    raw_val = val.get("value") or val.get("text_value") or val.get("dictionary_value")
                    if isinstance(raw_val, dict):
                        raw_val = raw_val.get("value") or raw_val.get("name")
                    txt = str(raw_val or "").strip()
                else:
                    txt = str(val or "").strip()
                if txt:
                    normalized_values.append(txt)
        attrs[title] = ", ".join(normalized_values) if normalized_values else str(attr.get("value") or "").strip()
    attrs = {str(k): str(v) for k, v in attrs.items() if str(v or "").strip()}
    raw_out = dict(item_map) if isinstance(item_map, dict) else {}
    if source:
        raw_out["product_info"] = source
    if merged_source:
        raw_out["merged_source"] = merged_source
    if price_info:
        raw_out["price_info"] = price_info
    return {"photos": photos, "attributes": attrs, "raw": raw_out}


def _fetch_ozon_price_snapshot(
    *,
    client: Any,
    headers: dict[str, str],
    source: Any,
    article: str = "",
    external_id: str = "",
) -> dict[str, Any]:
    product_id = 0
    offer_id = str(article or "").strip()
    external_text = str(external_id or "").strip()
    if external_text.isdigit():
        try:
            product_id = int(external_text)
        except Exception:
            product_id = 0
    if isinstance(source, list) and source:
        first = source[0] if isinstance(source[0], dict) else {}
        info = first.get("product_info") if isinstance(first, dict) and isinstance(first.get("product_info"), dict) else first
        info_map = info if isinstance(info, dict) else {}
        first_map = first if isinstance(first, dict) else {}
        offer_id = str(
            info_map.get("offer_id")
            or first_map.get("offer_id")
            or first_map.get("offerId")
            or offer_id
        ).strip()
        if not product_id:
            pid_value = (
                info_map.get("id")
                or info_map.get("product_id")
                or first_map.get("id")
                or first_map.get("product_id")
                or first_map.get("productId")
                or "0"
            )
            try:
                product_id = int(str(pid_value).strip() or 0)
            except Exception:
                product_id = 0
    if not product_id and not offer_id:
        return {}

    endpoints = [
        "https://api-seller.ozon.ru/v5/product/info/prices",
        "https://api-seller.ozon.ru/v4/product/info/prices",
    ]
    payload_variants: list[dict[str, Any]] = [
        {
            "filter": {
                "offer_id": [offer_id] if offer_id else [],
                "product_id": [product_id] if product_id > 0 else [],
                "visibility": "ALL",
            },
            "limit": 100,
            "last_id": "",
        },
        {
            "offer_id": [offer_id] if offer_id else [],
            "product_id": [product_id] if product_id > 0 else [],
        },
        {
            "product_id": [product_id] if product_id > 0 else [],
        },
        {
            "offer_id": [offer_id] if offer_id else [],
        },
    ]

    for endpoint in endpoints:
        for payload in payload_variants:
            if not any(payload.values()):
                continue
            try:
                response = client.post(endpoint, headers=headers, json=payload)
                if response.status_code >= 400:
                    continue
                data = response.json()
            except Exception:
                continue
            items: list[dict[str, Any]] = []
            if isinstance(data, dict):
                result = data.get("result")
                if isinstance(result, dict) and isinstance(result.get("items"), list):
                    items = [x for x in result.get("items") if isinstance(x, dict)]
                elif isinstance(data.get("items"), list):
                    items = [x for x in data.get("items") if isinstance(x, dict)]
                elif isinstance(result, list):
                    items = [x for x in result if isinstance(x, dict)]
            if not items:
                continue
            if product_id > 0:
                for row in items:
                    row_pid = str(row.get("product_id") or row.get("id") or "").strip()
                    if row_pid.isdigit() and int(row_pid) == product_id:
                        return row
            if offer_id:
                offer_id_low = offer_id.lower()
                for row in items:
                    row_offer = str(row.get("offer_id") or row.get("offerId") or "").strip()
                    if row_offer and (row_offer == offer_id or row_offer.lower() == offer_id_low):
                        return row
            return items[0]
    return {}


def enrich_ozon_category_names(api_key: str, refs: list[dict[str, str]]) -> dict[tuple[str, str], str]:
    """
    Возвращает категории Ozon для пар (article, external_id).
    Ключ результата: (article_lower, external_id_raw)
    """
    if not httpx:
        return {}
    creds = _parse_ozon_credentials(api_key)
    if not creds:
        return {}
    client_id, token = creds
    normalized_refs: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    offer_ids: list[str] = []
    product_ids: list[int] = []
    for raw in refs or []:
        if not isinstance(raw, dict):
            continue
        article = str(raw.get("article") or "").strip()
        external = str(raw.get("external_id") or "").strip()
        key = (article.lower(), external)
        if key in seen:
            continue
        seen.add(key)
        normalized_refs.append(key)
        if article:
            offer_ids.append(article)
        if external.isdigit():
            product_ids.append(int(external))
    if not normalized_refs:
        return {}
    headers = {
        "Client-Id": client_id,
        "Api-Key": token,
        "Content-Type": "application/json",
    }
    endpoint = "https://api-seller.ozon.ru/v3/product/info/list"
    by_offer: dict[str, str] = {}
    by_product_id: dict[str, str] = {}
    offer_ids = list(dict.fromkeys(offer_ids))
    product_ids = list(dict.fromkeys(product_ids))

    def _chunks(items: list[Any], size: int = 200) -> list[list[Any]]:
        if not items:
            return []
        return [items[i : i + size] for i in range(0, len(items), size)]

    try:
        with httpx.Client(timeout=25.0) as client:
            category_lookup = _fetch_ozon_category_lookup(client, headers)
            chunks_offers = _chunks(offer_ids, 200) or [[]]
            chunks_products = _chunks(product_ids, 200) or [[]]
            total = max(len(chunks_offers), len(chunks_products))
            for idx in range(total):
                payload: dict[str, Any] = {
                    "offer_id": chunks_offers[idx] if idx < len(chunks_offers) else [],
                    "product_id": chunks_products[idx] if idx < len(chunks_products) else [],
                    "sku": [],
                }
                if not payload["offer_id"] and not payload["product_id"]:
                    continue
                resp = client.post(endpoint, headers=headers, json=payload)
                if resp.status_code >= 400:
                    continue
                data = resp.json()
                items = _extract_ozon_info_items(data)
                for item in items:
                    source = item.get("product_info") or item
                    category_name = _extract_ozon_category_name(source, category_lookup)
                    if not category_name:
                        category_name = _extract_ozon_category_name(item, category_lookup)
                    if not category_name:
                        continue
                    offer = str(
                        source.get("offer_id")
                        or item.get("offer_id")
                        or ""
                    ).strip().lower()
                    product_id = str(
                        source.get("id")
                        or source.get("product_id")
                        or item.get("product_id")
                        or item.get("id")
                        or ""
                    ).strip()
                    if offer and offer not in by_offer:
                        by_offer[offer] = category_name
                    if product_id and product_id not in by_product_id:
                        by_product_id[product_id] = category_name
    except Exception:
        return {}

    mapped: dict[tuple[str, str], str] = {}
    for article_key, external in normalized_refs:
        category_name = by_offer.get(article_key) or by_product_id.get(external) or ""
        if category_name:
            mapped[(article_key, external)] = category_name
    return mapped


def _update_wb_description(api_key: str, article: str, description: str, external_id: str = "") -> bool:
    if not httpx:
        return False
    token = str(api_key or "").strip()
    vendor_code = str(article or "").strip()
    if not token or not vendor_code:
        return False
    nm_id = 0
    try:
        nm_id = int(str(external_id or "").strip())
    except Exception:
        nm_id = 0
    card_base: dict[str, Any] = {"vendorCode": vendor_code}
    if nm_id > 0:
        card_base["nmID"] = nm_id
        card_base["nmId"] = nm_id
    payloads = [
        {"cards": [{**card_base, "description": str(description or "")[:5000]}]},
    ]
    endpoints = [
        "https://content-api.wildberries.ru/content/v2/cards/update",
        "https://suppliers-api.wildberries.ru/content/v2/cards/update",
    ]
    auth_variants = [token, f"Bearer {token}"]
    with httpx.Client(timeout=25.0, follow_redirects=True) as client:
        for auth_value in auth_variants:
            headers = {"Authorization": auth_value, "Content-Type": "application/json"}
            for endpoint in endpoints:
                for payload in payloads:
                    try:
                        response = client.post(endpoint, headers=headers, json=payload)
                    except Exception:
                        continue
                    if _marketplace_response_ok(response):
                        return True
                    if response.status_code in {401, 403}:
                        break
    return False


def _update_ozon_description(api_key: str, article: str, description: str) -> bool:
    if not httpx:
        return False
    creds = _parse_ozon_credentials(api_key)
    if not creds:
        return False
    client_id, token = creds
    endpoint = "https://api-seller.ozon.ru/v1/product/update/attributes"
    headers = {
        "Client-Id": client_id,
        "Api-Key": token,
        "Content-Type": "application/json",
    }
    # Для реального обновления Ozon нужен корректный список attributes по category.
    # В MVP отправляем минимальный payload; если маркетплейс отклонит, вернется False.
    payload = {
        "items": [
            {
                "offer_id": article,
                "attributes": [{"id": 4191, "values": [{"value": description}]}],
            }
        ]
    }
    with httpx.Client(timeout=20.0) as client:
        response = client.post(endpoint, headers=headers, json=payload)
    return response.status_code < 400


def _update_wb_photos_order(api_key: str, article: str, external_id: str, photos: list[str]) -> bool:
    token = str(api_key or "").strip()
    vendor_code = str(article or "").strip()
    normalized_photos = _dedupe_photo_urls([_normalize_photo_url(str(x or "")) for x in (photos or [])])[:30]
    if not token or not vendor_code or not normalized_photos:
        return False
    photo_variants: list[list[str]] = [normalized_photos]
    http_fallback = _dedupe_photo_urls(
        [
            (f"http://{url[8:]}" if str(url or "").startswith("https://") else str(url or ""))
            for url in normalized_photos
        ]
    )[:30]
    if http_fallback and http_fallback != normalized_photos:
        photo_variants.append(http_fallback)
    auth_variants = [token, f"Bearer {token}"]
    nm_id = 0
    try:
        nm_id = int(str(external_id or "").strip())
    except Exception:
        nm_id = 0
    if nm_id <= 0:
        try:
            resolved = int(str(resolve_wb_external_id(token, vendor_code) or "0").strip())
            if resolved > 0:
                nm_id = resolved
        except Exception:
            nm_id = 0

    media_endpoints = [
        "https://content-api.wildberries.ru/content/v3/media/save",
        "https://suppliers-api.wildberries.ru/content/v3/media/save",
    ]

    with httpx.Client(timeout=25.0, follow_redirects=True) as client:
        for photo_pack in photo_variants:
            media_payloads: list[dict[str, Any]] = []
            if nm_id > 0:
                media_payloads.append({"nmId": nm_id, "data": photo_pack})
                media_payloads.append({"nmID": nm_id, "data": photo_pack})
            if media_payloads:
                for auth_value in auth_variants:
                    headers = {"Authorization": auth_value, "Content-Type": "application/json"}
                    for endpoint in media_endpoints:
                        for payload in media_payloads:
                            try:
                                response = client.post(endpoint, headers=headers, json=payload)
                            except Exception:
                                continue
                            if _marketplace_response_ok(response):
                                return True
                            if response.status_code in {401, 403}:
                                break

    endpoints = [
        "https://content-api.wildberries.ru/content/v2/cards/update",
        "https://suppliers-api.wildberries.ru/content/v2/cards/update",
    ]
    with httpx.Client(timeout=25.0, follow_redirects=True) as client:
        for photo_pack in photo_variants:
            payloads: list[dict[str, Any]] = []
            card_base: dict[str, Any] = {"vendorCode": vendor_code}
            if nm_id > 0:
                card_base["nmID"] = nm_id
                card_base["nmId"] = nm_id
            payloads.append({"cards": [{**card_base, "mediaFiles": photo_pack}]})
            payloads.append({"cards": [{**card_base, "photos": photo_pack}]})
            payloads.append({"cards": [{**card_base, "photos": [{"big": url} for url in photo_pack]}]})
            for auth_value in auth_variants:
                headers = {"Authorization": auth_value, "Content-Type": "application/json"}
                for endpoint in endpoints:
                    for payload in payloads:
                        try:
                            response = client.post(endpoint, headers=headers, json=payload)
                        except Exception:
                            continue
                        if _marketplace_response_ok(response):
                            return True
                        if response.status_code in {401, 403}:
                            break
    return False


def _update_ozon_photos_order(api_key: str, article: str, external_id: str, photos: list[str]) -> bool:
    creds = _parse_ozon_credentials(api_key)
    offer_id = str(article or "").strip()
    if not creds or not offer_id or not photos:
        return False
    client_id, token = creds
    headers = {
        "Client-Id": client_id,
        "Api-Key": token,
        "Content-Type": "application/json",
    }
    product_id = 0
    try:
        product_id = int(str(external_id or "").strip())
    except Exception:
        product_id = 0
    payloads: list[dict[str, Any]] = []
    items_base: dict[str, Any] = {"offer_id": offer_id, "images": photos}
    if product_id > 0:
        items_base["product_id"] = product_id
    payloads.append({"items": [items_base]})
    payloads.append({"items": [{**items_base, "primary_image": photos[0]}]})
    endpoints = [
        "https://api-seller.ozon.ru/v2/product/import",
        "https://api-seller.ozon.ru/v3/product/import",
    ]
    with httpx.Client(timeout=25.0, follow_redirects=True) as client:
        for endpoint in endpoints:
            for payload in payloads:
                try:
                    response = client.post(endpoint, headers=headers, json=payload)
                except Exception:
                    continue
                if _marketplace_response_ok(response):
                    return True
                if response.status_code in {401, 403}:
                    return False
    return False


def _marketplace_response_ok(response: httpx.Response) -> bool:
    if response.status_code >= 400:
        return False
    try:
        payload = response.json()
    except Exception:
        return True
    if isinstance(payload, dict):
        has_error_field = (
            payload.get("error")
            or payload.get("errors")
            or payload.get("errorText")
            or payload.get("error_message")
        )
        if has_error_field:
            return False
        result = payload.get("result")
        if isinstance(result, dict):
            if result.get("error") or result.get("errors"):
                return False
    return True


def _extract_wb_barcode(card: dict[str, Any]) -> str:
    sizes = card.get("sizes") or []
    for size in sizes:
        skus = size.get("skus") or []
        if skus:
            return str(skus[0])
    return ""


def _extract_wb_photo(card: dict[str, Any]) -> str:
    photos = _extract_wb_photos(card)
    if photos:
        return photos[0]
    return ""


def _extract_wb_photos(card: dict[str, Any]) -> list[str]:
    photos_raw = card.get("photos") or []
    out: list[str] = []

    def _pick_best(value: Any) -> str:
        if isinstance(value, str):
            return _normalize_photo_url(value)
        if isinstance(value, dict):
            for key in ("big", "orig", "x2", "c516x688", "c246x328", "x1", "tm", "small", "url"):
                picked = _pick_best(value.get(key))
                if picked:
                    return picked
            for nested in value.values():
                picked = _pick_best(nested)
                if picked:
                    return picked
            return ""
        if isinstance(value, list):
            for item in value:
                picked = _pick_best(item)
                if picked:
                    return picked
        return ""

    if isinstance(photos_raw, list):
        for item in photos_raw:
            picked = _pick_best(item)
            if picked:
                out.append(picked)
    else:
        picked = _pick_best(photos_raw)
        if picked:
            out.append(picked)
    return _dedupe_photo_urls(out)


def _extract_ozon_barcode(source: dict[str, Any]) -> str:
    barcode = source.get("barcode")
    if isinstance(barcode, str):
        return barcode
    if isinstance(barcode, list) and barcode:
        return str(barcode[0])
    barcodes = source.get("barcodes")
    if isinstance(barcodes, list) and barcodes:
        return str(barcodes[0])
    return ""


def _extract_ozon_photo(source: dict[str, Any]) -> str:
    photos = _extract_ozon_photos(source)
    if photos:
        return photos[0]
    return ""


def _extract_ozon_photos(source: dict[str, Any]) -> list[str]:
    out: list[str] = []

    def _collect(value: Any) -> None:
        if isinstance(value, str):
            normalized = _normalize_photo_url(value)
            if normalized:
                out.append(normalized)
            return
        if isinstance(value, dict):
            for key in ("url", "image", "x1", "x2"):
                if key in value and value[key]:
                    _collect(value[key])
            return
        if isinstance(value, list):
            for item in value:
                _collect(item)

    _collect(source.get("primary_image"))
    for key in ("images", "images360", "images_stream", "photo_urls", "photos"):
        _collect(source.get(key))
    return _dedupe_photo_urls(out)


def _extract_ozon_category_name(source: dict[str, Any], category_lookup: dict[tuple[int, int], str] | None = None) -> str:
    if not isinstance(source, dict):
        return ""
    direct = str(source.get("category_name") or "").strip()
    if direct:
        return direct
    category = source.get("category")
    if isinstance(category, dict):
        nested = str(category.get("name") or category.get("title") or "").strip()
        if nested:
            return nested
    type_name = str(source.get("type_name") or source.get("category_title") or "").strip()
    if type_name:
        return type_name
    desc_id = _to_int_or_zero(source.get("description_category_id") or source.get("category_id"))
    type_id = _to_int_or_zero(source.get("type_id"))
    if category_lookup and desc_id:
        if type_id:
            exact = str(category_lookup.get((desc_id, type_id)) or "").strip()
            if exact:
                return exact
        parent = str(category_lookup.get((desc_id, 0)) or "").strip()
        if parent:
            return parent
    return ""


def _normalize_photo_url(value: str) -> str:
    raw = value.strip()
    if not raw:
        return ""
    if raw.startswith("/"):
        base = _PUBLIC_BASE_URL or "https://seowibe.ru"
        return f"{base}{raw}"
    low = raw.lower()
    if low.startswith("static/") or low.startswith("uploads/"):
        base = _PUBLIC_BASE_URL or "https://seowibe.ru"
        return f"{base}/{raw.lstrip('/')}"
    if raw.startswith("//"):
        return f"https:{raw}"
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    return f"https://{raw.lstrip('/')}"


def _photo_identity_key(value: str) -> str:
    normalized = _normalize_photo_url(value)
    if not normalized:
        return ""
    try:
        parsed = urlsplit(normalized)
    except Exception:
        return normalized.lower()
    path = str(parsed.path or "")
    # WB/Ozon often return same image in tm/cXXX/big variants; collapse to one identity.
    path = re.sub(r"/(tm|small|preview|big|orig|x1|x2|c\d+x\d+)/", "/", path, flags=re.IGNORECASE)
    path = re.sub(r"/+", "/", path).rstrip("/")
    return f"{parsed.netloc.lower()}{path.lower()}"


def _photo_variant_score(value: str) -> int:
    low = str(value or "").lower()
    score = 0
    if "/orig/" in low or "/big/" in low:
        score += 300
    if re.search(r"/c\d+x\d+/", low):
        score += 220
    if "/x2/" in low:
        score += 180
    if "/x1/" in low:
        score += 160
    if "/tm/" in low or "/small/" in low or "/preview/" in low:
        score += 80
    if "?" not in low:
        score += 5
    return score


def _dedupe_photo_urls(values: list[str]) -> list[str]:
    order: list[str] = []
    chosen: dict[str, tuple[str, int]] = {}
    for raw in values:
        normalized = _normalize_photo_url(raw)
        if not normalized:
            continue
        key = _photo_identity_key(normalized) or normalized.lower()
        score = _photo_variant_score(normalized)
        prev = chosen.get(key)
        if prev is None:
            chosen[key] = (normalized, score)
            order.append(key)
            continue
        if score > prev[1]:
            chosen[key] = (normalized, score)
    return [chosen[key][0] for key in order if key in chosen]


def _parse_ozon_credentials(api_key: str) -> tuple[str, str] | None:
    # Формат: "client_id:api_key"
    if ":" in api_key:
        left, right = api_key.split(":", 1)
        if left.strip() and right.strip():
            return left.strip(), right.strip()
    return None


def _build_marketplace_search_url(marketplace: str, query: str) -> str:
    safe = "+".join(query.lower().split())
    if marketplace == "wb":
        return f"https://www.wildberries.ru/catalog/0/search.aspx?search={safe}"
    if marketplace == "ozon":
        return f"https://www.ozon.ru/search/?text={safe}"
    return ""


def resolve_wb_external_id(api_key: str, article: str, product_name: str = "") -> str:
    if not httpx:
        return ""
    products = _fetch_wb_products(api_key, [], True, limit=100, timeout_sec=6.0)
    if not products:
        return ""
    norm_article = _normalize_code(article)
    norm_name = _normalize_code(product_name)
    for p in products:
        if _normalize_code(p.article) == norm_article and p.external_id:
            return p.external_id
    if norm_name:
        for p in products:
            candidate = _normalize_code(p.name)
            if candidate and (norm_name in candidate or candidate in norm_name) and p.external_id:
                return p.external_id
    return ""
