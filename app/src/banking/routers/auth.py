"""Registration, login, current-user, and password reset."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from .. import email as email_service
from .. import errors, services
from ..config import get_settings
from ..database import get_session
from ..deps import get_current_user, is_admin
from ..models import User
from ..schemas import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    TokenOut,
    UserLogin,
    UserOut,
    UserRegister,
)
from ..security import create_access_token, create_reset_token, decode_reset_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _user_out(user: User) -> UserOut:
    out = UserOut.model_validate(user)
    out.is_admin = is_admin(user)
    return out


def _token_response(user: User) -> TokenOut:
    return TokenOut(access_token=create_access_token(user.id), user=_user_out(user))


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
    return _user_out(user)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    payload: ForgotPasswordRequest, db: Session = Depends(get_session)
) -> ForgotPasswordResponse:
    # Always return the same generic message so accounts can't be enumerated.
    generic = "If an account exists for that email, a reset link has been issued."
    user = services.get_user_by_email(db, payload.email)
    if user is None:
        return ForgotPasswordResponse(message=generic)

    settings = get_settings()
    token = create_reset_token(user.id)

    # Email the link when a base URL + sender are configured (best-effort).
    if settings.app_base_url:
        link = f"{settings.app_base_url.rstrip('/')}/reset-password?token={token}"
        email_service.send_reset_email(user.email, link)

    # Demo convenience: also return the token unless disabled.
    exposed = token if settings.expose_reset_token else None
    return ForgotPasswordResponse(message=generic, reset_token=exposed)


@router.post("/reset-password", response_model=TokenOut)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_session)) -> TokenOut:
    user_id = decode_reset_token(payload.token)
    user = services.get_user(db, user_id) if user_id else None
    if user is None:
        raise errors.InvalidCredentials("this reset link is invalid or has expired")
    services.set_user_password(db, user, payload.new_password)
    # Sign them straight in with a fresh session token.
    return _token_response(user)
