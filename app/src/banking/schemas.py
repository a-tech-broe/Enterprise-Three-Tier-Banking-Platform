"""Pydantic request/response models."""
from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import AccountStatus, TxnType, UserRole


class UserRegister(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str
    role: UserRole
    created_at: dt.datetime
    # Effective admin status (role == admin OR email in ADMIN_EMAILS).
    is_admin: bool = False


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    # Demo only: the reset token (normally emailed). None in production.
    reset_token: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class AdminAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    holder_name: str
    currency: str
    balance_cents: int
    status: AccountStatus
    created_at: dt.datetime
    owner_id: str
    owner_email: EmailStr
    owner_name: str


class CurrencyBalance(BaseModel):
    currency: str
    total_cents: int


class AdminStatsOut(BaseModel):
    user_count: int
    account_count: int
    transaction_count: int
    balances_by_currency: list[CurrencyBalance]


class AccountCreate(BaseModel):
    holder_name: str = Field(min_length=1, max_length=120)
    currency: str = Field(default="USD", min_length=3, max_length=3)


class AccountUpdate(BaseModel):
    """Rename and/or change status (freeze/unfreeze/close)."""

    holder_name: str | None = Field(default=None, min_length=1, max_length=120)
    status: AccountStatus | None = None


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    holder_name: str
    currency: str
    balance_cents: int
    status: AccountStatus
    created_at: dt.datetime


class MoneyOp(BaseModel):
    """Deposit or withdrawal."""

    amount_cents: int = Field(gt=0, description="Positive integer minor units (cents).")
    reference: str | None = Field(default=None, max_length=140)
    idempotency_key: str | None = Field(default=None, max_length=64)


class TransferCreate(BaseModel):
    from_account_id: str
    to_account_id: str
    amount_cents: int = Field(gt=0)
    reference: str | None = Field(default=None, max_length=140)
    idempotency_key: str | None = Field(default=None, max_length=64)


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_id: str
    type: TxnType
    amount_cents: int
    balance_after_cents: int
    counterparty_account_id: str | None
    reference: str | None
    created_at: dt.datetime


class MonthlyPoint(BaseModel):
    month: str  # "YYYY-MM"
    in_cents: int
    out_cents: int


class TypeBreakdown(BaseModel):
    type: TxnType
    total_cents: int
    count: int


class InsightsOut(BaseModel):
    currency: str
    total_in_cents: int
    total_out_cents: int
    net_cents: int
    monthly: list[MonthlyPoint]
    by_type: list[TypeBreakdown]


class HealthOut(BaseModel):
    status: str
    service: str
    environment: str


class ReadyOut(BaseModel):
    status: str
    database: str
