from sqlalchemy import select

from banking import database, models


def _promote(email: str) -> None:
    for db in database.get_session():
        user = db.scalar(select(models.User).where(models.User.email == email))
        user.role = models.UserRole.admin
        db.commit()


def _admin_auth(client, register) -> dict:
    tok = register(client, email="admin@example.com", full_name="Admin")["access_token"]
    _promote("admin@example.com")
    return {"Authorization": f"Bearer {tok}"}


def test_admin_endpoints_require_admin(client):
    # the default (non-admin) user is forbidden
    assert client.get("/api/v1/admin/accounts").status_code == 403
    assert client.get("/api/v1/admin/stats").status_code == 403


def test_admin_lists_all_accounts_with_owner(client, make_account, register):
    make_account(client, "Alice")  # owned by the default user
    admin = _admin_auth(client, register)
    r = client.get("/api/v1/admin/accounts", headers=admin)
    assert r.status_code == 200
    rows = r.json()
    assert any(a["owner_email"] == "owner@example.com" for a in rows)
    assert all("owner_name" in a for a in rows)


def test_admin_stats(client, make_account, register):
    a = make_account(client, "Alice")
    client.post(f"/api/v1/accounts/{a['id']}/deposit", json={"amount_cents": 5000})
    admin = _admin_auth(client, register)
    r = client.get("/api/v1/admin/stats", headers=admin).json()
    assert r["account_count"] >= 1
    assert r["user_count"] >= 2
    usd = next(b for b in r["balances_by_currency"] if b["currency"] == "USD")
    assert usd["total_cents"] == 5000


def test_admin_reverses_a_deposit(client, make_account, register):
    acct = make_account(client)
    dep = client.post(
        f"/api/v1/accounts/{acct['id']}/deposit", json={"amount_cents": 5000}
    ).json()
    admin = _admin_auth(client, register)

    r = client.post(f"/api/v1/admin/transactions/{dep['id']}/reverse", headers=admin)
    assert r.status_code == 200
    assert r.json()["type"] == "withdrawal"
    # balance clawed back to zero
    assert client.get(f"/api/v1/accounts/{acct['id']}").json()["balance_cents"] == 0

    # cannot reverse twice
    again = client.post(f"/api/v1/admin/transactions/{dep['id']}/reverse", headers=admin)
    assert again.status_code == 400


def test_admin_reverses_a_transfer_both_legs(client, make_account, register):
    a = make_account(client, "A")
    b = make_account(client, "B")
    client.post(f"/api/v1/accounts/{a['id']}/deposit", json={"amount_cents": 10000})
    xfer = client.post(
        "/api/v1/transfers",
        json={"from_account_id": a["id"], "to_account_id": b["id"], "amount_cents": 4000},
    ).json()

    admin = _admin_auth(client, register)
    r = client.post(f"/api/v1/admin/transactions/{xfer['id']}/reverse", headers=admin)
    assert r.status_code == 200
    # money moved back
    assert client.get(f"/api/v1/accounts/{a['id']}").json()["balance_cents"] == 10000
    assert client.get(f"/api/v1/accounts/{b['id']}").json()["balance_cents"] == 0
