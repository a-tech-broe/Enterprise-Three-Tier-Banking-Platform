def test_register_returns_token_and_user(anon_client):
    r = anon_client.post(
        "/api/v1/auth/register",
        json={"email": "Ada@Example.com", "full_name": "Ada Lovelace", "password": "hunter2secret"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == "ada@example.com"  # normalised to lowercase
    assert body["user"]["role"] == "user"


def test_register_duplicate_email_conflict(anon_client, register):
    register(anon_client, email="dupe@example.com")
    r = anon_client.post(
        "/api/v1/auth/register",
        json={"email": "dupe@example.com", "full_name": "Other", "password": "password123"},
    )
    assert r.status_code == 409
    assert r.json()["error"] == "email_taken"


def test_login_success_and_wrong_password(anon_client, register):
    register(anon_client, email="grace@example.com", password="password123")

    ok = anon_client.post(
        "/api/v1/auth/login", json={"email": "grace@example.com", "password": "password123"}
    )
    assert ok.status_code == 200
    assert ok.json()["access_token"]

    bad = anon_client.post(
        "/api/v1/auth/login", json={"email": "grace@example.com", "password": "wrong"}
    )
    assert bad.status_code == 401
    assert bad.json()["error"] == "invalid_credentials"


def test_me_returns_current_user(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == "owner@example.com"


def test_endpoints_require_auth(anon_client):
    assert anon_client.get("/api/v1/accounts").status_code == 401
    assert anon_client.get("/api/v1/auth/me").status_code == 401
    assert (
        anon_client.post(
            "/api/v1/accounts", json={"holder_name": "X", "currency": "USD"}
        ).status_code
        == 401
    )


def test_accounts_are_isolated_per_user(client, register):
    # user A (the default `client`) owns this account
    acct = client.post("/api/v1/accounts", json={"holder_name": "A", "currency": "USD"}).json()

    # user B must not see or reach it
    b_token = register(client, email="b@example.com")["access_token"]
    b_auth = {"Authorization": f"Bearer {b_token}"}

    assert client.get("/api/v1/accounts", headers=b_auth).json() == []
    assert client.get(f"/api/v1/accounts/{acct['id']}", headers=b_auth).status_code == 404
    assert (
        client.post(
            f"/api/v1/accounts/{acct['id']}/deposit",
            json={"amount_cents": 100},
            headers=b_auth,
        ).status_code
        == 404
    )
