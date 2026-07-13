def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "banking-platform-api"


def test_ready(client):
    r = client.get("/health/ready")
    assert r.status_code == 200
    assert r.json()["database"] == "up"


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["service"] == "banking-platform-api"
