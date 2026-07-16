def test_forgot_password_returns_token_for_known_email(anon_client, register):
    register(anon_client, email="ada@example.com", password="password123")
    r = anon_client.post("/api/v1/auth/forgot-password", json={"email": "ada@example.com"})
    assert r.status_code == 200
    assert r.json()["reset_token"]  # exposed in the demo config


def test_forgot_password_does_not_enumerate(anon_client):
    r = anon_client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 200
    assert r.json()["reset_token"] is None
    # same generic message either way


def test_reset_password_flow(anon_client, register):
    register(anon_client, email="grace@example.com", password="oldpassword1")
    token = anon_client.post(
        "/api/v1/auth/forgot-password", json={"email": "grace@example.com"}
    ).json()["reset_token"]

    reset = anon_client.post(
        "/api/v1/auth/reset-password", json={"token": token, "new_password": "brandnewpass1"}
    )
    assert reset.status_code == 200
    assert reset.json()["access_token"]  # signed straight in

    # old password no longer works, new one does
    assert anon_client.post(
        "/api/v1/auth/login", json={"email": "grace@example.com", "password": "oldpassword1"}
    ).status_code == 401
    assert anon_client.post(
        "/api/v1/auth/login", json={"email": "grace@example.com", "password": "brandnewpass1"}
    ).status_code == 200


def test_reset_password_rejects_bad_token(anon_client):
    r = anon_client.post(
        "/api/v1/auth/reset-password",
        json={"token": "not-a-real-token", "new_password": "whatever12"},
    )
    assert r.status_code == 401


def test_access_token_cannot_be_used_to_reset(anon_client, register):
    # a normal session token must not double as a reset token
    access = register(anon_client, email="z@example.com")["access_token"]
    r = anon_client.post(
        "/api/v1/auth/reset-password", json={"token": access, "new_password": "password999"}
    )
    assert r.status_code == 401
