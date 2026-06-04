# SaxHero 🎷

Personal app to transcribe and practice alto sax songs — Guitar Hero style.

![SaxHero Compositor](saxhero%20compositor.png)

## What it does

Two modes:

**Compositor (desktop)** — Type a song as a string of note names, adjust durations by ear with loop playback, and save to the library.

**Player (mobile)** — Notes scroll right-to-left like Guitar Hero. Designed for the phone on the lyre stand, hands on the sax. Fingering diagram included.

![SaxHero Player](saxhero%20player.png)

## Note notation

```
C E G c | A, F# -
```

| Syntax | Octave | Example |
|--------|--------|---------|
| `C,`   | 3 (low) | `Bb,` = B♭3 |
| `C`    | 4 (middle) | uppercase, no mark |
| `c`    | 5 (high) | lowercase, no mark |
| `c'`   | 6 (very high) | `f#'` = F#6 |

`#` / `b` for accidentals · `-` for rest · `|` bar separator (ignored by parser)

## Stack

- **Frontend:** React + Vite + Tailwind (SPA)
- **Backend:** FastAPI + PyMySQL (Python 3.11)
- **DB:** MariaDB (`saxhero_db`)
- **Audio:** Tone.js (AMSynth)
- **Deploy:** systemd + nginx, Tailscale-only access

## Running locally

```bash
# Backend
cd backend && source .venv/bin/activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Frontend
cd frontend && npm run dev
```

Or use the Makefile:

```bash
make dev        # frontend dev server (:5173)
make dev-back   # backend with reload (:8000)
make deploy     # build + restart service
make logs       # live service logs
```

## Architecture

```
Browser (PC editor / mobile player) — Tailscale only
  → nginx :5050  (serves SPA from frontend/dist/ + proxy /api/* → :8000)
      → uvicorn :8000 (FastAPI, 127.0.0.1 only)
          → PyMySQL → MariaDB saxhero_db
```

## Phases

| Phase | Status |
|-------|--------|
| 0 — Scaffolding | ✅ |
| 1 — Data + Editor (CRUD, timeline, staff preview) | ✅ |
| 2 — Audio + ear-tuning (Tone.js, loop+nudge, metronome) | ✅ |
| 3 — Sax Hero Player (scroller, mobile-first, speed slider) | ✅ |
| 4 — Fingerings (alto sax key diagram, color-coded) | ✅ |

---

Alto sax only. No auth — Tailscale is the security boundary.
