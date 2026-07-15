import datetime as dt


def _seed(client, make_account):
    acct = make_account(client, currency="USD")
    client.post(f"/api/v1/accounts/{acct['id']}/deposit", json={"amount_cents": 5000})
    client.post(f"/api/v1/accounts/{acct['id']}/withdraw", json={"amount_cents": 300})
    return acct


def test_insights_totals_and_breakdown(client, make_account):
    acct = _seed(client, make_account)
    r = client.get(f"/api/v1/accounts/{acct['id']}/insights")
    assert r.status_code == 200
    body = r.json()

    assert body["currency"] == "USD"
    assert body["total_in_cents"] == 5000
    assert body["total_out_cents"] == 300
    assert body["net_cents"] == 4700

    by_type = {b["type"]: b for b in body["by_type"]}
    assert by_type["deposit"]["total_cents"] == 5000
    assert by_type["deposit"]["count"] == 1
    assert by_type["withdrawal"]["total_cents"] == 300
    assert by_type["transfer_in"]["count"] == 0


def test_insights_monthly_series(client, make_account):
    acct = _seed(client, make_account)
    r = client.get(f"/api/v1/accounts/{acct['id']}/insights", params={"months": 3})
    months = r.json()["monthly"]
    assert len(months) == 3
    # the current month carries this account's activity
    this_month = dt.date.today().strftime("%Y-%m")
    current = next(m for m in months if m["month"] == this_month)
    assert current["in_cents"] == 5000
    assert current["out_cents"] == 300


def test_insights_requires_ownership(client, make_account, register):
    acct = _seed(client, make_account)
    b_token = register(client, email="b@example.com")["access_token"]
    r = client.get(
        f"/api/v1/accounts/{acct['id']}/insights",
        headers={"Authorization": f"Bearer {b_token}"},
    )
    assert r.status_code == 404
