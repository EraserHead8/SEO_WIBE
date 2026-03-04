import json

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import decode_access_token
from app.db import get_db
from app.models import TeamMember, User


def _ensure_owner_member(db: Session, user: User) -> TeamMember | None:
    owner = db.scalar(
        select(TeamMember)
        .where(
            TeamMember.user_id == user.id,
            TeamMember.is_owner.is_(True),
        )
        .order_by(TeamMember.id.asc())
    )
    if owner:
        return owner
    try:
        owner = TeamMember(
            user_id=user.id,
            email=user.email,
            full_name="",
            nickname="owner",
            avatar_url="",
            hashed_password=user.hashed_password,
            access_scope=json.dumps(["*"], ensure_ascii=False),
            is_owner=True,
            is_active=True,
        )
        db.add(owner)
        db.flush()
        return owner
    except Exception:
        return None

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def _extract_tokens(request: Request) -> tuple[str, str]:
    auth_header = str(request.headers.get("authorization", "") or "")
    header_token = ""
    if auth_header.lower().startswith("bearer "):
        header_token = auth_header.split(" ", 1)[1].strip()
    cookie_token = str(request.cookies.get("seo_wibe_token") or request.cookies.get("token") or "").strip()
    return header_token, cookie_token


def _team_scope_from_member(member: TeamMember | None) -> list[str]:
    if not member:
        return ["*"]
    if member.is_owner:
        return ["*"]
    raw = str(member.access_scope or "").strip()
    if not raw:
        return ["products", "sales_stats", "wb_reviews_ai", "wb_questions_ai", "returns", "social_hub"]
    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = []
    if not isinstance(parsed, list):
        return ["products", "sales_stats", "wb_reviews_ai", "wb_questions_ai", "returns", "social_hub"]
    cleaned = [str(x).strip().lower() for x in parsed if str(x).strip()]
    if not cleaned:
        return ["products", "sales_stats", "wb_reviews_ai", "wb_questions_ai", "returns", "social_hub"]
    if not member.is_owner and cleaned and all(x in {"products", "sales_stats"} for x in cleaned):
        return ["products", "sales_stats", "wb_reviews_ai", "wb_questions_ai", "returns", "social_hub"]
    return cleaned


def _resolve_user_from_subject(db: Session, subject_value: str) -> User | None:
    actor_email = ""
    actor_member_id = 0
    owner_member_id = 0
    actor_is_owner = True
    actor_scope: list[str] = ["*"]
    user = None

    if subject_value.startswith("u:"):
        user_id = int(subject_value.split(":", 1)[1] or 0)
        user = db.get(User, user_id)
        if not user:
            return None
        actor_email = str(user.email or "").strip().lower()
        owner_member = _ensure_owner_member(db, user)
        if owner_member:
            actor_member_id = int(owner_member.id or 0)
            actor_scope = _team_scope_from_member(owner_member)
            owner_member_id = int(owner_member.id or 0)
    elif subject_value.startswith("m:"):
        member_id = int(subject_value.split(":", 1)[1] or 0)
        member = db.get(TeamMember, member_id)
        if not member or not member.is_active:
            return None
        user = db.get(User, member.user_id)
        if not user:
            return None
        actor_email = str(member.email or "").strip().lower()
        actor_member_id = int(member.id or 0)
        actor_is_owner = bool(member.is_owner)
        actor_scope = _team_scope_from_member(member)
        owner_member = _ensure_owner_member(db, user)
        if owner_member:
            owner_member_id = int(owner_member.id or 0)
    else:
        subject_email = subject_value.lower()
        user = db.scalar(select(User).where(User.email == subject_email))
        actor_email = subject_email
        actor_member_id = 0
        actor_is_owner = True
        if not user:
            member = db.scalar(
                select(TeamMember)
                .where(
                    TeamMember.email == subject_email,
                    TeamMember.is_active.is_(True),
                )
                .order_by(TeamMember.id.desc())
            )
            if not member:
                return None
            user = db.get(User, member.user_id)
            if not user:
                return None
            actor_email = str(member.email or subject_email).strip().lower()
            actor_member_id = int(member.id or 0)
            actor_is_owner = bool(member.is_owner)
            actor_scope = _team_scope_from_member(member)
            owner_member = _ensure_owner_member(db, user)
            if owner_member:
                owner_member_id = int(owner_member.id or 0)
        else:
            owner_member = _ensure_owner_member(db, user)
            if owner_member:
                actor_member_id = int(owner_member.id or 0)
                actor_scope = _team_scope_from_member(owner_member)
                owner_member_id = int(owner_member.id or 0)

    if not user:
        return None

    # Runtime actor context is used by audit and permission filters.
    user._actor_email = actor_email
    user._actor_member_id = actor_member_id
    user._actor_is_owner = actor_is_owner
    user._actor_member_scope = actor_scope
    user._owner_member_id = owner_member_id
    return user


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    header_token, cookie_token = _extract_tokens(request)
    tokens: list[str] = []
    if header_token:
        tokens.append(header_token)
    if cookie_token and cookie_token not in tokens:
        tokens.append(cookie_token)
    for token in tokens:
        subject = decode_access_token(token)
        if not subject:
            continue
        user = _resolve_user_from_subject(db, str(subject or "").strip())
        if user:
            return user
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Невалидный токен")


def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ только для администратора")
    return user
