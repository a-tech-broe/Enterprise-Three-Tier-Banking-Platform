"""SQLAlchemy engine/session wiring."""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import get_settings
from .models import Base

_engine = None
_SessionLocal: sessionmaker[Session] | None = None


def _engine_kwargs(url: str) -> dict:
    if url.startswith("sqlite"):
        kwargs: dict = {"connect_args": {"check_same_thread": False}}
        # In-memory SQLite is per-connection; a StaticPool keeps one shared
        # connection so tables created at startup are visible to every request.
        if ":memory:" in url:
            kwargs["poolclass"] = StaticPool
        return kwargs
    return {"pool_pre_ping": True}


def init_engine(database_url: str | None = None):
    """Build the engine + sessionmaker and ensure tables exist.

    The module globals are only assigned after `create_all` succeeds, so a
    failed attempt (DB briefly unreachable, credentials not yet available)
    leaves `_SessionLocal` as None and is retried on the next call instead of
    parking the app in a half-initialised state with no tables.
    """
    global _engine, _SessionLocal
    url = database_url or get_settings().resolve_database_url()
    engine = create_engine(url, future=True, **_engine_kwargs(url))
    # Connects to the database; raises if it is unreachable.
    Base.metadata.create_all(bind=engine)
    _engine = engine
    _SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    return _engine


def create_all() -> None:
    """Create tables. Real deployments should use migrations; this keeps the
    reference app self-contained. `init_engine` already does this — retained so
    existing callers/tests keep working."""
    if _engine is None:
        init_engine()
    else:
        Base.metadata.create_all(bind=_engine)


def get_session() -> Iterator[Session]:
    # Retries initialisation each call until the DB is reachable, so the app
    # self-heals once connectivity/credentials are restored (no restart needed).
    if _SessionLocal is None:
        init_engine()
    assert _SessionLocal is not None
    session = _SessionLocal()
    try:
        yield session
    finally:
        session.close()
