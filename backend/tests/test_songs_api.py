import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

_created_ids = []


def teardown_module():
    for sid in _created_ids:
        client.delete(f"/api/songs/{sid}")


def test_list_songs_returns_list():
    r = client.get("/api/songs/")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_song():
    r = client.post("/api/songs/", json={"title": "Test Song", "bpm": 120, "beats_per_bar": 4, "stars": 2})
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Test Song"
    assert data["bpm"] == 120
    assert "id" in data
    _created_ids.append(data["id"])


def test_get_song_detail():
    r = client.post("/api/songs/", json={"title": "Detail Song", "bpm": 80})
    sid = r.json()["id"]
    _created_ids.append(sid)

    r = client.get(f"/api/songs/{sid}")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == sid
    assert data["events"] == []


def test_delete_song():
    r = client.post("/api/songs/", json={"title": "Delete Me"})
    sid = r.json()["id"]

    r = client.delete(f"/api/songs/{sid}")
    assert r.status_code == 204

    r = client.get(f"/api/songs/{sid}")
    assert r.status_code == 404


def test_update_song_with_events():
    r = client.post("/api/songs/", json={"title": "With Events", "bpm": 90})
    sid = r.json()["id"]
    _created_ids.append(sid)

    events = [
        {"position": 0, "kind": "note", "pitch": "C", "accidental": None, "octave": 4, "duration_beats": 1.0},
        {"position": 1, "kind": "rest", "pitch": None, "accidental": None, "octave": None, "duration_beats": 0.5},
    ]
    r = client.put(f"/api/songs/{sid}", json={"title": "With Events", "bpm": 90, "beats_per_bar": 4, "stars": 1, "events": events})
    assert r.status_code == 200
    data = r.json()
    assert len(data["events"]) == 2
    assert data["events"][0]["pitch"] == "C"
    assert data["events"][1]["kind"] == "rest"
    assert data["events"][0]["base"] == "4"
    assert data["events"][1]["base"] == "8"


def test_get_404_for_missing_song():
    r = client.get("/api/songs/999999")
    assert r.status_code == 404
