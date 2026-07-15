"""Registration, login, and the current-user endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from .. import services
from ..database import get_session
from ..deps import get_current_user
from ..models import User
from ..schemas import TokenOut, UserLogin, UserOut, UserRegister
from ..security import create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _token_response(user: User) -> TokenOut:
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_session)) -> TokenOut:
    user = services.register_user(db, payload.email, payload.full_name, payload.password)
    return _token_response(user)


@router.post("/login", response_model=TokenOut)
def login(payload: UserLogin, db: Session = Depends(get_session)) -> TokenOut:
    user = services.authenticate_user(db, payload.email, payload.password)
    return _token_response(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)
