"""Banking domain services.

Invariants enforced here:
  * Money is integer cents; balances never go negative (overdraft prevention).
  * Transfers debit and credit atomically within one DB transaction.
  * Idempotency keys make retried mutations safe (same key → original result).
  * Only active accounts can transact.
"""
from __future__ import annotations

import datetime as dt

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from . import errors, security
from .models import Account, AccountStatus, Transaction, TxnType, User


# --- Users / auth ----------------------------------------------------------
def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.strip().lower()))


def register_user(db: Session, email: str, full_name: str, password: str) -> User:
    email = email.strip().lower()
    if get_user_by_email(db, email) is not None:
        raise errors.EmailAlreadyRegistered("that email is already registered")
    user = User(
        email=email,
        full_name=full_name.strip(),
        password_hash=security.hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db, email)
    if user is None or not security.verify_password(password, user.password_hash):
        raise errors.InvalidCredentials("incorrect email or password")
    return user


def get_user(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def set_user_password(db: Session, user: User, new_password: str) -> User:
    user.password_hash = security.hash_password(new_password)
    db.commit()
    db.refresh(user)
    return user


# --- Accounts --------------------------------------------------------------
def create_account(
    db: Session, owner_id: str, holder_name: str, currency: str = "USD"
) -> Account:
    account = Account(
        user_id=owner_id, holder_name=holder_name, currency=currency.upper(), balance_cents=0
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def get_account(db: Session, account_id: str, owner_id: str | None = None) -> Account:
    account = db.get(Account, account_id)
    # Return 404 (not 403) for someone else's account so ownership can't be probed.
    if account is None or (owner_id is not None and account.user_id != owner_id):
        raise errors.AccountNotFound(f"account {account_id} not found")
    return account


def update_account(
    db: Session,
    account_id: str,
    owner_id: str,
    holder_name: str | None = None,
    status: AccountStatus | None = None,
) -> Account:
    account = get_account(db, account_id, owner_id)
    if account.status == AccountStatus.closed:
        raise errors.InvalidOperation("a closed account cannot be modified")
    if holder_name is not None:
        account.holder_name = holder_name.strip()
    if status is not None and status != account.status:
        if status == AccountStatus.closed and account.balance_cents != 0:
            raise errors.InvalidOperation("account must have a zero balance to close")
        account.status = status
    db.commit()
    db.refresh(account)
    return account


def list_accounts(
    db: Session, owner_id: str, limit: int = 100, offset: int = 0
) -> list[Account]:
    stmt = (
        select(Account)
        .where(Account.user_id == owner_id)
        .order_by(Account.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt))


def list_transactions(
    db: Session,
    account_id: str,
    owner_id: str,
    limit: int = 100,
    start: dt.date | None = None,
    end: dt.date | None = None,
    query: str | None = None,
) -> list[Transaction]:
    get_account(db, account_id, owner_id)  # 404 if missing or not owned
    stmt = select(Transaction).where(Transaction.account_id == account_id)
    if start is not None:
        stmt = stmt.where(Transaction.created_at >= dt.datetime.combine(start, dt.time.min))
    if end is not None:
        stmt = stmt.where(Transaction.created_at <= dt.datetime.combine(end, dt.time.max))
    if query:
        like = f"%{query.strip()}%"
        # Match the free-text reference or the transaction type (e.g. "deposit").
        stmt = stmt.where(
            or_(Transaction.reference.ilike(like), cast(Transaction.type, String).ilike(like))
        )
    stmt = stmt.order_by(Transaction.created_at.desc()).limit(limit)
    return list(db.scalars(stmt))


def account_insights(db: Session, account_id: str, owner_id: str, months: int = 6) -> dict:
    """Per-account spending insights: monthly in/out plus a by-type breakdown.

    Scoped to one account so everything is a single currency (aggregating across
    currencies would be meaningless). Aggregated in Python to stay portable
    across SQLite (tests) and PostgreSQL.
    """
    account = get_account(db, account_id, owner_id)
    txns = list(db.scalars(select(Transaction).where(Transaction.account_id == account_id)))

    inflow_types = {TxnType.deposit, TxnType.transfer_in}
    by_type: dict[TxnType, list[int]] = {t: [0, 0] for t in TxnType}  # [total_cents, count]
    monthly: dict[str, list[int]] = {}  # "YYYY-MM" -> [in, out]
    total_in = total_out = 0

    for t in txns:
        by_type[t.type][0] += t.amount_cents
        by_type[t.type][1] += 1
        bucket = monthly.setdefault(t.created_at.strftime("%Y-%m"), [0, 0])
        if t.type in inflow_types:
            total_in += t.amount_cents
            bucket[0] += t.amount_cents
        else:
            total_out += t.amount_cents
            bucket[1] += t.amount_cents

    # Continuous last-N-months series (fill empty months with zeros).
    today = dt.date.today()
    year, month = today.year, today.month
    keys: list[str] = []
    for _ in range(months):
        keys.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    keys.reverse()

    series = [
        {"month": k, "in_cents": monthly.get(k, [0, 0])[0], "out_cents": monthly.get(k, [0, 0])[1]}
        for k in keys
    ]
    return {
        "currency": account.currency,
        "total_in_cents": total_in,
        "total_out_cents": total_out,
        "net_cents": total_in - total_out,
        "monthly": series,
        "by_type": [
            {"type": t, "total_cents": by_type[t][0], "count": by_type[t][1]} for t in TxnType
        ],
    }


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
    owner_id: str,
    reference: str | None = None,
    idempotency_key: str | None = None,
) -> Transaction:
    if amount_cents <= 0:
        raise errors.InvalidOperation("amount must be positive")

    existing = _existing_by_key(db, idempotency_key)
    if existing:
        return existing

    account = get_account(db, account_id, owner_id)
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
    owner_id: str,
    reference: str | None = None,
    idempotency_key: str | None = None,
) -> Transaction:
    if amount_cents <= 0:
        raise errors.InvalidOperation("amount must be positive")

    existing = _existing_by_key(db, idempotency_key)
    if existing:
        return existing

    account = get_account(db, account_id, owner_id)
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
    owner_id: str,
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

    # Both legs must belong to the caller (internal transfers between own accounts).
    src = get_account(db, from_account_id, owner_id)
    dst = get_account(db, to_account_id, owner_id)
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


