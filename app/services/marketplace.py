from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
import re
import time
from typing import Any
from urllib.parse import quote_plus
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


@dataclass
class MarketplaceProduct:
    article: str
    external_id: str
    barcode: str
    photo_url: str
    name: str
    description: str


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
        if live:
            return live
    if httpx and marketplace == "ozon":
        live = _fetch_ozon_products(api_key, articles, import_all)
        if live:
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


def update_product_description(marketplace: str, api_key: str, article: str, description: str) -> bool:
    """
    Заглушка для MVP. Реальная отправка изменений в WB/Ozon.
    """
    try:
        if not httpx:
            return False
        if marketplace == "wb":
            return _update_wb_description(api_key, article, description)
        if marketplace == "ozon":
            return _update_ozon_description(api_key, article, description)
    except Exception:
        return False
    return False


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
            if _wb_product_matches(normalized_article, normalized_external, product):
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
                    details = _wb_fetch_card_details(ids[:30])
                    if details:
                        for idx, nm_id in enumerate(ids[:30]):
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
    product: dict[str, Any],
) -> bool:
    vendor = _extract_wb_vendor_code(product)
    nm_id = _extract_wb_nm_id(product)

    if normalized_external and nm_id and _codes_equal(normalized_external, nm_id):
        return True

    if normalized_article and vendor and _codes_equal(normalized_article, vendor):
        return True
    if normalized_article and nm_id and normalized_article.isdigit() and _codes_equal(normalized_article, nm_id):
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
    payload: dict[str, Any] = {
        "settings": {
            "cursor": {"limit": min(limit, 100)},
            "filter": {"withPhoto": -1},
        }
    }

    with httpx.Client(timeout=timeout_sec) as client:
        response = client.post(endpoint, headers=headers, json=payload)
        if response.status_code >= 400:
            return None
        data = response.json()

    cards = data.get("cards") or data.get("data", {}).get("cards") or []
    mapped: list[MarketplaceProduct] = []
    for card in cards:
        article = str(card.get("vendorCode") or card.get("nmID") or "")
        if not article:
            continue
        name = str(card.get("title") or card.get("object") or "Товар")
        description = str(card.get("description") or "")
        barcode = _extract_wb_barcode(card)
        photo_url = _extract_wb_photo(card)
        mapped.append(
            MarketplaceProduct(
                article=article,
                external_id=str(card.get("nmID") or ""),
                barcode=barcode,
                photo_url=photo_url,
                name=name,
                description=description,
            )
        )

    if articles:
        article_set = {x.strip() for x in articles if x.strip()}
        mapped = [x for x in mapped if x.article in article_set]
    if not import_all:
        mapped = mapped[: min(30, len(mapped))]
    return mapped


def _fetch_ozon_products(api_key: str, articles: list[str], import_all: bool, limit: int = 100) -> list[MarketplaceProduct] | None:
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

    with httpx.Client(timeout=25.0) as client:
        list_resp = client.post(
            list_endpoint,
            headers=headers,
            json={"filter": {"visibility": "ALL"}, "last_id": "", "limit": min(limit, 100)},
        )
        if list_resp.status_code >= 400:
            return None
        list_data = list_resp.json().get("result", {})
        items = list_data.get("items", [])
        product_ids = [item.get("product_id") for item in items if item.get("product_id")]
        if not product_ids:
            return []

        info_resp = client.post(info_endpoint, headers=headers, json={"product_id": product_ids})
        if info_resp.status_code >= 400:
            return None
        info_items = info_resp.json().get("result", {}).get("items", [])

    mapped: list[MarketplaceProduct] = []
    for item in info_items:
        source = item.get("product_info") or item
        article = str(source.get("offer_id") or source.get("id") or "")
        if not article:
            continue
        name = str(source.get("name") or "Товар Ozon")
        description = str(source.get("description") or source.get("marketing_description") or "")
        barcode = _extract_ozon_barcode(source)
        photo_url = _extract_ozon_photo(source)
        mapped.append(
            MarketplaceProduct(
                article=article,
                external_id=str(source.get("id") or ""),
                barcode=barcode,
                photo_url=photo_url,
                name=name,
                description=description,
            )
        )

    if articles:
        article_set = {x.strip() for x in articles if x.strip()}
        mapped = [x for x in mapped if x.article in article_set]
    if not import_all:
        mapped = mapped[: min(30, len(mapped))]
    return mapped


def _update_wb_description(api_key: str, article: str, description: str) -> bool:
    if not httpx:
        return False
    # Обновление по article зависит от структуры карточки и может требовать nmID.
    # Здесь сохраняем совместимый вариант через общий update endpoint.
    endpoint = "https://content-api.wildberries.ru/content/v2/cards/update"
    headers = {"Authorization": api_key, "Content-Type": "application/json"}
    payload = {"cards": [{"vendorCode": article, "description": description}]}
    with httpx.Client(timeout=20.0) as client:
        response = client.post(endpoint, headers=headers, json=payload)
    return response.status_code < 400


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


def _extract_wb_barcode(card: dict[str, Any]) -> str:
    sizes = card.get("sizes") or []
    for size in sizes:
        skus = size.get("skus") or []
        if skus:
            return str(skus[0])
    return ""


def _extract_wb_photo(card: dict[str, Any]) -> str:
    photos = card.get("photos") or []
    if photos:
        first = photos[0]
        if isinstance(first, dict):
            for key in ("big", "c516x688", "tm"):
                val = first.get(key)
                if val:
                    return _normalize_photo_url(str(val))
        if isinstance(first, str):
            return _normalize_photo_url(first)
    return ""


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
    images = source.get("images")
    if isinstance(images, list) and images:
        return _normalize_photo_url(str(images[0]))
    primary = source.get("primary_image")
    if isinstance(primary, str):
        return _normalize_photo_url(primary)
    return ""


def _normalize_photo_url(value: str) -> str:
    raw = value.strip()
    if not raw:
        return ""
    if raw.startswith("//"):
        return f"https:{raw}"
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    return f"https://{raw.lstrip('/')}"


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
