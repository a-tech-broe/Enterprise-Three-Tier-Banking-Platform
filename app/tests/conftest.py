"""Test fixtures: a fresh in-memory SQLite DB + TestClient per test."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from banking import database
from banking.main import create_app


@pytest.fixture()
def client(monkeypatch) -> TestClient:
    # Force a clean in-memory database for each test.
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENVIRONMENT", "test")
    database.init_engine("sqlite+pysqlite:///:memory:")
    database.create_all()
    app = create_app()
    with TestClient(app) as c:
        yield c


def _new_account(client: TestClient, name: str = "Alice", currency: str = "USD") -> dict:
    resp = client.post("/api/v1/accounts", json={"holder_name": name, "currency": currency})
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture()
def make_account():
    return _new_account
