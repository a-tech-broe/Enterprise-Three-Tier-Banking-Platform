"""Pydantic request/response models."""
from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict, Field

from .models import AccountStatus, TxnType


class AccountCreate(BaseModel):
    holder_name: str = Field(min_length=1, max_length=120)
    currency: str = Field(default="USD", min_length=3, max_length=3)


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


class HealthOut(BaseModel):
    status: str
    service: str
    environment: str


class ReadyOut(BaseModel):
    status: str
    database: str
