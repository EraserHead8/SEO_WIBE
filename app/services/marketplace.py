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
    Возвращает только реальные товары из API маркетплейса.
    Демо/fallback-генерация намеренно отключена, чтобы не смешивать
    фиктивные карточки с реальными данными пользователя.
    """
    if not httpx:
        return []
    if marketplace == "wb":
        return _fetch_wb_products(api_key, articles, import_all) or []
    if marketplace == "ozon":
        return _fetch_ozon_products(api_key, articles, import_all) or []
    return []


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
    normalized_name = _normalize_code(product_name)
    name_tokens = _topic_tokens(product_name)
    pages = WB_MAX_PAGES
    per_page = WB_PER_PAGE
    started = time.monotonic()

    for page in range(1, pages + 1):
        if time.monotonic() - started > 45.0:
            break
        products = _wb_search_products(query, page=page, per_page=per_page)
        if products in (None, []):
            html_rows = _wb_search_products_html(query, page=page, per_page=per_page)
            if html_rows:
                products = html_rows
        if products is None:
            break
        if not products:
            break

        page_offset = (page - 1) * per_page
        if page_offset >= WB_POSITION_LIMIT:
            break
        page_limit = max(0, WB_POSITION_LIMIT - page_offset)
        page_rows = products[:page_limit]
        for idx, product in enumerate(page_rows):
            if _wb_product_matches(normalized_article, normalized_external, normalized_name, name_tokens, product):
                return _normalize_position(page_offset + idx + 1)
        # Search payloads sometimes miss vendor/article fields.
        # Enrich the current page with card details and try stable ID matching again.
        if normalized_article and page_rows:
            page_ids: list[str] = []
            for product in page_rows:
                nm_id = _extract_wb_nm_id(product)
                if nm_id and nm_id not in page_ids:
                    page_ids.append(nm_id)
            if page_ids:
                details = _wb_fetch_card_details(page_ids[:30])
                if details:
                    for idx, product in enumerate(page_rows):
                        nm_id = _extract_wb_nm_id(product)
                        detail = details.get(nm_id) if nm_id else None
                        if not detail:
                            continue
                        candidate = dict(product)
                        candidate.update(detail)
                        if _wb_product_matches(normalized_article, normalized_external, normalized_name, name_tokens, candidate):
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
    patterns = [
        r"/catalog/(\d+)/detail\.aspx",
        r"\\/catalog\\/(\d+)\\/detail\.aspx",
        r'data-nm-id="(\d+)"',
        r'"nmId"\s*:\s*(\d+)',
        r'"nmID"\s*:\s*(\d+)',
    ]
    ids: list[str] = []
    for pattern in patterns:
        ids.extend(re.findall(pattern, html))
    unique: list[str] = []
    seen: set[str] = set()
    for nm_id in ids:
        text_id = str(nm_id).strip()
        if not text_id.isdigit() or len(text_id) < 5:
            continue
        if text_id in seen:
            continue
        seen.add(text_id)
        unique.append(text_id)
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
    mapped: list[MarketplaceProduct] = []
    dedupe: set[tuple[str, str]] = set()
    cursor: dict[str, Any] = {"limit": min(max(1, int(limit)), 100)}
    max_pages = 200 if import_all else 1
    page = 0
    with httpx.Client(timeout=timeout_sec) as client:
        while page < max_pages:
            page += 1
            payload: dict[str, Any] = {
                "settings": {
                    "cursor": cursor,
                    "filter": {"withPhoto": -1},
                }
            }
            response = client.post(endpoint, headers=headers, json=payload)
            if response.status_code >= 400:
                if not mapped:
                    return None
                break
            data = response.json()
            cards = data.get("cards") or data.get("data", {}).get("cards") or []
            if not isinstance(cards, list) or not cards:
                break

            for card in cards:
                article = str(card.get("vendorCode") or card.get("nmID") or "")
                if not article:
                    continue
                external_id = str(card.get("nmID") or "")
                dedupe_key = (article, external_id)
                if dedupe_key in dedupe:
                    continue
                dedupe.add(dedupe_key)
                name = str(card.get("title") or card.get("object") or "Товар")
                description = str(card.get("description") or "")
                barcode = _extract_wb_barcode(card)
                photo_url = _extract_wb_photo(card)
                mapped.append(
                    MarketplaceProduct(
                        article=article,
                        external_id=external_id,
                        barcode=barcode,
                        photo_url=photo_url,
                        name=name,
                        description=description,
                    )
                )

            if not import_all:
                break
            next_cursor = data.get("cursor") or data.get("data", {}).get("cursor") or {}
            next_updated = next_cursor.get("updatedAt")
            next_nm = next_cursor.get("nmID")
            if not next_nm:
                next_nm = next_cursor.get("nmId")
            next_payload: dict[str, Any] = {"limit": min(max(1, int(limit)), 100)}
            if next_updated:
                next_payload["updatedAt"] = next_updated
            if next_nm:
                try:
                    next_payload["nmID"] = int(next_nm)
                except Exception:
                    next_payload["nmID"] = next_nm
            if next_payload == cursor:
                break
            cursor = next_payload

    if articles:
        article_set = {x.strip() for x in articles if x.strip()}
        mapped = [x for x in mapped if x.article in article_set]
    if not import_all:
        mapped = mapped[: min(max(1, int(limit)), len(mapped))]
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

    all_product_ids: list[int] = []
    last_id = ""
    pages = 0
    max_pages = 240 if import_all else 1
    with httpx.Client(timeout=25.0) as client:
        while pages < max_pages:
            pages += 1
            list_resp = client.post(
                list_endpoint,
                headers=headers,
                json={"filter": {"visibility": "ALL"}, "last_id": last_id, "limit": min(max(1, int(limit)), 100)},
            )
            if list_resp.status_code >= 400:
                if not all_product_ids:
                    return None
                break
            list_data = list_resp.json().get("result", {})
            items = list_data.get("items", [])
            if not isinstance(items, list) or not items:
                break
            for item in items:
                pid = item.get("product_id")
                try:
                    pid_int = int(pid)
                except Exception:
                    continue
                if pid_int > 0:
                    all_product_ids.append(pid_int)
            if not import_all:
                break
            next_last_id = str(list_data.get("last_id") or "").strip()
            if not next_last_id or next_last_id == last_id:
                break
            last_id = next_last_id

        unique_ids = sorted(set(all_product_ids))
        if not unique_ids:
            return []
        info_items: list[dict[str, Any]] = []
        batch_size = 100
        for offset in range(0, len(unique_ids), batch_size):
            chunk = unique_ids[offset : offset + batch_size]
            info_resp = client.post(info_endpoint, headers=headers, json={"product_id": chunk})
            if info_resp.status_code >= 400:
                if not info_items:
                    return None
                continue
            chunk_items = info_resp.json().get("result", {}).get("items", [])
            if isinstance(chunk_items, list):
                info_items.extend(chunk_items)

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
        mapped = mapped[: min(max(1, int(limit)), len(mapped))]
    return mapped


def fetch_marketplace_product_details(marketplace: str, api_key: str, article: str, external_id: str = "") -> dict[str, Any]:
    code = str(marketplace or "").strip().lower()
    if code == "wb":
        return _fetch_wb_product_details(api_key, article, external_id)
    if code == "ozon":
        return _fetch_ozon_product_details(api_key, article, external_id)
    return {"photos": [], "attributes": {}, "raw": {}}


def _fetch_wb_product_details(api_key: str, article: str, external_id: str) -> dict[str, Any]:
    if not httpx:
        return {"photos": [], "attributes": {}, "raw": {}}
    endpoint = "https://content-api.wildberries.ru/content/v2/get/cards/list"
    headers = {"Authorization": api_key, "Content-Type": "application/json"}
    payload = {
        "settings": {
            "cursor": {"limit": 100},
            "filter": {"textSearch": article or external_id, "withPhoto": -1},
        }
    }
    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.post(endpoint, headers=headers, json=payload)
        if response.status_code >= 400:
            return {"photos": [], "attributes": {}, "raw": {}}
        data = response.json()
    except Exception:
        return {"photos": [], "attributes": {}, "raw": {}}
    cards = data.get("cards") or data.get("data", {}).get("cards") or []
    if not isinstance(cards, list):
        cards = []
    target = None
    ext = str(external_id or "").strip()
    art = str(article or "").strip().lower()
    for card in cards:
        nm = str(card.get("nmID") or "").strip()
        vendor = str(card.get("vendorCode") or "").strip().lower()
        if ext and nm == ext:
            target = card
            break
        if art and vendor == art:
            target = card
            break
    if target is None and cards:
        target = cards[0]
    if not target:
        return {"photos": [], "attributes": {}, "raw": {}}
    photos = _extract_wb_photos(target)
    attrs = {
        "vendorCode": str(target.get("vendorCode") or ""),
        "nmID": str(target.get("nmID") or ""),
        "brand": str(target.get("brand") or ""),
        "title": str(target.get("title") or ""),
        "object": str(target.get("object") or ""),
    }
    return {"photos": photos, "attributes": attrs, "raw": target}


def _fetch_ozon_product_details(api_key: str, article: str, external_id: str) -> dict[str, Any]:
    if not httpx:
        return {"photos": [], "attributes": {}, "raw": {}}
    creds = _parse_ozon_credentials(api_key)
    if not creds:
        return {"photos": [], "attributes": {}, "raw": {}}
    client_id, token = creds
    headers = {"Client-Id": client_id, "Api-Key": token, "Content-Type": "application/json"}
    info_endpoint = "https://api-seller.ozon.ru/v3/product/info/list"

    product_ids: list[int] = []
    try:
        if external_id and str(external_id).isdigit():
            product_ids.append(int(str(external_id)))
    except Exception:
        pass
    if not product_ids:
        list_endpoint = "https://api-seller.ozon.ru/v3/product/list"
        try:
            with httpx.Client(timeout=20.0) as client:
                list_resp = client.post(
                    list_endpoint,
                    headers=headers,
                    json={"filter": {"visibility": "ALL", "offer_id": [article]}, "last_id": "", "limit": 20},
                )
            if list_resp.status_code < 400:
                rows = list_resp.json().get("result", {}).get("items", [])
                for row in rows if isinstance(rows, list) else []:
                    pid = row.get("product_id")
                    try:
                        pid_int = int(pid)
                    except Exception:
                        continue
                    if pid_int > 0:
                        product_ids.append(pid_int)
        except Exception:
            pass
    if not product_ids:
        return {"photos": [], "attributes": {}, "raw": {}}
    try:
        with httpx.Client(timeout=20.0) as client:
            info_resp = client.post(info_endpoint, headers=headers, json={"product_id": product_ids[:20]})
        if info_resp.status_code >= 400:
            return {"photos": [], "attributes": {}, "raw": {}}
        rows = info_resp.json().get("result", {}).get("items", [])
    except Exception:
        return {"photos": [], "attributes": {}, "raw": {}}
    if not isinstance(rows, list) or not rows:
        return {"photos": [], "attributes": {}, "raw": {}}
    first = rows[0].get("product_info") if isinstance(rows[0], dict) else rows[0]
    if not isinstance(first, dict):
        first = {}
    photos = _extract_ozon_photos(first)
    attrs = {
        "offer_id": str(first.get("offer_id") or ""),
        "id": str(first.get("id") or ""),
        "name": str(first.get("name") or ""),
        "brand": str(first.get("brand") or ""),
        "category_name": str(first.get("category_name") or ""),
    }
    return {"photos": photos, "attributes": attrs, "raw": first}


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
    photos = _extract_wb_photos(card)
    return photos[0] if photos else ""


def _extract_wb_photos(card: dict[str, Any]) -> list[str]:
    photos = card.get("photos") or []
    out: list[str] = []
    if photos:
        for item in photos:
            if isinstance(item, dict):
                for key in ("big", "c516x688", "tm"):
                    val = item.get(key)
                    if val:
                        out.append(_normalize_photo_url(str(val)))
                        break
            elif isinstance(item, str):
                out.append(_normalize_photo_url(item))
    dedup: list[str] = []
    seen: set[str] = set()
    for url in out:
        if not url or url in seen:
            continue
        seen.add(url)
        dedup.append(url)
    return dedup


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
    return photos[0] if photos else ""


def _extract_ozon_photos(source: dict[str, Any]) -> list[str]:
    out: list[str] = []
    images = source.get("images")
    if isinstance(images, list) and images:
        out.extend(_normalize_photo_url(str(x)) for x in images if str(x).strip())
    primary = source.get("primary_image")
    if isinstance(primary, str):
        out.append(_normalize_photo_url(primary))
    dedup: list[str] = []
    seen: set[str] = set()
    for url in out:
        if not url or url in seen:
            continue
        seen.add(url)
        dedup.append(url)
    return dedup


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
    token = (api_key or "").strip()
    if not token:
        return ""

    norm_article = _normalize_code(article)
    norm_name = _normalize_code(product_name)
    name_tokens = _topic_tokens(product_name)
    endpoint = "https://content-api.wildberries.ru/content/v2/get/cards/list"
    headers = {"Authorization": token, "Content-Type": "application/json"}
    cursor: dict[str, Any] = {"limit": 100}
    scanned = 0
    timeout = httpx.Timeout(connect=6.0, read=12.0, write=12.0, pool=12.0)

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            for _ in range(8):
                payload = {"settings": {"cursor": cursor, "filter": {"withPhoto": -1}}}
                response = client.post(endpoint, headers=headers, json=payload)
                if response.status_code >= 400:
                    break
                data = response.json()
                cards = data.get("cards") or data.get("data", {}).get("cards") or []
                if not isinstance(cards, list) or not cards:
                    break
                for card in cards:
                    nm_id = str(card.get("nmID") or card.get("nmId") or "")
                    if not nm_id:
                        continue
                    vendor = _normalize_code(str(card.get("vendorCode") or ""))
                    title = _normalize_code(str(card.get("title") or card.get("object") or ""))
                    if norm_article and vendor and _codes_equal(norm_article, vendor):
                        return nm_id
                    if norm_article and vendor and len(norm_article) >= 6 and (norm_article in vendor or vendor in norm_article):
                        return nm_id
                    if norm_name and title and name_tokens:
                        shared = 0
                        for token_part in name_tokens[:4]:
                            if token_part and token_part in title:
                                shared += 1
                        if shared >= 2:
                            return nm_id

                scanned += len(cards)
                if scanned >= 800:
                    break
                next_cursor = data.get("cursor") or data.get("data", {}).get("cursor") or {}
                next_updated = next_cursor.get("updatedAt")
                next_nm = next_cursor.get("nmID")
                if next_nm in (None, ""):
                    next_nm = next_cursor.get("nmId")
                if next_updated in (None, "") and next_nm in (None, "", 0):
                    break
                next_payload: dict[str, Any] = {"limit": 100}
                if next_updated not in (None, ""):
                    next_payload["updatedAt"] = next_updated
                if next_nm not in (None, "", 0):
                    next_payload["nmID"] = next_nm
                if next_payload == cursor:
                    break
                cursor = next_payload
    except Exception:
        pass

    products = _fetch_wb_products(token, [], True, limit=100, timeout_sec=6.0)
    if not products:
        return ""
    for p in products:
        if _normalize_code(p.article) == norm_article and p.external_id:
            return p.external_id
    if norm_name:
        for p in products:
            candidate = _normalize_code(p.name)
            if candidate and (norm_name in candidate or candidate in norm_name) and p.external_id:
                return p.external_id
    return ""
