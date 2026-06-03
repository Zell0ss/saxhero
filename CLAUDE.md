# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project

SaxHero — app personal para transcribir y practicar canciones de saxo alto. Editor en escritorio + player tipo Guitar Hero en móvil. Sin auth, acceso solo vía Tailscale.

**Design docs (fuente de verdad):**
- `docs-dev/1-design.md` — arquitectura, modelo de datos, fases, decisiones cerradas
- `docs-dev/2-frontend.md` — UI/visual, motor, mapping datos→UI, fases del frontend

Leer ambos antes de proponer cambios de arquitectura o de UI.

---

## Commands

### Backend

```bash
# Always activate venv first
source backend/.venv/bin/activate

# Dev (runs on :8000)
uvicorn main:app --reload --host 127.0.0.1 --port 8000
# (run from backend/)

# Tests
cd backend && pytest

# Install deps
cd backend && pip install -r requirements.txt
```

**Never use global pip or system Python** — always `backend/.venv`.

### Frontend

```bash
cd frontend

npm run dev      # Vite dev server on :5173
npm run build    # Output → frontend/dist/
npm run lint     # ESLint
npm run preview  # Preview production build
```

### Deploy (seb01)

```bash
# Frontend: build + let nginx serve dist/
cd frontend && npm run build

# Backend service
sudo systemctl restart saxhero.service
sudo systemctl status saxhero.service

# Logs
journalctl -u saxhero.service -f
```

---

## Environment

Backend reads `backend/.env` (template: `backend/.env.example`):

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=josem
DB_PASSWORD=
DB_NAME=saxhero_db
SAXHERO_LOG_PATH=/data/saxhero/logs/saxhero.log
```

---

## Architecture

```
Browser (PC editor / mobile player) — Tailscale only
  → nginx :5050  (sirve SPA desde frontend/dist/ + proxy /api/* → :8000)
      → uvicorn :8000 (FastAPI, 127.0.0.1 only)
          → PyMySQL → MariaDB saxhero_db (localhost:3306)
```

**No CORS config in FastAPI** — same-origin guaranteed by nginx proxy. If frontend and API ever split, add `CORSMiddleware`.

### Key modules

| File | Role |
|---|---|
| `backend/main.py` | FastAPI app, lifespan, health endpoints |
| `backend/songs.py` | CRUD routes (`/api/songs/`), Pydantic models, `_enrich_events()` |
| `backend/db.py` | `get_db_connection()` — new PyMySQL connection per request |
| `backend/parser.py` | Note notation parser, `_DURATION_TABLE` (beats → figure) |
| `backend/logger.py` | Loguru setup (stderr + JSON sink) |
| `frontend/src/api.js` | Fetch wrapper for all API calls |
| `frontend/src/music.js` | Note theory: pitch↔step, duration parsing, serialization |
| `frontend/src/components/Editor.jsx` | Editor principal (pill timeline, pentagrama, playback) |
| `frontend/src/components/SongList.jsx` | Lista de canciones |
| `frontend/src/components/Ui.jsx` | Shared UI primitives (Icon, KeyColumn, StaffPreview) |

---

## Data Model

Two tables: `songs` + `song_events` (one row per note/rest). See `sql/schema.sql` for full DDL.

**Full-replace pattern:** The editor sends the entire event array on save. Backend DELETEs all old events for the song and INSERTs new ones. No partial update of individual events.

**Duration encoding:** `duration_beats` as DECIMAL (1.0 = quarter, 0.5 = eighth, ~0.333 = triplet). `parser.py` has the reverse lookup to reconstruct the figure name.

---

## Notation System

Input format: `C E G c | A, F# -`

| Notation | Octave | Example |
|---|---|---|
| `C,` | 3 (grave) | `Bb,` = Si♭3 |
| `C` | 4 (central) | uppercase, no mark |
| `c` | 5 (alta) | lowercase, no mark |
| `c'` | 6 (sobreagudo) | `f#'` = Fa#6 |

- `#` / `b` for accidentals; `-` for rest; `|` is a visual separator, ignored by parser.
- **Storage is canonical:** pitch = uppercase letter A–G, accidental = null/sharp/flat, octave = integer 3–6.
- `parser.py` (backend) and `music.js` (frontend) both implement this notation. **Keep them in sync** if the grammar changes.

---

## Phases

| Fase | Estado |
|---|---|
| 0 — Andamiaje | ✅ |
| 1 — Datos + Editor (CRUD, pill timeline, pentagrama preview) | ✅ |
| 2 — Audio + ajuste a oído (Tone.js, bucle+nudge, metrónomo) | ⏳ next |
| 3 — Player Sax Hero (scroller D→I, móvil, slider velocidad) | ⏳ |
| 4 — Digitaciones (tabla alto, carriles+colores Saxplained) | ⏳ |

---

## Gotchas

- **No pagination** — `GET /api/songs/` returns all songs. Fine for personal use.
- **No auth** — Tailscale is the security boundary. Never expose nginx port 5050 publicly.
- **SQL migrations** in `sql/` (e.g., `migration_001_songs_fields.sql`) — run manually on seb01 MariaDB.
- **Log dir** — if `/data/saxhero/logs/` doesn't exist or isn't writable, JSON log sink silently disables. No crash.
- **Health endpoints** — `/api/health` (always 200), `/api/db-health` (503 if DB down).
