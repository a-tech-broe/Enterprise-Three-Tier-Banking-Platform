"""Account and per-account transaction endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from .. import services
from ..database import get_session
from ..deps import get_current_user
from ..models import User
from ..schemas import (
    AccountCreate,
    AccountOut,
    AccountUpdate,
    MoneyOp,
    TransactionOut,
)

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(
    payload: AccountCreate,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> AccountOut:
    account = services.create_account(db, user.id, payload.holder_name, payload.currency)
    return AccountOut.model_validate(account)


@router.get("", response_model=list[AccountOut])
def list_accounts(
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[AccountOut]:
    accounts = services.list_accounts(db, user.id, limit, offset)
    return [AccountOut.model_validate(a) for a in accounts]


@router.get("/{account_id}", response_model=AccountOut)
def get_account(
    account_id: str,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> AccountOut:
    return AccountOut.model_validate(services.get_account(db, account_id, user.id))


@router.patch("/{account_id}", response_model=AccountOut)
def update_account(
    account_id: str,
    payload: AccountUpdate,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> AccountOut:
    account = services.update_account(
        db, account_id, user.id, payload.holder_name, payload.status
    )
    return AccountOut.model_validate(account)


@router.post("/{account_id}/deposit", response_model=TransactionOut)
def deposit(
    account_id: str,
    op: MoneyOp,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> TransactionOut:
    txn = services.deposit(
        db, account_id, op.amount_cents, user.id, op.reference, op.idempotency_key
    )
    return TransactionOut.model_validate(txn)


@router.post("/{account_id}/withdraw", response_model=TransactionOut)
def withdraw(
    account_id: str,
    op: MoneyOp,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> TransactionOut:
    txn = services.withdraw(
        db, account_id, op.amount_cents, user.id, op.reference, op.idempotency_key
    )
    return TransactionOut.model_validate(txn)


@router.get("/{account_id}/transactions", response_model=list[TransactionOut])
def list_transactions(
    account_id: str,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[TransactionOut]:
    txns = services.list_transactions(db, account_id, user.id, limit)
    return [TransactionOut.model_validate(t) for t in txns]
