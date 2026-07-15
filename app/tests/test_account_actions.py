def _patch(client, account_id, **body):
    return client.patch(f"/api/v1/accounts/{account_id}", json=body)


def test_rename_account(client, make_account):
    acct = make_account(client, "Old Name")
    r = _patch(client, acct["id"], holder_name="New Name")
    assert r.status_code == 200
    assert r.json()["holder_name"] == "New Name"


def test_freeze_blocks_transactions_then_unfreeze(client, make_account):
    acct = make_account(client)
    assert _patch(client, acct["id"], status="frozen").json()["status"] == "frozen"

    # frozen account rejects deposits
    d = client.post(f"/api/v1/accounts/{acct['id']}/deposit", json={"amount_cents": 100})
    assert d.status_code == 409
    assert d.json()["error"] == "account_not_active"

    # unfreeze restores it
    assert _patch(client, acct["id"], status="active").json()["status"] == "active"
    assert client.post(
        f"/api/v1/accounts/{acct['id']}/deposit", json={"amount_cents": 100}
    ).status_code == 200


def test_close_requires_zero_balance(client, make_account):
    acct = make_account(client)
    client.post(f"/api/v1/accounts/{acct['id']}/deposit", json={"amount_cents": 500})

    rejected = _patch(client, acct["id"], status="closed")
    assert rejected.status_code == 400
    assert rejected.json()["error"] == "invalid_operation"

    # drain then close
    client.post(f"/api/v1/accounts/{acct['id']}/withdraw", json={"amount_cents": 500})
    assert _patch(client, acct["id"], status="closed").json()["status"] == "closed"


def test_closed_account_is_immutable(client, make_account):
    acct = make_account(client)
    _patch(client, acct["id"], status="closed")
    r = _patch(client, acct["id"], holder_name="Nope")
    assert r.status_code == 400
    assert r.json()["error"] == "invalid_operation"


def test_cannot_update_another_users_account(client, make_account, register):
    acct = make_account(client)
    b_token = register(client, email="b@example.com")["access_token"]
    r = client.patch(
        f"/api/v1/accounts/{acct['id']}",
        json={"holder_name": "Hacked"},
        headers={"Authorization": f"Bearer {b_token}"},
    )
    assert r.status_code == 404
