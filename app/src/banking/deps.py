"""Shared FastAPI dependencies."""
from __future__ import annotations

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import errors
from .database import get_session
from .models import User
from .security import decode_access_token

# auto_error=False so a missing header raises our own 401 (consistent JSON body)
# rather than FastAPI's default.
_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_session),
) -> User:
    if creds is None or not creds.credentials:
        raise errors.NotAuthenticated("authentication required")
    user_id = decode_access_token(creds.credentials)
    if user_id is None:
        raise errors.NotAuthenticated("invalid or expired token")
    user = db.get(User, user_id)
    if user is None:
        raise errors.NotAuthenticated("user no longer exists")
    return user
