from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta
import hashlib
import random

from sqlalchemy import delete, select

from app.db import SessionLocal
from app.models import ApiCredential, AuditLog, MarketplaceApiCache, ModuleAccess, Product, SeoJob, User, UserKeyword
from app.services.marketplace import find_competitors, resolve_wb_external_id, update_product_description
from app.services.ads_cache import sync_wb_campaign_snapshots_for_all_users
from app.services.market_cache import build_market_cache_key, get_or_refresh_market_cache
from app.services.sales import build_sales_report
from app.services.seo import (
    build_seo_description,
    discover_keywords,
    evaluate_position,
    schedule_next_check,
    summarize_competitors,
)
from app.services.wb_modules import fetch_ozon_ads_campaigns, fetch_wb_campaigns


_MARKET_CACHE_TTL_SEC = {
    "sales_stats": 180,
    "wb_ads": 180,
}


async def seo_recheck_loop():
    while True:
        await asyncio.sleep(20)
        db = SessionLocal()
        try:
            jobs = db.scalars(
                select(SeoJob).where(
                    SeoJob.next_check_at.is_not(None),
                    SeoJob.next_check_at <= datetime.utcnow(),
                    SeoJob.status.in_(["applied", "in_progress"]),
                )
            ).all()
            for job in jobs:
                product = db.get(Product, job.product_id)
                user = db.get(User, job.user_id)
                if not product or not user:
                    continue
                if product.marketplace == "wb" and not product.external_id:
                    credential = db.scalar(
                        select(ApiCredential).where(
                            ApiCredential.user_id == user.id,
                            ApiCredential.marketplace == product.marketplace,
                            ApiCredential.active.is_(True),
                        )
                    )
                    if credential:
                        resolved = resolve_wb_external_id(credential.api_key, product.article, product.name)
                        if resolved:
                            product.external_id = resolved

                tracking_enabled = db.scalar(
                    select(ModuleAccess).where(
                        ModuleAccess.user_id == user.id,
                        ModuleAccess.module_code == "rank_tracking",
                        ModuleAccess.enabled.is_(True),
                    )
                )
                if not tracking_enabled:
                    continue

                credential = db.scalar(
                    select(ApiCredential).where(
                        ApiCredential.user_id == user.id,
                        ApiCredential.marketplace == product.marketplace,
                        ApiCredential.active.is_(True),
                    )
                )
                keywords = [k.strip() for k in job.keywords_snapshot.split(",") if k.strip()]
                current_position = evaluate_position(
                    product.marketplace,
                    product.article,
                    keywords,
                    external_id=product.external_id,
                    product_name=product.name,
                    wb_api_key=credential.api_key if credential and product.marketplace == "wb" else "",
                )
                if current_position is None:
                    current_position = _safe_known_position(job.current_position)
                    if current_position == 0:
                        current_position = _safe_known_position(product.last_position)
                    if current_position == 0 and keywords:
                        current_position = 501
                job.current_position = current_position
                product.last_position = current_position
                if current_position <= job.target_position:
                    job.status = "top_reached"
                    job.next_check_at = schedule_next_check(current_position, job.target_position)
                else:
                    job.status = "in_progress"
                    job.next_check_at = schedule_next_check(current_position, job.target_position)

                    if credential:
                        user_keywords = db.scalars(
                            select(UserKeyword.keyword).where(
                                UserKeyword.user_id == user.id,
                                UserKeyword.marketplace.in_(["all", product.marketplace]),
                            )
                        ).all()
                        competitors = find_competitors(
                            product.marketplace,
                            product.name,
                            product.current_description,
                            exclude_external_id=product.external_id or "",
                        )
                        new_keywords = discover_keywords(
                            product.name,
                            product.current_description,
                            competitors,
                            [x for x in user_keywords if x],
                            keywords,
                        )
                        new_description = build_seo_description(
                            product.name,
                            product.current_description,
                            new_keywords,
                            competitors,
                        )
                        job.generated_description = new_description
                        job.keywords_snapshot = ", ".join(new_keywords)
                        job.competitor_snapshot = summarize_competitors(competitors)
                        product.current_description = new_description
                        update_product_description(product.marketplace, credential.api_key, product.article, new_description)
                job.attempt_count += 1
            db.commit()
        finally:
            db.close()


def _safe_known_position(value: int | None) -> int:
    if value is None:
        return 0
    if value <= 0:
        return 0
    if value > 500:
        return 501
    return int(value)


async def wb_ads_snapshot_sync_loop():
    while True:
        await asyncio.sleep(3600 + random.randint(60, 180))
        db = SessionLocal()
        try:
            sync_wb_campaign_snapshots_for_all_users(db)
        except Exception:
            db.rollback()
        finally:
            db.close()


async def marketplace_cache_warmup_loop():
    while True:
        await asyncio.sleep(95 + random.randint(10, 30))
        db = SessionLocal()
        try:
            _warm_marketplace_cache_for_recent_users(db, user_limit=8, warm_budget=30)
            _cleanup_market_cache_rows(db, max_age_hours=96)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()


