def test_create_and_get_account(client, make_account):
    acct = make_account(client, "Alice")
    assert acct["balance_cents"] == 0
    assert acct["status"] == "active"

    r = client.get(f"/api/v1/accounts/{acct['id']}")
    assert r.status_code == 200
    assert r.json()["holder_name"] == "Alice"


def test_get_missing_account_404(client):
    r = client.get("/api/v1/accounts/does-not-exist")
    assert r.status_code == 404
    assert r.json()["error"] == "account_not_found"


def test_list_accounts(client, make_account):
    make_account(client, "Alice")
    make_account(client, "Bob")
    r = client.get("/api/v1/accounts")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_deposit_increases_balance(client, make_account):
    acct = make_account(client)
    r = client.post(f"/api/v1/accounts/{acct['id']}/deposit", json={"amount_cents": 5000})
    assert r.status_code == 200
    assert r.json()["balance_after_cents"] == 5000

    r = client.get(f"/api/v1/accounts/{acct['id']}")
    assert r.json()["balance_cents"] == 5000


def test_withdraw_decreases_balance(client, make_account):
    acct = make_account(client)
    client.post(f"/api/v1/accounts/{acct['id']}/deposit", json={"amount_cents": 5000})
    r = client.post(f"/api/v1/accounts/{acct['id']}/withdraw", json={"amount_cents": 2000})
    assert r.status_code == 200
    assert r.json()["balance_after_cents"] == 3000


def test_withdraw_overdraft_rejected(client, make_account):
    acct = make_account(client)
    client.post(f"/api/v1/accounts/{acct['id']}/deposit", json={"amount_cents": 1000})
    r = client.post(f"/api/v1/accounts/{acct['id']}/withdraw", json={"amount_cents": 5000})
    assert r.status_code == 422
    assert r.json()["error"] == "insufficient_funds"
    # balance unchanged
    assert client.get(f"/api/v1/accounts/{acct['id']}").json()["balance_cents"] == 1000


def test_deposit_rejects_non_positive(client, make_account):
    acct = make_account(client)
    r = client.post(f"/api/v1/accounts/{acct['id']}/deposit", json={"amount_cents": 0})
    assert r.status_code == 422  # pydantic gt=0 validation


def test_deposit_idempotency(client, make_account):
    acct = make_account(client)
    body = {"amount_cents": 1000, "idempotency_key": "abc-123"}
    r1 = client.post(f"/api/v1/accounts/{acct['id']}/deposit", json=body)
    r2 = client.post(f"/api/v1/accounts/{acct['id']}/deposit", json=body)
    assert r1.json()["id"] == r2.json()["id"]  # same transaction returned
    assert client.get(f"/api/v1/accounts/{acct['id']}").json()["balance_cents"] == 1000
