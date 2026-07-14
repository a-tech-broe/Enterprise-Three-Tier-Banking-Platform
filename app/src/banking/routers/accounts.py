"""Account and per-account transaction endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from .. import services
from ..database import get_session
from ..schemas import (
    AccountCreate,
    AccountOut,
    MoneyOp,
    TransactionOut,
)

router = APIRouter(prefix="/api/v1/accounts", tags=["accounts"])


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(payload: AccountCreate, db: Session = Depends(get_session)) -> AccountOut:
    account = services.create_account(db, payload.holder_name, payload.currency)
    return AccountOut.model_validate(account)


@router.get("", response_model=list[AccountOut])
def list_accounts(
    db: Session = Depends(get_session),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[AccountOut]:
    return [AccountOut.model_validate(a) for a in services.list_accounts(db, limit, offset)]


@router.get("/{account_id}", response_model=AccountOut)
def get_account(account_id: str, db: Session = Depends(get_session)) -> AccountOut:
    return AccountOut.model_validate(services.get_account(db, account_id))


@router.post("/{account_id}/deposit", response_model=TransactionOut)
def deposit(account_id: str, op: MoneyOp, db: Session = Depends(get_session)) -> TransactionOut:
    txn = services.deposit(db, account_id, op.amount_cents, op.reference, op.idempotency_key)
    return TransactionOut.model_validate(txn)


@router.post("/{account_id}/withdraw", response_model=TransactionOut)
def withdraw(account_id: str, op: MoneyOp, db: Session = Depends(get_session)) -> TransactionOut:
    txn = services.withdraw(db, account_id, op.amount_cents, op.reference, op.idempotency_key)
    return TransactionOut.model_validate(txn)


@router.get("/{account_id}/transactions", response_model=list[TransactionOut])
def list_transactions(
    account_id: str,
    db: Session = Depends(get_session),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[TransactionOut]:
    txns = services.list_transactions(db, account_id, limit)
    return [TransactionOut.model_validate(t) for t in txns]
