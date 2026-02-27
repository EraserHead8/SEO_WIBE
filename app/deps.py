import json

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import decode_access_token
from app.db import get_db
from app.models import TeamMember, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def _parse_member_scope(member: TeamMember) -> list[str]:
    if member.is_owner:
        return ["*"]
    raw = str(member.access_scope or "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in parsed:
        code = str(item or "").strip().lower()
        if not code or code in seen:
            continue
        seen.add(code)
        out.append(code)
    return out


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    email = decode_access_token(token)
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Невалидный токен")

    subject_email = str(email or "").strip().lower()
    user = db.scalar(select(User).where(User.email == subject_email))
    member = None
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
    else:
        member = db.scalar(
            select(TeamMember)
            .where(
                TeamMember.user_id == user.id,
                TeamMember.email == subject_email,
                TeamMember.is_active.is_(True),
            )
            .order_by(TeamMember.id.desc())
        )
    user._actor_email = subject_email
    user._actor_member_id = int(member.id) if member else None
    user._actor_member_scope = _parse_member_scope(member) if member else ["*"]
    user._actor_is_owner = bool(member.is_owner) if member else True
    return user


def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ только для администратора")
    return user