def _warm_marketplace_cache_for_recent_users(db, *, user_limit: int, warm_budget: int) -> None:
    user_ids = _select_recent_market_users(db, limit=max(1, int(user_limit or 0)))
    if not user_ids:
        return
    creds = db.scalars(
        select(ApiCredential).where(
            ApiCredential.active.is_(True),
            ApiCredential.user_id.in_(user_ids),
            ApiCredential.marketplace.in_(["wb", "ozon"]),
        )
    ).all()
    keys_by_user: dict[int, dict[str, str]] = {}
    for cred in creds:
        uid = int(cred.user_id or 0)
        if uid <= 0:
            continue
        holder = keys_by_user.setdefault(uid, {})
        market = str(cred.marketplace or "").strip().lower()
        if market in {"wb", "ozon"} and str(cred.api_key or "").strip():
            holder[market] = str(cred.api_key or "").strip()

    budget_left = max(1, int(warm_budget or 0))
    for uid in user_ids:
        if budget_left <= 0:
            break
        keys = keys_by_user.get(int(uid), {})
        if not keys:
            continue
        spent = _warm_marketplace_cache_for_user(db, user_id=int(uid), wb_key=keys.get("wb", ""), ozon_key=keys.get("ozon", ""), budget=budget_left)
        budget_left -= max(0, int(spent or 0))


def _warm_marketplace_cache_for_user(
    db,
    *,
    user_id: int,
    wb_key: str,
    ozon_key: str,
    budget: int,
) -> int:
    safe_budget = max(0, int(budget or 0))
    if safe_budget <= 0:
        return 0
    today = date.today()
    tz_name = "Europe/Moscow"
    key_rev = _secret_revision(wb_key, ozon_key)
    consumed = 0

    sales_markets: list[str] = []
    if wb_key:
        sales_markets.append("wb")
    if ozon_key:
        sales_markets.append("ozon")
    if wb_key or ozon_key:
        sales_markets.insert(0, "all")

    for selected_market in sales_markets:
        if consumed >= safe_budget:
            break
        sales_cache_key = build_market_cache_key(
            {
                "marketplace": selected_market,
                "date_from": today.isoformat(),
                "date_to": today.isoformat(),
                "granularity": "hour",
                "tz": tz_name,
                "key_rev": key_rev,
            }
        )
        try:
            get_or_refresh_market_cache(
                db,
                user_id=int(user_id),
                module_code="sales_stats",
                marketplace=selected_market,
                cache_key=sales_cache_key,
                ttl_sec=_market_cache_ttl("sales_stats"),
                fetcher=lambda selected=selected_market: build_sales_report(
                    marketplace=selected,
                    date_from=today,
                    date_to=today,
                    wb_api_key=wb_key,
                    ozon_api_key=ozon_key,
                    granularity="hour",
                    timezone=tz_name,
                ),
                stale_if_error_sec=45 * 60,
            )
            consumed += 1
        except Exception:
            pass

    if wb_key and consumed < safe_budget:
        wb_campaign_key = build_market_cache_key(
            {"kind": "wb_campaigns_base", "key_rev": _secret_revision(wb_key)}
        )
        try:
            get_or_refresh_market_cache(
                db,
                user_id=int(user_id),
                module_code="wb_ads",
                marketplace="wb",
                cache_key=wb_campaign_key,
                ttl_sec=_market_cache_ttl("wb_ads"),
                fetcher=lambda: fetch_wb_campaigns(wb_key, enrich=False),
                stale_if_error_sec=30 * 60,
            )
            consumed += 1
        except Exception:
            pass

    if ozon_key and consumed < safe_budget:
        ozon_campaign_key = build_market_cache_key(
            {"kind": "ozon_campaigns", "key_rev": _secret_revision(ozon_key)}
        )
        try:
            get_or_refresh_market_cache(
                db,
                user_id=int(user_id),
                module_code="wb_ads",
                marketplace="ozon",
                cache_key=ozon_campaign_key,
                ttl_sec=_market_cache_ttl("wb_ads"),
                fetcher=lambda: fetch_ozon_ads_campaigns(ozon_key),
                stale_if_error_sec=30 * 60,
            )
            consumed += 1
        except Exception:
            pass

    return consumed


def _select_recent_market_users(db, *, limit: int) -> list[int]:
    safe_limit = max(1, int(limit or 1))
    active_user_ids = {
        int(uid)
        for uid in db.scalars(
            select(ApiCredential.user_id).where(
                ApiCredential.active.is_(True),
                ApiCredential.marketplace.in_(["wb", "ozon"]),
            )
        ).all()
        if int(uid or 0) > 0
    }
    if not active_user_ids:
        return []

    candidate_ids = [
        int(uid)
        for uid in db.scalars(
            select(AuditLog.user_id)
            .where(
                AuditLog.user_id.is_not(None),
                AuditLog.module_code.in_(
                    [
                        "sales_stats",
                        "wb_reviews_ai",
                        "wb_questions_ai",
                        "returns",
                        "wb_ads",
                        "wb_ads_analytics",
                        "wb_ads_recommendations",
                    ]
                ),
            )
            .order_by(AuditLog.id.desc())
            .limit(500)
        ).all()
        if int(uid or 0) > 0
    ]

    ordered: list[int] = []
    seen: set[int] = set()
    for uid in candidate_ids:
        if uid not in active_user_ids or uid in seen:
            continue
        ordered.append(uid)
        seen.add(uid)
        if len(ordered) >= safe_limit:
            return ordered

    for uid in sorted(active_user_ids):
        if uid in seen:
            continue
        ordered.append(uid)
        if len(ordered) >= safe_limit:
            break
    return ordered


def _cleanup_market_cache_rows(db, *, max_age_hours: int = 96) -> None:
    cutoff = datetime.utcnow() - timedelta(hours=max(24, int(max_age_hours or 96)))
    db.execute(delete(MarketplaceApiCache).where(MarketplaceApiCache.updated_at < cutoff))


def _secret_revision(*values: str) -> str:
    raw = "|".join(str(v or "").strip() for v in values)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]


def _market_cache_ttl(module_code: str) -> int:
    safe_module = str(module_code or "").strip()
    return max(45, int(_MARKET_CACHE_TTL_SEC.get(safe_module, 120)))
