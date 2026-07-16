"""Test fixtures: a fresh in-memory SQLite DB + TestClient per test.

`anon_client` is unauthenticated; `client` is authenticated as a default user
(so the existing account/transfer tests keep working unchanged).
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from banking import database
from banking.config import get_settings
from banking.main import create_app


@pytest.fixture()
def app(monkeypatch):
    # Force a clean in-memory database for each test.
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("JWT_SECRET", "test-secret-that-is-at-least-32-bytes-long")
    get_settings.cache_clear()  # pick up this test's env, not a prior test's
    database.init_engine("sqlite+pysqlite:///:memory:")
    return create_app()


@pytest.fixture()
def anon_client(app) -> TestClient:
    with TestClient(app) as c:
        yield c


def _register(
    client: TestClient,
    email: str = "owner@example.com",
    full_name: str = "Owner",
    password: str = "password123",
) -> dict:
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": full_name, "password": password},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture()
def register():
    return _register


@pytest.fixture()
def client(anon_client: TestClient) -> TestClient:
    # Authenticate as a default user for convenience.
    token = _register(anon_client)["access_token"]
    anon_client.headers["Authorization"] = f"Bearer {token}"
    return anon_client


def _new_account(client: TestClient, name: str = "Alice", currency: str = "USD") -> dict:
    resp = client.post("/api/v1/accounts", json={"holder_name": name, "currency": currency})
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture()
def make_account():
    return _new_account
