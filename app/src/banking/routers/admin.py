"""Back-office endpoints. Every route requires an administrator."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import services
from ..database import get_session
from ..deps import require_admin
from ..models import User
from ..schemas import AdminAccountOut, AdminStatsOut, TransactionOut

router = APIRouter(prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/stats", response_model=AdminStatsOut)
def stats(db: Session = Depends(get_session)) -> AdminStatsOut:
    return AdminStatsOut.model_validate(services.admin_stats(db))


@router.get("/accounts", response_model=list[AdminAccountOut])
def all_accounts(
    db: Session = Depends(get_session),
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[AdminAccountOut]:
    accounts = services.list_all_accounts(db, limit, offset)
    return [
        AdminAccountOut(
            id=a.id,
            holder_name=a.holder_name,
            currency=a.currency,
            balance_cents=a.balance_cents,
            status=a.status,
            created_at=a.created_at,
            owner_id=a.user_id,
            owner_email=a.owner.email,
            owner_name=a.owner.full_name,
        )
        for a in accounts
    ]


@router.get("/accounts/{account_id}/transactions", response_model=list[TransactionOut])
def account_transactions(
    account_id: str,
    db: Session = Depends(get_session),
    limit: int = Query(default=200, ge=1, le=500),
) -> list[TransactionOut]:
    txns = services.list_account_transactions_any(db, account_id, limit)
    return [TransactionOut.model_validate(t) for t in txns]


@router.post("/transactions/{txn_id}/reverse", response_model=TransactionOut)
def reverse_transaction(
    txn_id: str,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> TransactionOut:
    rev = services.reverse_transaction(db, txn_id)
    return TransactionOut.model_validate(rev)
