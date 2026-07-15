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


def create_access_token(subject: str) -> str:
    s = get_settings()
    now = dt.datetime.now(dt.UTC)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + dt.timedelta(minutes=s.jwt_expire_minutes),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    """Return the token subject (user id) if valid, else None."""
    s = get_settings()
    try:
        payload = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) else None
