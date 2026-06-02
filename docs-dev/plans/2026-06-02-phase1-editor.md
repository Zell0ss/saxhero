# Phase 1 — Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Editor experience — CRUD API for songs and events, note strip parser, and the React frontend (SongList + Editor views) adapted from the design bundle.

**Architecture:** Backend adds `parser.py` (Python port of music.js parser) and `songs.py` (FastAPI router with full CRUD). Frontend adapts the design bundle JSX/CSS into proper ES modules: `music.js` as ES module, `Ui.jsx` (shared components), `SongList.jsx`, `Editor.jsx`, and `App.jsx` wired to the API. `studio.css` is imported as a global stylesheet alongside Tailwind.

**Tech Stack:** FastAPI + PyMySQL + Pydantic v2 · React + Vite + Tailwind + studio.css · MariaDB saxhero_db · No audio yet (Phase 2)

**Design bundle source:** `docs-dev/frontend files/saxhero compositor/` — read it before implementing frontend tasks.

**Base commit:** `b895e9a`

---

## File Map

```
backend/
  parser.py          NEW — Python port of music.js strip parser + beats↔base helpers
  songs.py           NEW — Pydantic models + FastAPI CRUD router for songs/events
  main.py            MODIFY — include songs router
  tests/
    test_parser.py   NEW — parser unit tests
    test_songs_api.py NEW — API integration tests (hits real DB)

frontend/src/
  studio.css         NEW — copy of design bundle studio.css (design tokens, all component styles)
  music.js           NEW — ES module port of design bundle music.js
  api.js             NEW — fetch wrappers for all API endpoints
  components/
    Ui.jsx           NEW — Icon, Stars, StarShape, KeyColumn, StaffPreview, Cover, Bokeh
    SongList.jsx     NEW — song library view (adapted from bundle list.jsx)
    Editor.jsx       NEW — editor view (adapted from bundle editor.jsx)
  App.jsx            MODIFY — replace hello world with routing + API state
  main.jsx           MODIFY — add studio.css import

sql/
  migration_001_songs_fields.sql  NEW — adds stars, key_name, cover_image to songs
```

---

## Task 1: Schema migration

**Files:**
- Create: `sql/migration_001_songs_fields.sql`

- [ ] **Step 1: Write migration SQL**

Create `/data/saxhero/sql/migration_001_songs_fields.sql`:
```sql
ALTER TABLE songs
  ADD COLUMN stars TINYINT NOT NULL DEFAULT 1 AFTER beats_per_bar,
  ADD COLUMN key_name VARCHAR(20) NULL AFTER stars,
  ADD COLUMN cover_image MEDIUMTEXT NULL AFTER key_name;
```

- [ ] **Step 2: Run migration**

```bash
sudo mariadb -u josem -ptu_password_segura saxhero_db < /data/saxhero/sql/migration_001_songs_fields.sql
```

Expected: no errors.

- [ ] **Step 3: Verify columns exist**

```bash
sudo mariadb -u josem -ptu_password_segura -e "DESCRIBE saxhero_db.songs;"
```

Expected: columns `stars`, `key_name`, `cover_image` present after `beats_per_bar`.

- [ ] **Step 4: Commit**

```bash
cd /data/saxhero
git add sql/migration_001_songs_fields.sql
git commit -m "feat: add stars, key_name, cover_image to songs table"
```

---

## Task 2: Python parser (TDD)

**Files:**
- Create: `backend/parser.py`
- Create: `backend/tests/test_parser.py`

- [ ] **Step 1: Write the failing tests**

Create `/data/saxhero/backend/tests/test_parser.py`:
```python
from parser import parse_strip, serialize_events, beats_to_base


def test_parse_note_uppercase():
    events = parse_strip("C")
    assert len(events) == 1
    assert events[0] == {"type": "note", "letter": "C", "acc": None, "octave": 4}


def test_parse_note_lowercase():
    events = parse_strip("c")
    assert len(events) == 1
    assert events[0]["octave"] == 5


def test_parse_comma_lowers_octave():
    events = parse_strip("C,")
    assert events[0]["octave"] == 3


def test_parse_apostrophe_raises_octave():
    events = parse_strip("c'")
    assert events[0]["octave"] == 6


def test_parse_sharp():
    events = parse_strip("F#")
    assert events[0]["acc"] == "#"


def test_parse_flat():
    events = parse_strip("Bb")
    assert events[0]["acc"] == "b"


def test_parse_rest():
    events = parse_strip("-")
    assert len(events) == 1
    assert events[0]["type"] == "rest"


def test_barline_ignored():
    events = parse_strip("C | E")
    assert len(events) == 2


def test_parse_multiple():
    events = parse_strip("C E G c")
    assert len(events) == 4
    assert events[3]["octave"] == 5


def test_invalid_token_skipped():
    events = parse_strip("C xyz G")
    assert len(events) == 2


def test_serialize_events_basic():
    events = [
        {"kind": "note", "pitch": "C", "accidental": None, "octave": 4, "duration_beats": 1.0},
        {"kind": "note", "pitch": "E", "accidental": None, "octave": 4, "duration_beats": 1.0},
    ]
    result = serialize_events(events, beats_per_bar=4)
    assert "C" in result and "E" in result


def test_serialize_rest():
    events = [{"kind": "rest", "pitch": None, "accidental": None, "octave": None, "duration_beats": 1.0}]
    assert serialize_events(events, beats_per_bar=4) == "-"


def test_beats_to_base_quarter():
    base, dotted, triplet = beats_to_base(1.0)
    assert base == "4" and not dotted and not triplet


def test_beats_to_base_eighth():
    base, dotted, triplet = beats_to_base(0.5)
    assert base == "8" and not dotted and not triplet


def test_beats_to_base_dotted_quarter():
    base, dotted, triplet = beats_to_base(1.5)
    assert base == "4" and dotted and not triplet
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /data/saxhero/backend
source .venv/bin/activate
pytest tests/test_parser.py -v 2>&1 | head -20
```

Expected: `ModuleNotFoundError: No module named 'parser'`

- [ ] **Step 3: Write parser.py**

Create `/data/saxhero/backend/parser.py`:
```python
import re
from typing import Optional

BASE_OCT_UPPER = 4
BASE_OCT_LOWER = 5

_DURATION_TABLE = [
    (6.0,      "1",  True,  False),
    (4.0,      "1",  False, False),
    (8.0/3,    "1",  False, True),
    (3.0,      "2",  True,  False),
    (2.0,      "2",  False, False),
    (4.0/3,    "2",  False, True),
    (1.5,      "4",  True,  False),
    (1.0,      "4",  False, False),
    (2.0/3,    "4",  False, True),
    (0.75,     "8",  True,  False),
    (0.5,      "8",  False, False),
    (1.0/3,    "8",  False, True),
    (0.375,    "16", True,  False),
    (0.25,     "16", False, False),
    (1.0/6,    "16", False, True),
]


def parse_token(tok: str) -> Optional[dict]:
    if tok == "-":
        return {"type": "rest"}
    if tok == "|":
        return {"type": "bar"}
    m = re.match(r"^([A-Ga-g])([#b]?)([,']*)$", tok)
    if not m:
        return None
    raw_letter = m.group(1)
    letter = raw_letter.upper()
    acc_str = m.group(2) or None
    octave = BASE_OCT_UPPER if raw_letter == letter else BASE_OCT_LOWER
    for ch in m.group(3):
        octave += -1 if ch == "," else 1
    return {"type": "note", "letter": letter, "acc": acc_str, "octave": octave}


def parse_strip(text: str) -> list[dict]:
    """Parse note strip text → list of {type, letter, acc, octave} dicts."""
    out = []
    for tok in (text or "").split():
        p = parse_token(tok)
        if p and p["type"] != "bar":
            out.append(p)
    return out


def _token_for_event(ev: dict) -> str:
    if ev.get("kind") == "rest":
        return "-"
    letter: str = ev["pitch"]
    octave: int = ev["octave"]
    raw = letter.lower() if octave >= BASE_OCT_LOWER else letter
    marks = ""
    if octave > BASE_OCT_LOWER:
        marks = "'" * (octave - BASE_OCT_LOWER)
    elif octave < BASE_OCT_UPPER:
        marks = "," * (BASE_OCT_UPPER - octave)
    acc = ev.get("accidental") or ""
    if acc == "sharp":
        acc = "#"
    elif acc == "flat":
        acc = "b"
    else:
        acc = ""
    return raw + acc + marks


def serialize_events(events: list[dict], beats_per_bar: int = 4) -> str:
    """Serialize DB-format events → note strip string (pitch only, no durations)."""
    parts: list[str] = []
    acc_beats = 0.0
    for ev in events:
        parts.append(_token_for_event(ev))
        acc_beats += float(ev.get("duration_beats", 1))
        if beats_per_bar and acc_beats >= beats_per_bar - 1e-6:
            acc_beats = 0.0
            parts.append("|")
    if parts and parts[-1] == "|":
        parts.pop()
    return " ".join(parts)


def beats_to_base(beats: float) -> tuple[str, bool, bool]:
    """Reverse-map a duration in beats → (base, dotted, triplet)."""
    best = min(_DURATION_TABLE, key=lambda x: abs(x[0] - beats))
    return best[1], best[2], best[3]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /data/saxhero/backend
source .venv/bin/activate
pytest tests/test_parser.py -v
```

