def _fund(client, account_id, cents):
    client.post(f"/api/v1/accounts/{account_id}/deposit", json={"amount_cents": cents})


def test_transfer_moves_money(client, make_account):
    a = make_account(client, "Alice")
    b = make_account(client, "Bob")
    _fund(client, a["id"], 10000)

    r = client.post(
        "/api/v1/transfers",
        json={"from_account_id": a["id"], "to_account_id": b["id"], "amount_cents": 4000},
    )
    assert r.status_code == 201
    assert r.json()["type"] == "transfer_out"
    assert r.json()["balance_after_cents"] == 6000

    assert client.get(f"/api/v1/accounts/{a['id']}").json()["balance_cents"] == 6000
    assert client.get(f"/api/v1/accounts/{b['id']}").json()["balance_cents"] == 4000


def test_transfer_overdraft_is_atomic(client, make_account):
    a = make_account(client, "Alice")
    b = make_account(client, "Bob")
    _fund(client, a["id"], 1000)

    r = client.post(
        "/api/v1/transfers",
        json={"from_account_id": a["id"], "to_account_id": b["id"], "amount_cents": 5000},
    )
    assert r.status_code == 422
    assert r.json()["error"] == "insufficient_funds"
    # neither balance changed
    assert client.get(f"/api/v1/accounts/{a['id']}").json()["balance_cents"] == 1000
    assert client.get(f"/api/v1/accounts/{b['id']}").json()["balance_cents"] == 0


def test_transfer_same_account_rejected(client, make_account):
    a = make_account(client)
    _fund(client, a["id"], 1000)
    r = client.post(
        "/api/v1/transfers",
        json={"from_account_id": a["id"], "to_account_id": a["id"], "amount_cents": 100},
    )
    assert r.status_code == 400
    assert r.json()["error"] == "invalid_operation"


def test_transfer_currency_mismatch_rejected(client, make_account):
    a = make_account(client, "Alice", currency="USD")
    b = make_account(client, "Bob", currency="EUR")
    _fund(client, a["id"], 5000)
    r = client.post(
        "/api/v1/transfers",
        json={"from_account_id": a["id"], "to_account_id": b["id"], "amount_cents": 1000},
    )
    assert r.status_code == 422
    assert r.json()["error"] == "currency_mismatch"


def test_transfer_idempotency(client, make_account):
    a = make_account(client, "Alice")
    b = make_account(client, "Bob")
    _fund(client, a["id"], 10000)
    body = {
        "from_account_id": a["id"],
        "to_account_id": b["id"],
        "amount_cents": 3000,
        "idempotency_key": "txf-1",
    }
    client.post("/api/v1/transfers", json=body)
    client.post("/api/v1/transfers", json=body)  # retry
    # money moved exactly once
    assert client.get(f"/api/v1/accounts/{a['id']}").json()["balance_cents"] == 7000
    assert client.get(f"/api/v1/accounts/{b['id']}").json()["balance_cents"] == 3000
