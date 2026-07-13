"""Banking domain services.

Invariants enforced here:
  * Money is integer cents; balances never go negative (overdraft prevention).
  * Transfers debit and credit atomically within one DB transaction.
  * Idempotency keys make retried mutations safe (same key → original result).
  * Only active accounts can transact.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import errors
from .models import Account, AccountStatus, Transaction, TxnType


def create_account(db: Session, holder_name: str, currency: str = "USD") -> Account:
    account = Account(holder_name=holder_name, currency=currency.upper(), balance_cents=0)
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def get_account(db: Session, account_id: str) -> Account:
    account = db.get(Account, account_id)
    if account is None:
        raise errors.AccountNotFound(f"account {account_id} not found")
    return account


def list_accounts(db: Session, limit: int = 100, offset: int = 0) -> list[Account]:
    stmt = select(Account).order_by(Account.created_at.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt))


def list_transactions(db: Session, account_id: str, limit: int = 100) -> list[Transaction]:
    get_account(db, account_id)  # 404 if missing
    stmt = (
        select(Transaction)
        .where(Transaction.account_id == account_id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


def _existing_by_key(db: Session, key: str | None) -> Transaction | None:
    if not key:
        return None
    return db.scalar(select(Transaction).where(Transaction.idempotency_key == key))


def _require_active(account: Account) -> None:
    if account.status != AccountStatus.active:
        raise errors.AccountNotActive(f"account {account.id} is {account.status.value}")


def deposit(
    db: Session,
    account_id: str,
    amount_cents: int,
    reference: str | None = None,
    idempotency_key: str | None = None,
) -> Transaction:
    if amount_cents <= 0:
        raise errors.InvalidOperation("amount must be positive")

    existing = _existing_by_key(db, idempotency_key)
    if existing:
        return existing

    account = get_account(db, account_id)
    _require_active(account)

    account.balance_cents += amount_cents
    txn = Transaction(
        account_id=account.id,
        type=TxnType.deposit,
        amount_cents=amount_cents,
        balance_after_cents=account.balance_cents,
        reference=reference,
        idempotency_key=idempotency_key,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


def withdraw(
    db: Session,
    account_id: str,
    amount_cents: int,
    reference: str | None = None,
    idempotency_key: str | None = None,
) -> Transaction:
    if amount_cents <= 0:
        raise errors.InvalidOperation("amount must be positive")

    existing = _existing_by_key(db, idempotency_key)
    if existing:
        return existing

    account = get_account(db, account_id)
    _require_active(account)
    if account.balance_cents < amount_cents:
        raise errors.InsufficientFunds("insufficient funds")

    account.balance_cents -= amount_cents
    txn = Transaction(
        account_id=account.id,
        type=TxnType.withdrawal,
        amount_cents=amount_cents,
        balance_after_cents=account.balance_cents,
        reference=reference,
        idempotency_key=idempotency_key,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


def transfer(
    db: Session,
    from_account_id: str,
    to_account_id: str,
    amount_cents: int,
    reference: str | None = None,
    idempotency_key: str | None = None,
) -> tuple[Transaction, Transaction]:
    if amount_cents <= 0:
        raise errors.InvalidOperation("amount must be positive")
    if from_account_id == to_account_id:
        raise errors.InvalidOperation("cannot transfer to the same account")

    existing = _existing_by_key(db, idempotency_key)
    if existing:
        # Return the debit + its paired credit for the original transfer.
        credit = db.scalar(
            select(Transaction).where(
                Transaction.account_id == existing.counterparty_account_id,
                Transaction.type == TxnType.transfer_in,
                Transaction.amount_cents == existing.amount_cents,
            )
        )
        return existing, credit  # type: ignore[return-value]

    src = get_account(db, from_account_id)
    dst = get_account(db, to_account_id)
    _require_active(src)
    _require_active(dst)
    if src.currency != dst.currency:
        raise errors.CurrencyMismatch("accounts have different currencies")
    if src.balance_cents < amount_cents:
        raise errors.InsufficientFunds("insufficient funds")

    src.balance_cents -= amount_cents
    dst.balance_cents += amount_cents

    debit = Transaction(
        account_id=src.id,
        type=TxnType.transfer_out,
        amount_cents=amount_cents,
        balance_after_cents=src.balance_cents,
        counterparty_account_id=dst.id,
        reference=reference,
        idempotency_key=idempotency_key,
    )
    credit = Transaction(
        account_id=dst.id,
        type=TxnType.transfer_in,
        amount_cents=amount_cents,
        balance_after_cents=dst.balance_cents,
        counterparty_account_id=src.id,
        reference=reference,
    )
    db.add_all([debit, credit])
    db.commit()  # single transaction: both legs commit or neither does
    db.refresh(debit)
    db.refresh(credit)
    return debit, credit