Expected: all 16 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /data/saxhero
git add backend/parser.py backend/tests/test_parser.py
git commit -m "feat: note strip parser with beats_to_base reverse map"
```

---

## Task 3: Songs CRUD API

**Files:**
- Create: `backend/songs.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_songs_api.py`

- [ ] **Step 1: Write the failing API tests**

Create `/data/saxhero/backend/tests/test_songs_api.py`:
```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# Track created IDs for cleanup
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
    # base/dotted/triplet are returned
    assert data["events"][0]["base"] == "4"
    assert data["events"][1]["base"] == "8"


def test_get_404_for_missing_song():
    r = client.get("/api/songs/999999")
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /data/saxhero/backend
source .venv/bin/activate
pytest tests/test_songs_api.py -v 2>&1 | head -15
```

Expected: all fail with 404 (routes don't exist yet).

- [ ] **Step 3: Write songs.py**

Create `/data/saxhero/backend/songs.py`:
```python
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import get_db_connection
from parser import beats_to_base
from logger import setup_logger

log = setup_logger()
router = APIRouter(prefix="/api/songs")


class EventIn(BaseModel):
    position: int
    kind: str
    pitch: Optional[str] = None
    accidental: Optional[str] = None
    octave: Optional[int] = None
    duration_beats: float = 1.0


class SongIn(BaseModel):
    title: str = ""
    bpm: int = 100
    beats_per_bar: int = 4
    stars: int = 1
    key_name: Optional[str] = None
    cover_image: Optional[str] = None
    events: Optional[list[EventIn]] = None


def _enrich_events(raw: list[dict]) -> list[dict]:
    out = []
    for ev in raw:
        base, dotted, triplet = beats_to_base(float(ev["duration_beats"]))
        out.append({
            "position": ev["position"],
            "kind": ev["kind"],
            "pitch": ev["pitch"],
            "accidental": ev["accidental"],
            "octave": ev["octave"],
            "duration_beats": float(ev["duration_beats"]),
            "base": base,
            "dotted": dotted,
            "triplet": triplet,
        })
    return out


def _get_song_or_404(cur, song_id: int) -> dict:
    cur.execute(
        "SELECT id, title, bpm, beats_per_bar, stars, key_name, cover_image FROM songs WHERE id = %s",
        (song_id,),
    )
    song = cur.fetchone()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return song


@router.get("/")
def list_songs():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, bpm, beats_per_bar, stars, key_name, cover_image "
                "FROM songs ORDER BY updated_at DESC"
            )
            return cur.fetchall()
    finally:
        if conn:
            conn.close()


@router.post("/", status_code=201)
def create_song(data: SongIn):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO songs (title, bpm, beats_per_bar, stars, key_name, cover_image) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (data.title, data.bpm, data.beats_per_bar, data.stars, data.key_name, data.cover_image),
            )
            song_id = cur.lastrowid
            conn.commit()
            return _get_song_or_404(cur, song_id)
    finally:
        if conn:
            conn.close()


@router.get("/{song_id}")
def get_song(song_id: int):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            song = _get_song_or_404(cur, song_id)
            cur.execute(
                "SELECT position, kind, pitch, accidental, octave, duration_beats "
                "FROM song_events WHERE song_id = %s ORDER BY position",
                (song_id,),
            )
            song["events"] = _enrich_events(cur.fetchall())
            return song
    finally:
        if conn:
            conn.close()


@router.put("/{song_id}")
def update_song(song_id: int, data: SongIn):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            _get_song_or_404(cur, song_id)
            cur.execute(
                "UPDATE songs SET title=%s, bpm=%s, beats_per_bar=%s, stars=%s, key_name=%s, cover_image=%s "
                "WHERE id=%s",
                (data.title, data.bpm, data.beats_per_bar, data.stars, data.key_name, data.cover_image, song_id),
            )
            cur.execute("DELETE FROM song_events WHERE song_id = %s", (song_id,))
            if data.events:
                for ev in data.events:
                    cur.execute(
                        "INSERT INTO song_events (song_id, position, kind, pitch, accidental, octave, duration_beats) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                        (song_id, ev.position, ev.kind, ev.pitch, ev.accidental, ev.octave, ev.duration_beats),
                    )
            conn.commit()
            return get_song(song_id)
    finally:
        if conn:
            conn.close()


@router.delete("/{song_id}", status_code=204)
def delete_song(song_id: int):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            _get_song_or_404(cur, song_id)
            cur.execute("DELETE FROM songs WHERE id = %s", (song_id,))
            conn.commit()
    finally:
        if conn:
            conn.close()
```

- [ ] **Step 4: Wire router into main.py**

Replace `/data/saxhero/backend/main.py` entirely:
```python
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from db import get_db_connection
from logger import setup_logger
from songs import router as songs_router

load_dotenv()
log = setup_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("saxhero starting")
    yield
    log.info("saxhero stopped")


app = FastAPI(lifespan=lifespan)
app.include_router(songs_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "saxhero"}


