import json

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import decode_access_token
from app.db import get_db
from app.models import TeamMember, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


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
    if not member.is_owner and cleaned and all(x in {"products", "sales_stats"} for x in cleaned):
        return ["products", "sales_stats", "wb_reviews_ai", "wb_questions_ai", "returns", "social_hub"]
    return cleaned


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    subject = decode_access_token(token)
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Невалидный токен")

    subject_value = str(subject or "").strip()
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
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
        actor_email = str(user.email or "").strip().lower()
        owner_member = db.scalar(
            select(TeamMember)
            .where(
                TeamMember.user_id == user.id,
                TeamMember.is_owner.is_(True),
            )
            .order_by(TeamMember.id.asc())
        )
        if owner_member:
            actor_member_id = int(owner_member.id or 0)
            actor_scope = _team_scope_from_member(owner_member)
            owner_member_id = int(owner_member.id or 0)
    elif subject_value.startswith("m:"):
        member_id = int(subject_value.split(":", 1)[1] or 0)
        member = db.get(TeamMember, member_id)
        if not member or not member.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
        user = db.get(User, member.user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
        actor_email = str(member.email or "").strip().lower()
        actor_member_id = int(member.id or 0)
        actor_is_owner = bool(member.is_owner)
        actor_scope = _team_scope_from_member(member)
        owner_member = db.scalar(
            select(TeamMember)
            .where(
                TeamMember.user_id == user.id,
                TeamMember.is_owner.is_(True),
            )
            .order_by(TeamMember.id.asc())
        )
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
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
            user = db.get(User, member.user_id)
            if not user:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
            actor_email = str(member.email or subject_email).strip().lower()
            actor_member_id = int(member.id or 0)
            actor_is_owner = bool(member.is_owner)
            actor_scope = _team_scope_from_member(member)
            owner_member = db.scalar(
                select(TeamMember)
                .where(
                    TeamMember.user_id == user.id,
                    TeamMember.is_owner.is_(True),
                )
                .order_by(TeamMember.id.asc())
            )
            if owner_member:
                owner_member_id = int(owner_member.id or 0)
        else:
            owner_member = db.scalar(
                select(TeamMember)
                .where(
                    TeamMember.user_id == user.id,
                    TeamMember.is_owner.is_(True),
                )
                .order_by(TeamMember.id.asc())
            )
            if owner_member:
                actor_member_id = int(owner_member.id or 0)
                actor_scope = _team_scope_from_member(owner_member)
                owner_member_id = int(owner_member.id or 0)

    # Runtime actor context is used by audit and permission filters.
    user._actor_email = actor_email
    user._actor_member_id = actor_member_id
    user._actor_is_owner = actor_is_owner
    user._actor_member_scope = actor_scope
    user._owner_member_id = owner_member_id
    return user


def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ только для администратора")
    return user
