def _seed(client, make_account):
    acct = make_account(client)
    client.post(
        f"/api/v1/accounts/{acct['id']}/deposit",
        json={"amount_cents": 5000, "reference": "Salary"},
    )
    client.post(
        f"/api/v1/accounts/{acct['id']}/withdraw",
        json={"amount_cents": 300, "reference": "Coffee"},
    )
    return acct


def test_search_by_reference(client, make_account):
    acct = _seed(client, make_account)
    r = client.get(f"/api/v1/accounts/{acct['id']}/transactions", params={"q": "salary"})
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["reference"] == "Salary"


def test_search_by_type(client, make_account):
    acct = _seed(client, make_account)
    r = client.get(f"/api/v1/accounts/{acct['id']}/transactions", params={"q": "withdraw"})
    assert [t["type"] for t in r.json()] == ["withdrawal"]


def test_date_range_filters(client, make_account):
    acct = _seed(client, make_account)
    # nothing in the far future
    future = client.get(
        f"/api/v1/accounts/{acct['id']}/transactions", params={"start": "2999-01-01"}
    )
    assert future.json() == []
    # nothing on/before the distant past
    past = client.get(
        f"/api/v1/accounts/{acct['id']}/transactions", params={"end": "2000-01-01"}
    )
    assert past.json() == []


def test_statement_csv_export(client, make_account):
    acct = _seed(client, make_account)
    r = client.get(f"/api/v1/accounts/{acct['id']}/statement.csv")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers["content-disposition"]
    body = r.text
    assert body.splitlines()[0] == "date,type,amount,currency,balance_after,reference,counterparty"
    assert "Salary" in body
    assert "Coffee" in body


def test_statement_csv_requires_ownership(client, make_account, register):
    acct = _seed(client, make_account)
    b_token = register(client, email="b@example.com")["access_token"]
    r = client.get(
        f"/api/v1/accounts/{acct['id']}/statement.csv",
        headers={"Authorization": f"Bearer {b_token}"},
    )
    assert r.status_code == 404
