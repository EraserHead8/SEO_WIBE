from __future__ import annotations

from datetime import date, datetime, timedelta
import json
import math
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import WbAdsBidderRule, WbAdsBidderRun
from app.services.wb_modules import (
    fetch_wb_min_nm_bids,
    fetch_wb_nm_bids,
    fetch_wb_normquery_bids,
    fetch_wb_normquery_stats,
    set_wb_nm_bids,
    set_wb_normquery_bids,
)


ALLOWED_TARGET_KINDS = {"normquery", "nm"}
ALLOWED_PLACEMENTS = {"search", "recommendations", "combined"}
ALLOWED_STRATEGIES = {"hold", "range", "position", "optimal"}
NM_TARGET_SENTINEL_PREFIX = "__nm__:"


def _nm_storage_target_value(placement: str) -> str:
    return f"{NM_TARGET_SENTINEL_PREFIX}{_normalize_placement(placement)}"


def _public_target_value(target_kind: str, value: Any) -> str:
    text = str(value or "").strip()
    if str(target_kind or "").strip().lower() != "nm":
        return text
    if text.startswith(NM_TARGET_SENTINEL_PREFIX):
        return ""
    return text


def serialize_bidder_rule(rule: WbAdsBidderRule) -> dict[str, Any]:
    return {
        "id": int(rule.id),
        "campaign_id": int(rule.campaign_id or 0),
        "target_kind": str(rule.target_kind or "normquery"),
        "nm_id": int(rule.nm_id or 0),
        "target_value": _public_target_value(rule.target_kind, rule.target_value),
        "placement": str(rule.placement or "search"),
        "strategy": str(rule.strategy or "optimal"),
        "desired_bid": int(rule.desired_bid or 0),
        "min_bid": int(rule.min_bid or 0),
        "max_bid": int(rule.max_bid or 0),
        "step_bid": int(rule.step_bid or 0),
        "target_pos_from": float(rule.target_pos_from or 0.0),
        "target_pos_to": float(rule.target_pos_to or 0.0),
        "min_clicks": int(rule.min_clicks or 0),
        "is_active": bool(rule.is_active),
        "cooldown_sec": int(rule.cooldown_sec or 0),
        "notes": str(rule.notes or ""),
        "last_run_at": _dt(rule.last_run_at),
        "last_status": str(rule.last_status or ""),
        "last_reason": str(rule.last_reason or ""),
        "created_at": _dt(rule.created_at) or "",
        "updated_at": _dt(rule.updated_at) or "",
    }


def serialize_bidder_run(row: WbAdsBidderRun) -> dict[str, Any]:
    return {
        "id": int(row.id),
        "rule_id": int(row.rule_id or 0),
        "campaign_id": int(row.campaign_id or 0),
        "target_kind": str(row.target_kind or "normquery"),
        "nm_id": int(row.nm_id or 0),
        "target_value": _public_target_value(row.target_kind, row.target_value),
        "placement": str(row.placement or "search"),
        "previous_bid": int(row.previous_bid or 0),
        "next_bid": int(row.next_bid or 0),
        "min_bid_floor": int(row.min_bid_floor or 0),
        "avg_position": float(row.avg_position or 0.0),
        "clicks": float(row.clicks or 0.0),
        "orders": float(row.orders or 0.0),
        "spent": float(row.spent or 0.0),
        "changed": bool(row.changed),
        "status": str(row.status or ""),
        "reason": str(row.reason or ""),
        "created_at": _dt(row.created_at) or "",
    }


def list_bidder_rules(db: Session, user_id: int) -> list[WbAdsBidderRule]:
    return list(
        db.scalars(
            select(WbAdsBidderRule)
            .where(WbAdsBidderRule.user_id == int(user_id))
            .order_by(WbAdsBidderRule.is_active.desc(), WbAdsBidderRule.campaign_id.asc(), WbAdsBidderRule.id.asc())
        ).all()
    )


def list_bidder_runs(db: Session, user_id: int, *, limit: int = 120) -> list[WbAdsBidderRun]:
    safe_limit = max(1, min(int(limit or 1), 400))
    return list(
        db.scalars(
            select(WbAdsBidderRun)
            .where(WbAdsBidderRun.user_id == int(user_id))
            .order_by(WbAdsBidderRun.id.desc())
            .limit(safe_limit)
        ).all()
    )


