from __future__ import annotations

import asyncio
from datetime import datetime

from sqlalchemy import select

from app.db import SessionLocal
from app.models import ApiCredential, ModuleAccess, Product, SeoJob, User, UserKeyword
from app.services.marketplace import find_competitors, resolve_wb_external_id, update_product_description
from app.services.seo import (
    build_seo_description,
    discover_keywords,
    evaluate_position,
    schedule_next_check,
    summarize_competitors,
)


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
