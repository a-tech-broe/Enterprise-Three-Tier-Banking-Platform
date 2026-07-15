"""Inter-account transfers."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from .. import services
from ..database import get_session
from ..deps import get_current_user
from ..models import User
from ..schemas import TransactionOut, TransferCreate

router = APIRouter(prefix="/api/v1/transfers", tags=["transfers"])


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transfer(
    payload: TransferCreate,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> TransactionOut:
    debit, _credit = services.transfer(
        db,
        user.id,
        payload.from_account_id,
        payload.to_account_id,
        payload.amount_cents,
        payload.reference,
        payload.idempotency_key,
    )
    # Return the debit leg (the payer's view of the transfer).
    return TransactionOut.model_validate(debit)
