from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_db_health_returns_ok():
    r = client.get("/api/db-health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["db"] == "saxhero_db"
