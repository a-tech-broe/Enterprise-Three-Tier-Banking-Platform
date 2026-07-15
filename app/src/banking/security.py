"""Password hashing (bcrypt) and JWT access tokens."""
from __future__ import annotations

import datetime as dt

import bcrypt
import jwt

from .config import get_settings


def hash_password(password: str) -> str:
    # bcrypt hard-caps input at 72 bytes; truncate so long passwords don't error.
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], hashed.encode())
    except (ValueError, TypeError):
        return False


def _encode(subject: str, purpose: str, minutes: int) -> str:
    s = get_settings()
    now = dt.datetime.now(dt.UTC)
    payload = {
        "sub": subject,
        "purpose": purpose,
        "iat": now,
        "exp": now + dt.timedelta(minutes=minutes),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def _decode(token: str, purpose: str) -> str | None:
    s = get_settings()
    try:
        payload = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    # A token minted for one purpose (e.g. password reset) must not be accepted
    # as another (e.g. an API session).
    if payload.get("purpose", "access") != purpose:
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) else None


def create_access_token(subject: str) -> str:
    return _encode(subject, "access", get_settings().jwt_expire_minutes)


def decode_access_token(token: str) -> str | None:
    """Return the token subject (user id) if a valid access token, else None."""
    return _decode(token, "access")


def create_reset_token(subject: str) -> str:
    return _encode(subject, "reset", get_settings().reset_token_expire_minutes)


def decode_reset_token(token: str) -> str | None:
    """Return the subject if a valid, unexpired password-reset token, else None."""
    return _decode(token, "reset")