# --- Admin / back-office ---------------------------------------------------
def list_all_accounts(db: Session, limit: int = 500, offset: int = 0) -> list[Account]:
    stmt = select(Account).order_by(Account.created_at.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt))


def list_account_transactions_any(
    db: Session, account_id: str, limit: int = 200
) -> list[Transaction]:
    """Transactions for any account, without an ownership check (admin only)."""
    stmt = (
        select(Transaction)
        .where(Transaction.account_id == account_id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


def admin_stats(db: Session) -> dict:
    balances = db.execute(
        select(Account.currency, func.coalesce(func.sum(Account.balance_cents), 0)).group_by(
            Account.currency
        )
    ).all()
    return {
        "user_count": db.scalar(select(func.count()).select_from(User)) or 0,
        "account_count": db.scalar(select(func.count()).select_from(Account)) or 0,
        "transaction_count": db.scalar(select(func.count()).select_from(Transaction)) or 0,
        "balances_by_currency": [
            {"currency": cur, "total_cents": int(total)} for cur, total in balances
        ],
    }


def reverse_transaction(db: Session, txn_id: str) -> Transaction:
    """Post a compensating entry that undoes a transaction (admin clawback).

    Deposits/withdrawals reverse on their own account; transfers reverse both
    legs (money moves back). Guards against reversing a reversal, double
    reversal, and any reversal that would overdraw an account.
    """
    txn = db.get(Transaction, txn_id)
    if txn is None:
        raise errors.TransactionNotFound(f"transaction {txn_id} not found")
    if txn.reference and txn.reference.startswith("Reversal of "):
        raise errors.InvalidOperation("cannot reverse a reversal")

    if txn.type in (TxnType.deposit, TxnType.withdrawal):
        marker = f"Reversal of {txn.id}"
        _guard_not_reversed(db, marker)
        account = get_account(db, txn.account_id)
        if txn.type == TxnType.deposit:
            if account.balance_cents < txn.amount_cents:
                raise errors.InsufficientFunds("cannot reverse: insufficient balance")
            account.balance_cents -= txn.amount_cents
            rev_type = TxnType.withdrawal
        else:
            account.balance_cents += txn.amount_cents
            rev_type = TxnType.deposit
        rev = Transaction(
            account_id=account.id,
            type=rev_type,
            amount_cents=txn.amount_cents,
            balance_after_cents=account.balance_cents,
            reference=marker,
        )
        db.add(rev)
        db.commit()
        db.refresh(rev)
        return rev

    # Transfer: normalise to the outgoing leg so re-reversal of either leg is caught.
    out_leg = txn if txn.type == TxnType.transfer_out else _paired_out_leg(db, txn)
    if out_leg is None:
        raise errors.InvalidOperation("could not locate the transfer to reverse")
    marker = f"Reversal of {out_leg.id}"
    _guard_not_reversed(db, marker)

    src = get_account(db, out_leg.account_id)  # originally debited
    dst = get_account(db, out_leg.counterparty_account_id)  # originally credited
    if dst.balance_cents < out_leg.amount_cents:
        raise errors.InsufficientFunds("cannot reverse: recipient has insufficient balance")
    dst.balance_cents -= out_leg.amount_cents
    src.balance_cents += out_leg.amount_cents
    debit = Transaction(
        account_id=dst.id,
        type=TxnType.transfer_out,
        amount_cents=out_leg.amount_cents,
        balance_after_cents=dst.balance_cents,
        counterparty_account_id=src.id,
        reference=marker,
    )
    credit = Transaction(
        account_id=src.id,
        type=TxnType.transfer_in,
        amount_cents=out_leg.amount_cents,
        balance_after_cents=src.balance_cents,
        counterparty_account_id=dst.id,
        reference=marker,
    )
    db.add_all([debit, credit])
    db.commit()
    db.refresh(debit)
    return debit


def _guard_not_reversed(db: Session, marker: str) -> None:
    if db.scalar(select(Transaction).where(Transaction.reference == marker)):
        raise errors.InvalidOperation("transaction already reversed")


def _paired_out_leg(db: Session, credit: Transaction) -> Transaction | None:
    return db.scalar(
        select(Transaction).where(
            Transaction.type == TxnType.transfer_out,
            Transaction.account_id == credit.counterparty_account_id,
            Transaction.counterparty_account_id == credit.account_id,
            Transaction.amount_cents == credit.amount_cents,
        )
    )