def normalize_rule_payload(payload: dict[str, Any], *, partial: bool = False, current: dict[str, Any] | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {}
    current = dict(current or {})

    def _allow(field: str) -> bool:
        return not partial or field in payload

    def _resolved(field: str, default: Any = "") -> Any:
        if field in out:
            return out.get(field)
        if field in payload:
            return payload.get(field)
        return current.get(field, default)

    if _allow("campaign_id"):
        campaign_id = int(payload.get("campaign_id") or 0)
        if campaign_id <= 0:
            raise ValueError("campaign_id должен быть > 0")
        out["campaign_id"] = campaign_id

    if _allow("target_kind"):
        kind = str(payload.get("target_kind") or "normquery").strip().lower()
        if kind not in ALLOWED_TARGET_KINDS:
            raise ValueError("target_kind должен быть normquery или nm")
        out["target_kind"] = kind

    if _allow("nm_id"):
        nm_id = int(payload.get("nm_id") or 0)
        if nm_id < 0:
            raise ValueError("nm_id не может быть отрицательным")
        out["nm_id"] = nm_id

    if _allow("target_value"):
        value = str(payload.get("target_value") or "").strip()
        out["target_value"] = value

    if _allow("placement"):
        placement = str(payload.get("placement") or "search").strip().lower()
        if placement not in ALLOWED_PLACEMENTS:
            raise ValueError("placement должен быть search, recommendations или combined")
        out["placement"] = placement

    if _allow("strategy"):
        strategy = str(payload.get("strategy") or "optimal").strip().lower()
        if strategy not in ALLOWED_STRATEGIES:
            raise ValueError("strategy должен быть hold, range, position или optimal")
        out["strategy"] = strategy

    if _allow("desired_bid"):
        out["desired_bid"] = max(0, int(payload.get("desired_bid") or 0))
    if _allow("min_bid"):
        out["min_bid"] = max(0, int(payload.get("min_bid") or 0))
    if _allow("max_bid"):
        out["max_bid"] = max(0, int(payload.get("max_bid") or 0))
    if _allow("step_bid"):
        out["step_bid"] = max(1, min(200000, int(payload.get("step_bid") or 100)))
    if _allow("target_pos_from"):
        out["target_pos_from"] = max(1.0, min(200.0, float(payload.get("target_pos_from") or 1.0)))
    if _allow("target_pos_to"):
        out["target_pos_to"] = max(1.0, min(200.0, float(payload.get("target_pos_to") or 5.0)))
    if _allow("min_clicks"):
        out["min_clicks"] = max(0, min(500000, int(payload.get("min_clicks") or 0)))
    if _allow("is_active"):
        out["is_active"] = bool(payload.get("is_active"))
    if _allow("cooldown_sec"):
        out["cooldown_sec"] = max(30, min(86400, int(payload.get("cooldown_sec") or 300)))
    if _allow("notes"):
        out["notes"] = str(payload.get("notes") or "").strip()[:500]

    current_target_kind = str(current.get("target_kind") or "").strip().lower()
    target_kind = str(_resolved("target_kind", "normquery") or "normquery").strip().lower()
    nm_id = int(_resolved("nm_id", 0) or 0)
    target_raw = _resolved("target_value", "")
    if "target_value" not in out and "target_value" not in payload and current_target_kind != target_kind:
        target_raw = ""
    target_value = str(target_raw or "").strip()
    placement = _normalize_placement(str(_resolved("placement", "search") or "search").strip().lower())
    if not partial or "target_kind" in out or "nm_id" in out or "target_value" in out or "placement" in out:
        if target_kind == "normquery":
            if nm_id <= 0:
                raise ValueError("Для target_kind=normquery нужно указать nm_id > 0")
            if not target_value:
                raise ValueError("Для target_kind=normquery нужно указать target_value (фразу)")
            out["target_value"] = _normalize_space(target_value)[:255]
        else:
            # target_kind=nm
            if nm_id <= 0 and target_value:
                parsed_nm = _to_int(target_value)
                if parsed_nm:
                    nm_id = parsed_nm
            if nm_id <= 0:
                raise ValueError("Для target_kind=nm нужно указать nm_id > 0")
            out["nm_id"] = nm_id
            out["target_value"] = _nm_storage_target_value(placement)

    if ("min_bid" in out or "max_bid" in out) and (not partial or "min_bid" in out or "max_bid" in out):
        min_bid = int(_resolved("min_bid", 0) or 0)
        max_bid = int(_resolved("max_bid", 0) or 0)
        if max_bid > 0 and min_bid > max_bid:
            min_bid, max_bid = max_bid, min_bid
        out["min_bid"] = max(0, min_bid)
        out["max_bid"] = max(0, max_bid)

    if ("target_pos_from" in out or "target_pos_to" in out) and (not partial or "target_pos_from" in out or "target_pos_to" in out):
        left = float(_resolved("target_pos_from", 1.0) or 1.0)
        right = float(_resolved("target_pos_to", 5.0) or 5.0)
        if left > right:
            left, right = right, left
        out["target_pos_from"] = left
        out["target_pos_to"] = right

    return out


def apply_rule_payload(rule: WbAdsBidderRule, payload: dict[str, Any]) -> WbAdsBidderRule:
    for key, value in payload.items():
        setattr(rule, key, value)
    return rule


def run_bidder_rules(
    db: Session,
    *,
    user_id: int,
    wb_api_key: str,
    rule_ids: list[int] | None = None,
    force: bool = False,
) -> dict[str, Any]:
    now = datetime.utcnow()
    safe_rule_ids = sorted({int(x) for x in (rule_ids or []) if int(x) > 0})
    stmt = select(WbAdsBidderRule).where(WbAdsBidderRule.user_id == int(user_id))
    if safe_rule_ids:
        stmt = stmt.where(WbAdsBidderRule.id.in_(safe_rule_ids))
    elif not force:
        stmt = stmt.where(WbAdsBidderRule.is_active.is_(True))
    rules = list(db.scalars(stmt.order_by(WbAdsBidderRule.id.asc())).all())

    if not rules:
        return {"ok": True, "message": "Активных правил не найдено", "results": [], "meta": {"rules": 0}}

    results: list[dict[str, Any]] = []
    min_bid_cache: dict[tuple[int, int, str], int] = {}
    nm_bid_cache: dict[tuple[int, int, str], int] = {}
    norm_bid_cache: dict[tuple[int, int], list[dict[str, Any]]] = {}
    norm_stat_cache: dict[tuple[int, int], list[dict[str, Any]]] = {}

    changed_count = 0
    executed_count = 0
    skipped_count = 0
    error_count = 0

    for rule in rules:
        if not force and not rule.is_active:
            continue
        reason = ""
        status = "ok"
        changed = False
        previous_bid = 0
        next_bid = 0
        floor_bid = 0
        avg_position = 0.0
        clicks = 0.0
        orders = 0.0
        spent = 0.0
        response_payload: dict[str, Any] = {}

        if not force and rule.last_run_at and int(rule.cooldown_sec or 0) > 0:
            delta = (now - rule.last_run_at).total_seconds()
            if delta < int(rule.cooldown_sec or 0):
                skipped_count += 1
                rule.last_status = "skipped"
                remain = max(0, int(rule.cooldown_sec or 0) - int(delta))
                rule.last_reason = f"cooldown:{remain}s"
                # NOTE: do not move last_run_at here, otherwise rule may never become due.
                continue

        executed_count += 1
        campaign_id = int(rule.campaign_id or 0)
        nm_id = int(rule.nm_id or 0)
        target_kind = str(rule.target_kind or "normquery").strip().lower()
        target_value = _public_target_value(target_kind, rule.target_value)
        placement = _normalize_placement(rule.placement)
        strategy = str(rule.strategy or "optimal").strip().lower()

        try:
            if campaign_id <= 0:
                raise ValueError("campaign_id_missing")
            if target_kind not in ALLOWED_TARGET_KINDS:
                raise ValueError("target_kind_invalid")
            if nm_id <= 0:
                raise ValueError("nm_id_missing")

            if target_kind == "normquery":
                cache_key = (campaign_id, nm_id)
                if cache_key not in norm_bid_cache:
                    payload = fetch_wb_normquery_bids(
                        wb_api_key,
                        items=[{"advert_id": campaign_id, "nm_id": nm_id}],
                    )
                    norm_bid_cache[cache_key] = list(payload.get("items") or [])
                bid_rows = norm_bid_cache.get(cache_key, [])
                previous_bid = _extract_normquery_metric(bid_rows, target_value, "bid")
                if previous_bid <= 0:
                    previous_bid = max(0, int(rule.desired_bid or 0), int(rule.min_bid or 0))

                if cache_key not in norm_stat_cache:
                    payload = fetch_wb_normquery_stats(
                        wb_api_key,
                        items=[{"advert_id": campaign_id, "nm_id": nm_id}],
                        date_from=(date.today() - timedelta(days=1)).isoformat(),
                        date_to=(date.today()).isoformat(),
                    )
                    norm_stat_cache[cache_key] = list(payload.get("items") or [])
                stat_rows = norm_stat_cache.get(cache_key, [])
                avg_position = _extract_normquery_metric(stat_rows, target_value, "avg_position")
                clicks = _extract_normquery_metric(stat_rows, target_value, "clicks")
                orders = _extract_normquery_metric(stat_rows, target_value, "orders")
                spent = _extract_normquery_metric(stat_rows, target_value, "spent")

                floor_bid = max(1, int(rule.min_bid or 0))
                next_bid, reason = _calculate_next_bid(
                    strategy=strategy,
                    current_bid=previous_bid,
                    floor_bid=floor_bid,
                    max_bid=int(rule.max_bid or 0),
                    step_bid=int(rule.step_bid or 0),
                    desired_bid=int(rule.desired_bid or 0),
                    avg_position=float(avg_position or 0.0),
                    target_pos_from=float(rule.target_pos_from or 1.0),
                    target_pos_to=float(rule.target_pos_to or 5.0),
                    clicks=float(clicks or 0.0),
                    min_clicks=int(rule.min_clicks or 0),
                )
                if next_bid != previous_bid:
                    response_payload = set_wb_normquery_bids(
                        wb_api_key,
                        bids=[
                            {
                                "advert_id": campaign_id,
                                "nm_id": nm_id,
                                "norm_query": target_value,
                                "bid": next_bid,
                            }
                        ],
                    )
                    if bool(response_payload.get("ok")):
                        changed = True
                        changed_count += 1
                        # refresh cache for this campaign/nm after successful write
                        norm_bid_cache.pop(cache_key, None)
                    else:
                        status = "error"
                        reason = str(response_payload.get("reason") or "set_failed")
                        error_count += 1
                else:
                    status = "skipped"
                    skipped_count += 1
            else:
                # target_kind=nm
                cache_key = (campaign_id, nm_id, placement)
                if cache_key not in nm_bid_cache:
                    read_payload = fetch_wb_nm_bids(
                        wb_api_key,
                        items=[{"advert_id": campaign_id, "nm_id": nm_id, "placement": placement}],
                    )
                    nm_bid_cache[cache_key] = int(
                        _extract_nm_bid_value(
                            rows=list(read_payload.get("bids") or []),
                            nm_id=nm_id,
                            placement=placement,
                        )
                    )
                previous_bid = max(0, int(nm_bid_cache.get(cache_key, 0)))

                min_cache_key = (campaign_id, nm_id, placement)
                if min_cache_key not in min_bid_cache:
                    min_payload = fetch_wb_min_nm_bids(
                        wb_api_key,
                        advert_id=campaign_id,
                        nm_ids=[nm_id],
                        placement_types=[_placement_to_api(placement)],
                    )
                    min_bid_cache[min_cache_key] = int(
                        _extract_nm_bid_value(
                            rows=list(min_payload.get("bids") or []),
                            nm_id=nm_id,
                            placement=placement,
                        )
                    )
                floor_bid = max(1, int(rule.min_bid or 0), int(min_bid_cache.get(min_cache_key, 0)))
                if previous_bid <= 0:
                    previous_bid = max(floor_bid, int(rule.desired_bid or 0))

                next_bid, reason = _calculate_next_bid(
                    strategy="range" if strategy in {"position", "optimal"} else strategy,
                    current_bid=previous_bid,
                    floor_bid=floor_bid,
                    max_bid=int(rule.max_bid or 0),
                    step_bid=int(rule.step_bid or 0),
                    desired_bid=int(rule.desired_bid or 0),
                    avg_position=0.0,
                    target_pos_from=float(rule.target_pos_from or 1.0),
                    target_pos_to=float(rule.target_pos_to or 5.0),
                    clicks=0.0,
                    min_clicks=int(rule.min_clicks or 0),
                )
                if next_bid != previous_bid:
                    response_payload = set_wb_nm_bids(
                        wb_api_key,
                        bids=[
                            {
                                "advert_id": campaign_id,
                                "nm_id": nm_id,
                                "placement": placement,
                                "bid_kopecks": next_bid,
                            }
                        ],
                    )
                    if bool(response_payload.get("ok")):
                        changed = True
                        changed_count += 1
                        nm_bid_cache.pop(cache_key, None)
                    else:
                        status = "error"
                        reason = str(response_payload.get("reason") or "set_failed")
                        error_count += 1
                else:
                    status = "skipped"
                    skipped_count += 1
        except Exception as exc:
            status = "error"
            reason = str(exc or "rule_failed")[:450]
            response_payload = {"error": reason}
            error_count += 1

        rule.last_run_at = now
        rule.last_status = status
        rule.last_reason = reason[:500]

        log_row = WbAdsBidderRun(
            user_id=int(user_id),
            rule_id=int(rule.id),
            campaign_id=int(campaign_id),
            target_kind=target_kind,
            nm_id=int(nm_id),
            target_value=target_value,
            placement=placement,
            previous_bid=int(previous_bid or 0),
            next_bid=int(next_bid or 0),
            min_bid_floor=int(floor_bid or 0),
            avg_position=float(avg_position or 0.0),
            clicks=float(clicks or 0.0),
            orders=float(orders or 0.0),
            spent=float(spent or 0.0),
            changed=bool(changed),
            status=status,
            reason=reason[:500],
            response_json=json.dumps(response_payload or {}, ensure_ascii=False)[:6000],
            created_at=now,
        )
        db.add(log_row)
        results.append(
            {
                "rule_id": int(rule.id),
                "campaign_id": int(campaign_id),
                "nm_id": int(nm_id),
                "target_kind": target_kind,
                "target_value": target_value,
                "previous_bid": int(previous_bid or 0),
                "next_bid": int(next_bid or 0),
                "changed": bool(changed),
                "status": status,
                "reason": reason,
            }
        )

    message = (
        f"Выполнено: {executed_count}, изменено: {changed_count}, "
        f"пропущено: {skipped_count}, ошибок: {error_count}"
    )
    return {
        "ok": error_count <= 0,
        "message": message,
        "results": results,
        "meta": {
            "rules": len(rules),
            "executed": executed_count,
            "changed": changed_count,
            "skipped": skipped_count,
            "errors": error_count,
            "force": bool(force),
        },
    }


def _calculate_next_bid(
    *,
    strategy: str,
    current_bid: int,
    floor_bid: int,
    max_bid: int,
    step_bid: int,
    desired_bid: int,
    avg_position: float,
    target_pos_from: float,
    target_pos_to: float,
    clicks: float,
    min_clicks: int,
) -> tuple[int, str]:
    current = max(1, int(current_bid or 0))
    floor = max(1, int(floor_bid or 0))
    hard_max = int(max_bid or 0)
    top = hard_max if hard_max > 0 else max(floor, current, int(desired_bid or 0), 500000)
    top = max(floor, top)
    step = max(1, int(step_bid or 1))
    desired = int(desired_bid or 0)
    if desired > 0:
        desired = max(floor, min(top, desired))

    safe_strategy = str(strategy or "optimal").strip().lower()
    if safe_strategy not in ALLOWED_STRATEGIES:
        safe_strategy = "optimal"
    if safe_strategy == "hold":
        if desired > 0:
            return desired, "hold_desired"
        return max(floor, min(top, current)), "hold_current"

    if safe_strategy == "range":
        if current < floor:
            return floor, "raise_to_floor"
        if current > top:
            return top, "reduce_to_max"
        if desired > 0 and current != desired:
            return desired, "align_desired"
        return current, "in_range"

    if min_clicks > 0 and float(clicks or 0.0) < float(min_clicks):
        return current, "not_enough_clicks"

    left = max(1.0, float(min(target_pos_from, target_pos_to)))
    right = max(left, float(max(target_pos_from, target_pos_to)))
    pos = float(avg_position or 0.0)
    if pos <= 0.0:
        if desired > 0:
            return desired, "no_position_use_desired"
        return current, "no_position_data"

    # Position value: lower is better. Example target 1-5.
    if pos > right:
        return min(top, current + step), "position_worse_increase"
    if pos < left:
        return max(floor, current - step), "position_better_reduce"

    if safe_strategy == "position":
        return current, "position_in_target"

    # optimal mode tries to save while keeping target interval.
    reduced = max(floor, current - max(1, step // 2))
    if desired > 0 and reduced < desired:
        reduced = desired
    if reduced < current:
        return reduced, "optimal_reduce_in_target"
    return current, "optimal_hold"


def _normalize_placement(value: str) -> str:
    low = str(value or "").strip().lower()
    if low in {"recommendation", "recommendations"}:
        return "recommendations"
    if low == "combined":
        return "combined"
    return "search"


def _placement_to_api(value: str) -> str:
    low = _normalize_placement(value)
    if low == "recommendations":
        return "recommendation"
    return low


def _extract_normquery_metric(rows: list[dict[str, Any]], query: str, metric: str) -> float:
    norm_query = _normalize_space(query).lower()
    if not norm_query:
        return 0.0
    best: float = 0.0
    for row in _walk_dict_rows(rows):
        q = _normalize_space(
            _pick_text(
                row.get("norm_query"),
                row.get("normQuery"),
                row.get("normquery"),
                row.get("query"),
                row.get("keyword"),
                row.get("phrase"),
            )
        ).lower()
        if q != norm_query:
            continue
        if metric == "bid":
            value = _pick_number(
                row.get("bid"),
                row.get("cpm"),
                row.get("sum"),
                row.get("price"),
                row.get("bid_kopecks"),
            )
            if value > 0:
                best = value
        elif metric == "avg_position":
            value = _pick_number(
                row.get("avg_position"),
                row.get("avg_pos"),
                row.get("avgPlace"),
                row.get("position"),
            )
            if value > 0:
                best = value
        elif metric == "clicks":
            best = _pick_number(row.get("clicks"), row.get("click"), row.get("click_count"), default=best)
        elif metric == "orders":
            best = _pick_number(row.get("orders"), row.get("order"), row.get("order_count"), default=best)
        elif metric == "spent":
            best = _pick_number(row.get("spent"), row.get("sum"), row.get("cost"), default=best)
    return float(best or 0.0)


def _extract_nm_bid_value(rows: list[dict[str, Any]], *, nm_id: int, placement: str) -> int:
    safe_nm_id = int(nm_id or 0)
    if safe_nm_id <= 0:
        return 0
    wanted = _normalize_placement(placement)
    candidate = 0
    for row in _walk_dict_rows(rows):
        nm_val = _to_int(row.get("nm_id"))
        if nm_val is None:
            nm_val = _to_int(row.get("nmId"))
        if nm_val is not None and int(nm_val) != safe_nm_id:
            continue
        place_raw = _pick_text(row.get("placement"), row.get("placement_type"), row.get("type"))
        place = _normalize_placement(place_raw)
        if place_raw and place != wanted:
            continue
        bid = int(
            _pick_number(
                row.get("bid_kopecks"),
                row.get("bid"),
                row.get("cpm"),
                row.get("min_bid_kopecks"),
                row.get("minBidKopecks"),
                default=0.0,
            )
        )
        if bid > 0:
            if candidate <= 0:
                candidate = bid
            else:
                candidate = min(candidate, bid)
    return int(max(0, candidate))


def _walk_dict_rows(value: Any):
    if isinstance(value, dict):
        yield value
        for nested in value.values():
            if isinstance(nested, (dict, list)):
                yield from _walk_dict_rows(nested)
    elif isinstance(value, list):
        for item in value:
            if isinstance(item, (dict, list)):
                yield from _walk_dict_rows(item)


def _to_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        if isinstance(value, bool):
            return None
        return int(float(value))
    except Exception:
        return None


def _pick_number(*values: Any, default: float = 0.0) -> float:
    for value in values:
        if value is None or value == "":
            continue
        try:
            if isinstance(value, str):
                raw = value.replace(" ", "").replace(",", ".")
                raw = re.sub(r"[^\d.\-]", "", raw)
                if not raw:
                    continue
                num = float(raw)
            else:
                num = float(value)
            if math.isfinite(num):
                return num
        except Exception:
            continue
    return float(default)


def _pick_text(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def _normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _dt(value: datetime | None) -> str | None:
    if value is None:
        return None
    try:
        return value.isoformat(timespec="seconds")
    except Exception:
        return value.isoformat()
