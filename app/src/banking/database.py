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
    global _engine, _SessionLocal
    url = database_url or get_settings().resolve_database_url()
    _engine = create_engine(url, future=True, **_engine_kwargs(url))
    _SessionLocal = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False)
    return _engine


def create_all() -> None:
    """Create tables. Real deployments should use migrations; this keeps the
    reference app self-contained."""
    if _engine is None:
        init_engine()
    Base.metadata.create_all(bind=_engine)


def get_session() -> Iterator[Session]:
    if _SessionLocal is None:
        init_engine()
    assert _SessionLocal is not None
    session = _SessionLocal()
    try:
        yield session
    finally:
        session.close()