@app.get("/api/db-health")
def db_health():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return {"status": "ok", "db": "saxhero_db"}
    except Exception as e:
        log.error(f"DB health check failed: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    finally:
        if conn:
            conn.close()
```

- [ ] **Step 5: Run all tests**

```bash
cd /data/saxhero/backend
source .venv/bin/activate
pytest tests/ -v
```

Expected: all tests pass (2 health + 16 parser + 7 API = 25 total).

- [ ] **Step 6: Restart service and smoke-test**

```bash
sudo systemctl restart saxhero
curl -s http://127.0.0.1:8000/api/songs/
```

Expected: `[]`

```bash
curl -s -X POST http://127.0.0.1:8000/api/songs/ \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","bpm":100}' | python3 -m json.tool
```

Expected: JSON with `id`, `title`, `bpm`, etc.

- [ ] **Step 7: Commit**

```bash
cd /data/saxhero
git add backend/songs.py backend/main.py backend/tests/test_songs_api.py
git commit -m "feat: songs CRUD API with events full-replace"
```

---

## Task 4: Frontend setup — studio.css + music.js ES module

**Files:**
- Create: `frontend/src/studio.css`
- Create: `frontend/src/music.js`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Copy studio.css**

```bash
cp "/data/saxhero/docs-dev/frontend files/saxhero compositor/studio.css" \
   /data/saxhero/frontend/src/studio.css
```

- [ ] **Step 2: Add Sora font to index.html**

Edit `/data/saxhero/frontend/index.html` — add inside `<head>` before closing tag:
```html
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap" rel="stylesheet">
```

The full `<head>` section should look like:
```html
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap" rel="stylesheet">
    <title>SaxHero</title>
  </head>
```

- [ ] **Step 3: Write music.js as ES module**

Create `/data/saxhero/frontend/src/music.js` — this is a port of the design bundle's `music.js`, converted from IIFE to ES module:
```js
// music.js — SaxHero note model (ES module port from design bundle)

const LETTERS = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
export const LETTER_BY_IDX = ["C", "D", "E", "F", "G", "A", "B"];
const E4_ABS = 4 * 7 + LETTERS.E;

export function stepOf(letter, octave) {
  return octave * 7 + LETTERS[letter] - E4_ABS;
}

export const BASE_OCT_UPPER = 4;
export const BASE_OCT_LOWER = 5;

export function parseToken(tok) {
  if (tok === "-") return { type: "rest" };
  if (tok === "|") return { type: "bar" };
  const m = /^([A-Ga-g])([#b]?)([,']*)$/.exec(tok);
  if (!m) return null;
  const rawLetter = m[1];
  const letter = rawLetter.toUpperCase();
  const acc = m[2];
  let octave = rawLetter === letter ? BASE_OCT_UPPER : BASE_OCT_LOWER;
  for (const ch of m[3]) octave += ch === "," ? -1 : 1;
  return { type: "note", letter, acc, octave, pitch: letter + acc + octave, step: stepOf(letter, octave) };
}

export function parseStrip(text) {
  const out = [];
  (text || "").trim().split(/\s+/).filter(Boolean).forEach((tok) => {
    const p = parseToken(tok);
    if (p && p.type !== "bar") out.push(p);
  });
  return out;
}

export function tokenForEvent(ev) {
  if (ev.type === "rest" || ev.isRest) return "-";
  let letter = ev.octave >= BASE_OCT_LOWER ? ev.letter.toLowerCase() : ev.letter;
  let marks = "";
  if (ev.octave > BASE_OCT_LOWER) marks = "'".repeat(ev.octave - BASE_OCT_LOWER);
  else if (ev.octave < BASE_OCT_UPPER) marks = ",".repeat(BASE_OCT_UPPER - ev.octave);
  return letter + (ev.acc || "") + marks;
}

export function serialize(events, beatsPerBar) {
  const parts = [];
  let acc = 0;
  events.forEach((ev) => {
    parts.push(tokenForEvent(ev));
    acc += durBeats(ev);
    if (beatsPerBar && acc >= beatsPerBar - 1e-6) { acc = 0; parts.push("|"); }
  });
  if (parts[parts.length - 1] === "|") parts.pop();
  return parts.join(" ");
}

export const LADDER = [
  { key: "16", beats: 0.25, glyph: "𝅘𝅥𝅯", name: "semicorchea" },
  { key: "8",  beats: 0.5,  glyph: "♪",        name: "corchea" },
  { key: "4",  beats: 1,    glyph: "♩",         name: "negra" },
  { key: "2",  beats: 2,    glyph: "𝅗𝅥",   name: "blanca" },
  { key: "1",  beats: 4,    glyph: "𝅝",   name: "redonda" },
];
export const LADDER_INDEX = Object.fromEntries(LADDER.map((d, i) => [d.key, i]));

export function durBeats(ev) {
  const base = LADDER[LADDER_INDEX[ev.base ?? "4"]] || LADDER[2];
  let b = base.beats;
  if (ev.dotted) b *= 1.5;
  if (ev.triplet) b *= 2 / 3;
  return b;
}

export function durLabel(ev) {
  const base = LADDER[LADDER_INDEX[ev.base ?? "4"]] || LADDER[2];
  let n = base.name;
  if (ev.dotted) n += " con puntillo";
  if (ev.triplet) n += " (tresillo)";
  return n;
}

export function durGlyph(ev) {
  const base = LADDER[LADDER_INDEX[ev.base ?? "4"]] || LADDER[2];
  return base.glyph + (ev.dotted ? "·" : "");
}

const REST_GLYPHS = { "16": "𝄽", "8": "𝄼", "4": "𝄻", "2": "𝄺", "1": "𝄹" };
export function restGlyph(ev) { return REST_GLYPHS[ev.base ?? "4"] || REST_GLYPHS["4"]; }

export function makeEvent(parsed, prev) {
  if (!parsed) return null;
  const base = { base: prev?.base ?? "4", dotted: prev?.dotted ?? false, triplet: prev?.triplet ?? false };
  if (parsed.type === "rest") return { isRest: true, ...base };
  return { isRest: false, letter: parsed.letter, acc: parsed.acc, octave: parsed.octave, pitch: parsed.pitch, step: parsed.step, ...base };
}

export function reconcile(text, oldEvents) {
  const parsed = parseStrip(text);
  return parsed.map((p, i) => {
    const old = oldEvents && oldEvents[i];
    const carry = old ? { base: old.base, dotted: old.dotted, triplet: old.triplet } : undefined;
    return makeEvent(p, carry);
  });
}

export const ROWS = [
  { id: "O",  group: "octave", label: "Octava" },
  { id: "L1", group: "left",   label: "Izq. índice" },
  { id: "L2", group: "left",   label: "Izq. medio" },
  { id: "L3", group: "left",   label: "Izq. anular" },
  { id: "L4", group: "left",   pinky: true, label: "Izq. meñique" },
  { id: "R1", group: "right",  label: "Der. índice" },
  { id: "R2", group: "right",  label: "Der. medio" },
  { id: "R3", group: "right",  label: "Der. anular" },
  { id: "R4", group: "right",  pinky: true, label: "Der. meñique" },
];

export const SHAPE = {
  C: ["L2"], "C#": [], Db: [], D: ["L1","L2","L3","R1","R2","R3"],
  "D#": ["L1","L2","L3","R1","R2","R3"], Eb: ["L1","L2","L3","R1","R2","R3"],
  E: ["L1","L2","L3","R1","R2"], F: ["L1","L2","L3","R1"],
  "F#": ["L1","L2","L3","R2"], Gb: ["L1","L2","L3","R2"],
  G: ["L1","L2","L3"], "G#": ["L1","L2","L3"], Ab: ["L1","L2","L3"],
  A: ["L1","L2"], "A#": ["L1","R1"], Bb: ["L1","R1"], B: ["L1"],
};

export function fingering(ev) {
  if (!ev || ev.isRest) return [];
  const pc = ev.letter + (ev.acc || "");
  const step = ev.step;
  if (step <= -2) {
    const stack = ["L1","L2","L3","R1","R2","R3"];
    if (ev.letter === "C") return [...stack, "R4"];
    return [...stack, "L4"];
  }
  let keys = (SHAPE[pc] || SHAPE[ev.letter] || []).slice();
  if (step >= 6) keys = ["O", ...keys];
  return keys;
}

export function registerName(ev) {
  if (!ev || ev.isRest) return "";
  if (ev.step <= -2) return "Registro grave";
  if (ev.step >= 6) return "Registro agudo · octava";
  return "Registro medio";
}

export function blankSong() {
  return { title: "", bpm: 90, beats_per_bar: 4, stars: 1, cover_image: null, key_name: "" };
}

export function totalBeats(events) {
  return events.reduce((s, e) => s + durBeats(e), 0);
}
```

- [ ] **Step 4: Update main.jsx to import studio.css**

Replace `/data/saxhero/frontend/src/main.jsx`:
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './studio.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 5: Verify build still works**

```bash
cd /data/saxhero/frontend
npm run build 2>&1 | tail -5
```

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 6: Commit**

```bash
cd /data/saxhero
git add frontend/src/studio.css frontend/src/music.js frontend/src/main.jsx frontend/index.html
git commit -m "feat: studio.css + music.js ES module"
```

---

## Task 5: Frontend shared UI components (Ui.jsx)

**Files:**
- Create: `frontend/src/components/Ui.jsx`

Port from `docs-dev/frontend files/saxhero compositor/ui.jsx`. The only changes are: add React imports, add music.js import, export named symbols, remove `Object.assign(window, {...})`.

- [ ] **Step 1: Create Ui.jsx**

Create `/data/saxhero/frontend/src/components/Ui.jsx`:
```jsx
import React, { useMemo } from 'react';
import * as MUS from '../music.js';

// ---- icons ----
export const Icon = {
  play:   (p) => <svg viewBox="0 0 24 24" {...p}><path d="M8 5.2 19 12 8 18.8z" fill="currentColor" /></svg>,
  pause:  (p) => <svg viewBox="0 0 24 24" {...p}><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /></svg>,
  loop:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 2l3.5 3.5L17 9" /><path d="M3.5 11V9.5A4 4 0 0 1 7.5 5.5H20.5" /><path d="M7 22l-3.5-3.5L7 15" /><path d="M20.5 13v1.5a4 4 0 0 1-4 4H3.5" /></svg>,
  plus:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14" /></svg>,
  pencil: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M13.5 6.5l3 3" /></svg>,
  trash:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>,
  back:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 5l-7 7 7 7" /></svg>,
  upload: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>,
  panel:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M14.5 4.5v15" /></svg>,
  search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" /></svg>,
  close:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  chevL:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14.5 5l-7 7 7 7" /></svg>,
  chevR:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9.5 5l7 7-7 7" /></svg>,
  arrows: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" /></svg>,
  save:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>,
};

// ---- stars ----
export function StarShape(props) {
  return <svg viewBox="0 0 24 24" {...props}><path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.9 6.6 19.4l1.2-5.9L3.4 9.4l6-.7z" fill="currentColor" /></svg>;
}
export function Stars({ value, max = 5 }) {
  return (
    <span className="stars">
      {Array.from({ length: max }).map((_, i) => (
        <StarShape key={i} className={i < value ? "on" : "off"} />
      ))}
    </span>
  );
}

// ---- key column ----
export const RAW_COLOR = { octave: "#ff5d6c", left: "#ffe14d", right: "#5ec8ff" };

export function KeyColumn({ keys = [], width = 120 }) {
  const PITCH = 28, TOP = 20;
  const cx = width / 2;
  const H = TOP + MUS.ROWS.length * PITCH;
  const on = (id) => keys.includes(id);
  return (
    <svg width={width} height={H} style={{ display: "block" }}>
      <line x1={cx} y1={TOP - 6} x2={cx} y2={H - PITCH + 6} stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
      {MUS.ROWS.map((row, i) => {
        const cy = TOP + i * PITCH;
        const raw = RAW_COLOR[row.group];
        const lit = on(row.id);
        const fill = lit ? raw : "none";
        const stroke = lit ? raw : "rgba(255,255,255,0.16)";
        const style = lit ? { filter: `drop-shadow(0 0 7px ${raw})` } : undefined;
        if (row.id === "O") {
          return (
            <g key="O" transform={`translate(${cx - 90},0)`} style={style}>
              <path d={`M 84 ${cy - 13} q 17 1 16 14 q -1 13 -16 13 q 9 -8 6 -16 q -2 -6 -6 -11 z`}
                fill={fill} stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" />
            </g>
          );
        }
        if (row.pinky) {
          return <rect key={row.id} x={cx - 16} y={cy - 7} width="32" height="14" rx="7" fill={fill} stroke={stroke} strokeWidth="2.4" style={style} />;
        }
        return <circle key={row.id} cx={cx} cy={cy} r="11" fill={fill} stroke={stroke} strokeWidth="2.4" style={style} />;
      })}
    </svg>
  );
}

// ---- staff geometry ----
export const STAFF = { H: 210, BASE: 140, STEP: 9, PPB: 56, PAD_L: 72, PAD_R: 48, OFF: 18, MINW: 560 };
export const yStep = (s) => STAFF.BASE - s * STAFF.STEP;
export const beatToX = (beat) => STAFF.PAD_L + beat * STAFF.PPB;
export function staffWidth(events) {
  return Math.max(STAFF.MINW, STAFF.PAD_L + MUS.totalBeats(events) * STAFF.PPB + STAFF.PAD_R);
}
const stemUp = (step) => step < 4;
function ledgers(step) {
  const out = [];
  if (step >= 10) for (let s = 10; s <= step; s += 2) out.push(s);
  if (step <= -2) for (let s = -2; s >= step; s -= 2) out.push(s);
  return out;
}

// ---- staff preview ----
export function StaffPreview({ events, beatsPerBar, selectedIdx = -1, activeIdx = -1, onSelect }) {
  const W = staffWidth(events);
  const lines = [0, 2, 4, 6, 8];
  let cum = 0;
  const placed = events.map((ev) => {
    const start = cum;
    const d = MUS.durBeats(ev);
    cum += d;
    return { ev, start, d };
  });
  const totalB = cum;
  const bars = [];
  if (beatsPerBar > 0) {
    for (let b = beatsPerBar; b < totalB - 1e-6; b += beatsPerBar) bars.push(b);
  }
  return (
    <svg className="nota" width={W} height={STAFF.H} style={{ display: "block" }}>
      {lines.map((s) => (
        <line key={s} x1={STAFF.PAD_L - 16} y1={yStep(s)} x2={W - 12} y2={yStep(s)} stroke="rgba(255,255,255,0.34)" strokeWidth="1" />
      ))}
      <text className="clef" x={STAFF.PAD_L - 56} y={yStep(2) + 22} fontSize="92">{"𝄞"}</text>
      {bars.map((b, i) => (
        <line key={"b" + i} x1={beatToX(b)} y1={yStep(8)} x2={beatToX(b)} y2={yStep(0)} stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
      ))}
      <line x1={beatToX(totalB) + 6} y1={yStep(8)} x2={beatToX(totalB) + 6} y2={yStep(0)} stroke="rgba(255,255,255,0.28)" strokeWidth="2.2" />
      {placed.map(({ ev, start, d }, i) => {
        const x = beatToX(start) + STAFF.OFF;
        const active = i === activeIdx;
        const sel = i === selectedIdx;
        const cls = "nh" + (active ? " active" : "") + (sel ? " sel" : "");
        if (ev.isRest) {
          return (
            <g key={i} className={cls} onClick={() => onSelect && onSelect(i)} style={{ cursor: "pointer" }}>
              <rect x={x - 14} y={yStep(8) - 6} width="30" height={yStep(0) - yStep(8) + 12} fill="transparent" />
              <text className="restglyph" x={x - 7} y={yStep(4) + 8} fontSize="34" style={sel ? { fill: "var(--gold)" } : undefined}>{MUS.restGlyph(ev)}</text>
            </g>
          );
        }
        const cy = yStep(ev.step);
        const hollow = ev.base === "2" || ev.base === "1";
        const up = stemUp(ev.step);
        const sx = up ? x + 7 : x - 7;
        const stemLen = 34;
        const stemEnd = up ? cy - stemLen : cy + stemLen;
        const flags = ev.base === "8" ? 1 : ev.base === "16" ? 2 : 0;
        return (
          <g key={i} className={cls} onClick={() => onSelect && onSelect(i)} style={{ cursor: "pointer" }}>
            <rect x={beatToX(start)} y="0" width={Math.max(d * STAFF.PPB, 22)} height={STAFF.H} fill="transparent" />
            {ledgers(ev.step).map((s) => (
              <line key={s} x1={x - 13} y1={yStep(s)} x2={x + 13} y2={yStep(s)} stroke="rgba(255,255,255,0.6)" strokeWidth="1.4" />
            ))}
            {ev.base !== "1" && <line x1={sx} y1={cy + (up ? -2 : 2)} x2={sx} y2={stemEnd} stroke="#fff" strokeWidth="1.7" />}
            {ev.base !== "1" && Array.from({ length: flags }).map((_, fi) => {
              const fy = stemEnd + (up ? fi * 8 : -fi * 8);
              return <path key={fi} d={up ? `M${sx} ${fy} q 11 4 9 16` : `M${sx} ${fy} q 11 -4 9 -16`} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />;
            })}
            <ellipse cx={x} cy={cy} rx={active ? 11 : 8.4} ry={active ? 8 : 6.1} transform={`rotate(-22 ${x} ${cy})`} fill={hollow ? "none" : "#fff"} stroke="#fff" strokeWidth={hollow ? 2.1 : 0} />
            {ev.dotted && <circle cx={x + 15} cy={cy - 2} r="2.4" fill="#fff" />}
            {ev.triplet && <text x={x - 4} y={up ? stemEnd - 6 : stemEnd + 14} fontSize="13" fill="var(--gold)" fontWeight="700">3</text>}
            {ev.acc && <text className="acc" x={x - 23} y={cy + 7} fontSize="30">{ev.acc === "#" ? "♯" : "♭"}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ---- covers ----
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function CoverKeys({ song }) {
  const events = useMemo(() => MUS.reconcile(song.strip || "", []), [song.strip]);
  const notes = events.filter((e) => !e.isRest).slice(0, 5);
  const cols = notes.length ? notes : [null];
  return (
    <div className="cover-keys">
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
        {cols.map((ev, ci) => {
          const keys = ev ? MUS.fingering(ev) : [];
          return (
            <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {MUS.ROWS.map((row) => {
                const lit = keys.includes(row.id);
                return <div key={row.id} style={{ width: row.pinky ? 22 : 14, height: 6, borderRadius: 4, background: lit ? RAW_COLOR[row.group] : "rgba(255,255,255,0.07)", boxShadow: lit ? `0 0 9px -1px ${RAW_COLOR[row.group]}` : "none", margin: "0 auto" }} />;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoverMono({ song }) {
  const ch = (song.key_name && song.key_name.trim()) || (song.title && song.title.trim()[0]) || "♪";
  return (
    <div className="cover-mono">
      <div className="glyph">{ch}</div>
      <div className="sub">{song.key_name ? "Tonalidad" : "Estudio"}</div>
    </div>
  );
}

export function Cover({ song }) {
  if (song.cover_image) {
    return <div className="cover-art"><div className="cover-photo" style={{ backgroundImage: `url(${song.cover_image})` }} /><div className="scrim" /></div>;
  }
  // CoverKeys needs song.strip (not available in list view); use CoverMono as default
  return <div className="cover-art"><CoverMono song={song} /><div className="scrim" /></div>;
}

// ---- bokeh ----
const BOKEH = (() => {
  const out = []; let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 42; i++) {
    const big = rnd() > 0.84;
    out.push({ x: rnd() * 100, y: rnd() * 100, s: big ? 18 + rnd() * 36 : 1.5 + rnd() * 4, o: big ? 0.05 + rnd() * 0.07 : 0.16 + rnd() * 0.36, hue: 30 + rnd() * 22, dur: 16 + rnd() * 22, delay: -rnd() * 30, drift: (rnd() * 2 - 1) * 16 });
  }
  return out;
})();

export function Bokeh() {
  return (
    <div className="bokeh">
      {BOKEH.map((b, i) => (
        <span key={i} style={{ left: b.x + "%", top: b.y + "%", width: b.s, height: b.s, opacity: b.o, background: `radial-gradient(circle, hsla(${b.hue},85%,68%,1) 0%, hsla(${b.hue},85%,60%,0) 70%)`, animationDuration: b.dur + "s", animationDelay: b.delay + "s", "--drift": b.drift + "px" }} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /data/saxhero/frontend && npm run build 2>&1 | tail -5
```

Expected: `✓ built in Xs`

- [ ] **Step 3: Commit**

```bash
cd /data/saxhero
git add frontend/src/components/Ui.jsx
git commit -m "feat: shared UI components (Icon, StaffPreview, Cover, Bokeh, KeyColumn)"
```

---

## Task 6: Frontend API client

**Files:**
- Create: `frontend/src/api.js`

- [ ] **Step 1: Write api.js**

Create `/data/saxhero/frontend/src/api.js`:
```js
const BASE = "/api";

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (r.status === 204) return null;
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`${r.status} ${text}`);
  }
  return r.json();
}

export const getSongs = () => req("/songs/");
export const createSong = (data) => req("/songs/", { method: "POST", body: JSON.stringify(data) });
export const getSong = (id) => req(`/songs/${id}`);
export const updateSong = (id, data) => req(`/songs/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteSong = (id) => req(`/songs/${id}`, { method: "DELETE" });
```

- [ ] **Step 2: Verify build**

```bash
cd /data/saxhero/frontend && npm run build 2>&1 | tail -3
```

Expected: `✓ built`

- [ ] **Step 3: Commit**

```bash
cd /data/saxhero
git add frontend/src/api.js
git commit -m "feat: API client module"
```

---

## Task 7: Frontend SongList component

**Files:**
- Create: `frontend/src/components/SongList.jsx`

Port from `docs-dev/frontend files/saxhero compositor/list.jsx`. Key changes: add imports, remove window globals, replace `coverStyle` with `'keys'` default.

- [ ] **Step 1: Create SongList.jsx**

Create `/data/saxhero/frontend/src/components/SongList.jsx`:
```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Icon, Stars, StarShape, Cover } from './Ui.jsx';

const PAGE_SIZE = 8;

function SortToggle({ field, dir, onField, onDir }) {
  return (
    <div className="sort">
      <span className="sort-lbl">Ordenar</span>
      <div className="seg">
        <button className={field === "name" ? "on" : ""} onClick={() => onField("name")}>Nombre</button>
        <button className={field === "stars" ? "on" : ""} onClick={() => onField("stars")}>Dificultad</button>
      </div>
      <button className="dir-btn" onClick={onDir}>
        <Icon.arrows style={{ transform: dir === "asc" ? "none" : "scaleY(-1)" }} />
      </button>
    </div>
  );
}

function StarFilter({ value, onChange }) {
  return (
    <div className="filter-stars">
      <button className={"chip-min" + (value === 0 ? " on" : "")} onClick={() => onChange(0)}>Todas</button>
      <div className="fs-stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => onChange(n === value ? 0 : n)} className={n <= value ? "on" : "off"}>
            <StarShape />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SongList({ songs, onOpen, onCreate, onDelete }) {
  const [query, setQuery] = useState("");
  const [stars, setStars] = useState(0);
  const [field, setField] = useState("name");
  const [dir, setDir] = useState("asc");
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [query, stars, field, dir, songs.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let r = songs.filter((s) => {
      const okQ = !q || (s.title || "Sin título").toLowerCase().includes(q);
      const okS = stars === 0 || s.stars === stars;
      return okQ && okS;
    });
    r = r.slice().sort((a, b) => {
      let cmp;
      if (field === "stars") cmp = (a.stars - b.stars) || (a.title || "").localeCompare(b.title || "", "es");
      else cmp = (a.title || "Sin título").localeCompare(b.title || "Sin título", "es", { sensitivity: "base" });
      return dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [songs, query, stars, field, dir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const filtering = query.trim() !== "" || stars !== 0;
  const showNewTile = !filtering && curPage === totalPages;

  return (
    <div className="list-wrap">
      <div className="list-inner">
        <div className="list-head">
          <div>
            <div className="eyebrow">SaxHero · Compositor</div>
            <h1>Tu repertorio</h1>
            <p className="sub">Escribe canciones como una tira de notas y ajusta el ritmo a oído.</p>
          </div>
          <button className="btn-gold" onClick={onCreate}><Icon.plus /> Nueva canción</button>
        </div>

        <div className="list-toolbar">
          <div className="search">
            <Icon.search />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre…" spellCheck={false} />
            {query && <button className="search-x" onClick={() => setQuery("")}><Icon.close /></button>}
          </div>
          <StarFilter value={stars} onChange={setStars} />
          <div className="tb-spacer" />
          <SortToggle field={field} dir={dir} onField={setField} onDir={() => setDir((d) => d === "asc" ? "desc" : "asc")} />
        </div>

        <div className="list-meta">
          {filtered.length === 0 ? "Sin resultados" : `${filtered.length} ${filtered.length === 1 ? "canción" : "canciones"}${filtering ? (filtered.length === 1 ? " filtrada" : " filtradas") : ""}`}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="es-ring"><Icon.search /></div>
            <p>No hay canciones que coincidan.</p>
            <button className="chip-min" onClick={() => { setQuery(""); setStars(0); }}>Limpiar filtros</button>
          </div>
        ) : (
          <div className="grid">
            {pageItems.map((song) => (
              <div key={song.id} className="card" onClick={() => onOpen(song.id)}>
                <div className="cover"><Cover song={song} /></div>
                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn" onClick={() => onOpen(song.id)}><Icon.pencil /></button>
                  <button className="icon-btn danger" onClick={() => onDelete(song.id)}><Icon.trash /></button>
                </div>
                <div className="body">
                  <div className="ttl">{song.title || "Sin título"}</div>
                  <div className="meta">
                    <span className="bpm"><b>{song.bpm}</b><span>BPM</span></span>
                    <Stars value={song.stars} />
                  </div>
                </div>
              </div>
            ))}
            {showNewTile && (
              <div className="card new" onClick={onCreate}>
                <div className="plus"><div className="ring"><Icon.plus /></div>Nueva canción</div>
              </div>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="pager">
            <button className="pg-btn" disabled={curPage === 1} onClick={() => setPage(curPage - 1)}><Icon.chevL /></button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button key={i} className={"pg-num" + (i + 1 === curPage ? " on" : "")} onClick={() => setPage(i + 1)}>{i + 1}</button>
            ))}
            <button className="pg-btn" disabled={curPage === totalPages} onClick={() => setPage(curPage + 1)}><Icon.chevR /></button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /data/saxhero/frontend && npm run build 2>&1 | tail -3
```

Expected: `✓ built`

- [ ] **Step 3: Commit**

```bash
cd /data/saxhero
git add frontend/src/components/SongList.jsx
git commit -m "feat: SongList component"
```

---

## Task 8: Frontend Editor component

**Files:**
- Create: `frontend/src/components/Editor.jsx`

Port from `docs-dev/frontend files/saxhero compositor/editor.jsx`. Key changes: add imports, add `onSave`/`saving` props, remove cover-style prop, use `beats_per_bar` (snake_case) for API data.

- [ ] **Step 1: Create Editor.jsx**

Create `/data/saxhero/frontend/src/components/Editor.jsx`:
```jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Icon, KeyColumn, StaffPreview, beatToX, staffWidth } from './Ui.jsx';
import * as MUS from '../music.js';

function cumStarts(events) {
  let c = 0;
  return events.map((ev) => { const s = c; c += MUS.durBeats(ev); return s; });
}

function StepperField({ label, value, unit, onDec, onInc }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="stepper">
        <button onClick={onDec}>–</button>
        <div className="val">{value}{unit && <small>{unit}</small>}</div>
        <button onClick={onInc}>+</button>
      </div>
    </div>
  );
}

export default function Editor({ song, sideOpen, onToggleSide, onPatch, onSave, saving, onBack }) {
  const [text, setText] = useState(() => MUS.serialize(song.events || [], song.beats_per_bar));
  const [events, setEvents] = useState(() => (song.events || []).map((ev) => ({ ...ev })));
  const [sel, setSel] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [playBeat, setPlayBeat] = useState(0);
  const [speed, setSpeed] = useState(0.75);
  const [loop, setLoop] = useState(true);
  const [loopSel, setLoopSel] = useState(false);

  const fileRef = useRef(null);
  const scrollRef = useRef(null);
  const beatRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(speed);
  const loopRef = useRef(loop);
  const loopSelRef = useRef(loopSel);
  const selRef = useRef(sel);
  const eventsRef = useRef(events);
  const bpmRef = useRef(song.bpm);
  const lastT = useRef(0);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { loopSelRef.current = loopSel; }, [loopSel]);
  useEffect(() => { selRef.current = sel; }, [sel]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { bpmRef.current = song.bpm; }, [song.bpm]);

  const starts = useMemo(() => cumStarts(events), [events]);
  const total = useMemo(() => MUS.totalBeats(events), [events]);

  const activeIdx = useMemo(() => {
    for (let i = 0; i < events.length; i++) {
      if (playBeat >= starts[i] - 1e-6 && playBeat < starts[i] + MUS.durBeats(events[i]) - 1e-6) return i;
    }
    return -1;
  }, [playBeat, events, starts]);

  const onText = (v) => {
    setText(v);
    const ev = MUS.reconcile(v, eventsRef.current);
    setEvents(ev);
    onPatch({ strip: v, events: ev });
    if (selRef.current >= ev.length) setSel(ev.length - 1);
  };

  const applyEvents = useCallback((next) => {
    setEvents(next);
    const s = MUS.serialize(next, song.beats_per_bar);
    setText(s);
    onPatch({ strip: s, events: next });
  }, [song.beats_per_bar, onPatch]);

  const cur = sel >= 0 ? events[sel] : null;
  const baseIdx = cur ? MUS.LADDER_INDEX[cur.base ?? "4"] : 2;

  const setBase = (dir) => {
    if (sel < 0) return;
    const ni = Math.max(0, Math.min(MUS.LADDER.length - 1, baseIdx + dir));
    const next = events.slice();
    next[sel] = { ...next[sel], base: MUS.LADDER[ni].key };
    applyEvents(next);
  };
  const toggleDotted = () => { if (sel < 0) return; const n = events.slice(); n[sel] = { ...n[sel], dotted: !n[sel].dotted }; applyEvents(n); };
  const toggleTriplet = () => { if (sel < 0) return; const n = events.slice(); n[sel] = { ...n[sel], triplet: !n[sel].triplet }; applyEvents(n); };
  const insertRest = () => {
    const at = sel >= 0 ? sel + 1 : events.length;
    const carry = cur ? { base: cur.base, dotted: false, triplet: false } : { base: "4", dotted: false, triplet: false };
    const n = events.slice(); n.splice(at, 0, { isRest: true, ...carry });
    applyEvents(n); setSel(at);
  };
  const delEvent = () => {
    if (sel < 0) return;
    const n = events.slice(); n.splice(sel, 1);
    applyEvents(n); setSel(Math.min(sel, n.length - 1));
  };

  useEffect(() => {
    let raf;
    const frame = (t) => {
      if (!lastT.current) lastT.current = t;
      const dt = Math.min((t - lastT.current) / 1000, 0.05);
      lastT.current = t;
      if (playingRef.current) {
        const evs = eventsRef.current;
        const st = cumStarts(evs);
        const tot = MUS.totalBeats(evs);
        let lo = 0, hi = tot;
        const si = selRef.current;
        if (loopSelRef.current && si >= 0 && si < evs.length) {
          lo = st[si]; hi = st[si] + MUS.durBeats(evs[si]);
        }
        const bps = (bpmRef.current / 60) * speedRef.current;
        beatRef.current += dt * bps;
        if (beatRef.current >= hi - 1e-6) {
          if (loopRef.current || loopSelRef.current) beatRef.current = lo;
          else { beatRef.current = lo; playingRef.current = false; setPlaying(false); }
        }
        if (beatRef.current < lo) beatRef.current = lo;
        setPlayBeat(beatRef.current);
        const sc = scrollRef.current;
        if (sc) {
          const x = beatToX(beatRef.current);
          const target = x - sc.clientWidth * 0.45;
          if (Math.abs(sc.scrollLeft - target) > 2) sc.scrollLeft = Math.max(0, target);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const togglePlay = () => {
    if (playingRef.current) { playingRef.current = false; setPlaying(false); return; }
    const evs = eventsRef.current;
    const st = cumStarts(evs);
    let lo = 0;
    if (loopSelRef.current && selRef.current >= 0) lo = st[selRef.current];
    if (beatRef.current >= MUS.totalBeats(evs) - 1e-6) beatRef.current = lo;
    if (loopSelRef.current && selRef.current >= 0) beatRef.current = lo;
    lastT.current = 0; playingRef.current = true; setPlaying(true);
  };

  const onUpload = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => onPatch({ cover_image: r.result });
    r.readAsDataURL(f);
    e.target.value = "";
  };

  const refIdx = sel >= 0 ? sel : activeIdx;
  const refNote = refIdx >= 0 ? events[refIdx] : null;
  const refKeys = refNote && !refNote.isRest ? MUS.fingering(refNote) : [];
  const beatInBar = song.beats_per_bar > 0 ? Math.floor(playBeat % song.beats_per_bar) : 0;

  return (
    <div className="editor">
      <div className="ed-head">
        <button className="back-btn" onClick={onBack}><Icon.back /></button>
        <div className="ed-title-wrap">
          <span className="kicker">Editor de canción</span>
          <input className="ed-title" value={song.title} placeholder="Título"
            onChange={(e) => onPatch({ title: e.target.value })} />
        </div>
        <div className="spacer" />

        <div className="field">
          <label>Tonalidad</label>
          <div className="stepper" style={{ padding: "0 4px" }}>
            <input value={song.key_name || ""} placeholder="—" onChange={(e) => onPatch({ key_name: e.target.value })}
              style={{ width: 64, background: "transparent", border: 0, outline: 0, color: "var(--ink)", fontWeight: 700, fontSize: 15, textAlign: "center" }} />
          </div>
        </div>

        <StepperField label="BPM" value={song.bpm}
          onDec={() => onPatch({ bpm: Math.max(30, song.bpm - 2) })}
          onInc={() => onPatch({ bpm: Math.min(220, song.bpm + 2) })} />
        <StepperField label="Compás" value={song.beats_per_bar} unit="/4"
          onDec={() => onPatch({ beats_per_bar: Math.max(1, Math.min(7, song.beats_per_bar - 1)) })}
          onInc={() => onPatch({ beats_per_bar: Math.max(1, Math.min(7, song.beats_per_bar + 1)) })} />

        <div className="field">
          <label>Dificultad</label>
          <div className="stars-edit">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => onPatch({ stars: n === song.stars ? n - 1 : n })}>
                <svg viewBox="0 0 24 24" className={n <= song.stars ? "on" : "off"}><path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.9 6.6 19.4l1.2-5.9L3.4 9.4l6-.7z" fill="currentColor" /></svg>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Portada</label>
          <button className="upload-btn" onClick={() => (song.cover_image ? onPatch({ cover_image: null }) : fileRef.current.click())}>
            <Icon.upload /> {song.cover_image ? "Quitar" : "Subir"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
        </div>

        <button className={"btn-gold" + (saving ? " on" : "")} onClick={onSave} disabled={saving} style={{ marginLeft: 8 }}>
          <Icon.save /> {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>

      <div className="ed-body">
        <div className="ed-main">
          <div className="input-block">
            <div className="lbl-row">
              <span className="lbl">Tira de notas</span>
              <span className="hint">
                <code>C</code> base · <code>c</code> octava arriba · <code>A,</code> abajo · <code>F#</code>/<code>Bb</code> · <code>-</code> silencio · <code>|</code> compás
              </span>
            </div>
            <textarea className="strip-input" value={text} onChange={(e) => onText(e.target.value)}
              spellCheck={false} placeholder="Ej.  C E G c | A, F# -" rows={2} />
          </div>

          <div className="staff-block">
            <div className="staff-frame">
              <div className="staff-scroll" ref={scrollRef}>
                <div style={{ position: "relative", width: staffWidth(events), height: "100%", minHeight: 210 }}>
                  <StaffPreview events={events} beatsPerBar={song.beats_per_bar} selectedIdx={sel} activeIdx={activeIdx} onSelect={setSel} />
                  {events.length > 0 && <div className="staff-playhead" style={{ left: beatToX(playBeat) }} />}
                </div>
              </div>
              {events.length === 0 && <div className="staff-empty">Teclea una tira de notas arriba para ver el pentagrama</div>}
            </div>
          </div>

          <div className="timeline">
            <div className="tl-head">
              <span className="lbl">Línea de tiempo</span>
              <span className="count">{events.length} evento{events.length === 1 ? "" : "s"} · {(+total.toFixed(2))} tiempos</span>
            </div>
            <div className="pills">
              {events.map((ev, i) => {
                const cls = "pill" + (i === sel ? " sel" : "") + (i === activeIdx ? " active" : "") + (ev.isRest ? " rest" : "");
                return (
                  <button key={i} className={cls} onClick={() => setSel(i === sel ? -1 : i)}>
                    {ev.dotted && <span className="badge">·</span>}
                    {ev.triplet && <span className="badge" style={{ right: ev.dotted ? 12 : -6 }}>3</span>}
                    {ev.isRest
                      ? <span className="pname" style={{ color: "var(--ink-faint)", fontFamily: "var(--music)", fontSize: 22 }}>{MUS.restGlyph(ev)}</span>
                      : <span className="pname">{ev.letter}{ev.acc && <sup>{ev.acc === "#" ? "♯" : "♭"}</sup>}</span>}
                    <span className="pglyph">{MUS.durGlyph(ev)}</span>
                    <span className="pdur">{ev.isRest ? "silencio" : MUS.LADDER[MUS.LADDER_INDEX[ev.base ?? "4"]].name.slice(0, 7)}</span>
                  </button>
                );
              })}
              {events.length === 0 && <div style={{ color: "var(--ink-faint)", fontSize: 13, padding: "22px 4px" }}>Sin eventos todavía.</div>}
            </div>

            <div className="dur-bar">
              {cur ? (
                <>
                  <div className="sel-name">{cur.isRest ? "Silencio" : <>{cur.letter}{cur.acc}</>}</div>
                  <div className="sep" />
                  <div className="dur-step">
                    <button onClick={() => setBase(-1)} disabled={baseIdx <= 0}>–</button>
                    <div className="dval"><span className="g">{MUS.durGlyph(cur)}</span><span className="t">{MUS.LADDER[baseIdx].name}</span></div>
                    <button onClick={() => setBase(1)} disabled={baseIdx >= MUS.LADDER.length - 1}>+</button>
                  </div>
                  <button className={"chip-toggle" + (cur.dotted ? " on" : "")} onClick={toggleDotted}><span className="dot" /> Puntillo</button>
                  <button className={"chip-toggle" + (cur.triplet ? " on" : "")} onClick={toggleTriplet}>3 Tresillo</button>
                  <div className="sep" />
                  <button className="chip-toggle" onClick={insertRest}><Icon.plus style={{ width: 14, height: 14 }} /> Silencio</button>
                  <button className="chip-toggle danger" onClick={delEvent}><Icon.trash style={{ width: 15, height: 15 }} /> Borrar</button>
                </>
              ) : (
                <div style={{ color: "var(--ink-faint)", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                  Selecciona un evento para ajustar su duración, o
                  <button className="chip-toggle" onClick={insertRest}><Icon.plus style={{ width: 14, height: 14 }} /> Insertar silencio</button>
                </div>
              )}
            </div>
          </div>

          <div className="playbar">
            <button className={"play-btn" + (playing ? " on" : "")} onClick={togglePlay}>
              {playing ? <Icon.pause /> : <Icon.play />}
            </button>
            <div className="beatdots">
              {Array.from({ length: song.beats_per_bar }).map((_, i) => (
                <i key={i} className={playing && i === beatInBar ? "on" : ""} />
              ))}
            </div>
            <div className="speed">
              <span className="cap">Velocidad</span>
              <input type="range" className="brass" min="0.4" max="1" step="0.05" value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))} style={{ "--pct": ((speed - 0.4) / 0.6) * 100 + "%" }} />
              <span className="val">{speed.toFixed(2)}×</span>
            </div>
            <div className="spacer" />
            <button className={"loop-btn" + (loopSel ? " on" : "")} onClick={() => setLoopSel((v) => !v)}>
              <Icon.loop /> Bucle sel.
            </button>
            <button className={"loop-btn" + (loop ? " on" : "")} onClick={() => setLoop((v) => !v)}>
              <Icon.loop /> Loop
            </button>
            <button className={"loop-btn" + (sideOpen ? " on" : "")} onClick={onToggleSide}>
              <Icon.panel />
            </button>
          </div>
        </div>

        <aside className={"ed-side" + (sideOpen ? "" : " hidden")}>
          <div className="side-sect-lbl">Digitación · Saxo alto</div>
          {refNote && !refNote.isRest ? (
            <div className="fing-card">
              <div className="fing-head">
                <div className="note">{refNote.letter}{refNote.acc && <sup>{refNote.acc === "#" ? "♯" : "♭"}</sup>}</div>
                <div className="reg">{MUS.registerName(refNote)}</div>
              </div>
              <div style={{ display: "grid", placeItems: "center", padding: "4px 0 10px" }}>
                <KeyColumn keys={refKeys} width={120} />
              </div>
              <div className="legend">
                <div className="lrow octave"><i /> Llave de octava</div>
                <div className="lrow left"><i /> Mano izquierda</div>
                <div className="lrow right"><i /> Mano derecha</div>
              </div>
            </div>
          ) : (
            <div className="fing-card"><div className="fing-empty">{refNote ? "Silencio — sin digitación." : "Selecciona o reproduce una nota."}</div></div>
          )}
          <div>
            <div className="side-sect-lbl" style={{ marginBottom: 9 }}>Referencia</div>
            <p className="side-info">Cada nota entra como <b>negra</b>. Selecciona una pill y usa <b>+/–</b> para cambiar la figura. El bucle de selección repite la nota para afinarla a oído.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /data/saxhero/frontend && npm run build 2>&1 | tail -5
```

Expected: `✓ built`

- [ ] **Step 3: Commit**

```bash
cd /data/saxhero
git add frontend/src/components/Editor.jsx
git commit -m "feat: Editor component with pill timeline and visual playback"
```

---

## Task 9: Frontend App — routing + API wiring

**Files:**
- Modify: `frontend/src/App.jsx`

Replace the hello world App.jsx with full routing + API state management.

- [ ] **Step 1: Write App.jsx**

Replace `/data/saxhero/frontend/src/App.jsx` entirely:
```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Bokeh } from './components/Ui.jsx';
import SongList from './components/SongList.jsx';
import Editor from './components/Editor.jsx';
import * as MUS from './music.js';
import * as api from './api.js';

// Convert API event (DB format + base/dotted/triplet) → local editor format
function apiToLocal(ev) {
  if (ev.kind === "rest") {
    return { isRest: true, base: ev.base || "4", dotted: ev.dotted || false, triplet: ev.triplet || false };
  }
  const letter = ev.pitch;
  const acc = ev.accidental === "sharp" ? "#" : ev.accidental === "flat" ? "b" : "";
  const octave = ev.octave;
  return {
    isRest: false, letter, acc, octave,
    pitch: letter + acc + octave,
    step: MUS.stepOf(letter, octave),
    base: ev.base || "4", dotted: ev.dotted || false, triplet: ev.triplet || false,
  };
}

// Convert local editor event → API format for PUT
function localToApi(ev, position) {
  return {
    position,
    kind: ev.isRest ? "rest" : "note",
    pitch: ev.isRest ? null : ev.letter,
    accidental: ev.isRest ? null : (ev.acc === "#" ? "sharp" : ev.acc === "b" ? "flat" : null),
    octave: ev.isRest ? null : ev.octave,
    duration_beats: MUS.durBeats(ev),
  };
}

export default function App() {
  const [songs, setSongs] = useState([]);
  const [route, setRoute] = useState({ screen: "list", id: null });
  const [currentSong, setCurrentSong] = useState(null);
  const [sideOpen, setSideOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getSongs().then(setSongs).catch(console.error);
  }, []);

  const openSong = useCallback(async (id) => {
    setLoading(true);
    try {
      const song = await api.getSong(id);
      const localEvents = (song.events || []).map(apiToLocal);
      setCurrentSong({ ...song, events: localEvents });
      setRoute({ screen: "editor", id });
    } finally {
      setLoading(false);
    }
  }, []);

  const goList = useCallback(() => {
    setCurrentSong(null);
    setRoute({ screen: "list", id: null });
    api.getSongs().then(setSongs).catch(console.error);
  }, []);

  const createSong = useCallback(async () => {
    const song = await api.createSong(MUS.blankSong());
    setSongs((prev) => [song, ...prev]);
    await openSong(song.id);
  }, [openSong]);

  const deleteSong = useCallback(async (id) => {
    await api.deleteSong(id);
    setSongs((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const patchSong = useCallback((patch) => {
    setCurrentSong((prev) => prev ? { ...prev, ...patch } : prev);
  }, []);

  const saveSong = useCallback(async () => {
    if (!currentSong) return;
    setSaving(true);
    try {
      await api.updateSong(currentSong.id, {
        title: currentSong.title,
        bpm: currentSong.bpm,
        beats_per_bar: currentSong.beats_per_bar,
        stars: currentSong.stars || 1,
        key_name: currentSong.key_name || null,
        cover_image: currentSong.cover_image || null,
        events: (currentSong.events || []).map(localToApi),
      });
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [currentSong]);

  if (loading) {
    return (
      <div className="app" style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <span style={{ color: "var(--ink-dim)", fontSize: 14 }}>Cargando…</span>
      </div>
    );
  }

  return (
    <div className="app">
      <Bokeh />
      <div className="titlebar">
        <div className="dots"><i /><i /><i /></div>
        <div className="brand">
          <span className="mark">♪</span>
          <b>SaxHero</b> Compositor
        </div>
        <div className="spacer" />
        <div className="crumbs">
          {route.screen === "editor" && currentSong
            ? (currentSong.title || "Sin título")
            : `${songs.length} canciones`}
        </div>
      </div>
      <div className="view">
        {route.screen === "editor" && currentSong ? (
          <Editor
            key={currentSong.id}
            song={currentSong}
            sideOpen={sideOpen}
            onToggleSide={() => setSideOpen((v) => !v)}
            onPatch={patchSong}
            onSave={saveSong}
            saving={saving}
            onBack={goList}
          />
        ) : (
          <SongList
            songs={songs}
            onOpen={openSong}
            onCreate={createSong}
            onDelete={deleteSong}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build the frontend**

```bash
cd /data/saxhero/frontend
npm run build 2>&1
```

Expected: `✓ built in Xs` — no errors, no warnings about undefined variables.

- [ ] **Step 3: Deploy**

```bash
sudo systemctl restart saxhero
```

The saxhero.service already serves the API on port 8000. nginx on 5050 serves `frontend/dist/` (already built). Rebuild updates the static files.

- [ ] **Step 4: Smoke test**

Open `http://seb01:5050` in browser (Tailscale).

Verify:
1. Dark page loads with "Tu repertorio" heading (not "Sax Hero scaffolding")
2. "Nueva canción" button creates a song and opens editor
3. Typing `C E G c` in the strip shows notes on the staff
4. Clicking a pill highlights it and shows duration controls
5. "Guardar" button saves without error
6. Back button returns to list, song appears in grid

- [ ] **Step 5: Commit**

```bash
cd /data/saxhero
git add frontend/src/App.jsx
git commit -m "feat: phase 1 complete — editor wired to API"
```

---

## Phase 1 Done — Checklist

- [ ] Schema: `songs` has `stars`, `key_name`, `cover_image`
- [ ] `GET /api/songs/` returns list
- [ ] `POST /api/songs/` creates song
- [ ] `GET /api/songs/{id}` returns song with events + base/dotted/triplet
- [ ] `PUT /api/songs/{id}` replaces events
- [ ] `DELETE /api/songs/{id}` removes song
- [ ] All 25 tests pass (`pytest tests/ -v`)
- [ ] Frontend: song list loads from API
- [ ] Frontend: create → editor → type notes → see staff + pills
- [ ] Frontend: adjust durations → Guardar → reload → durations preserved
- [ ] `npm run build` clean, `http://seb01:5050` shows real UI
