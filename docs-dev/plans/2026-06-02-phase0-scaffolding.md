# Phase 0 — Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a "hello world" Sax Hero stack on seb01 — FastAPI backend + React/Vite frontend + MariaDB schema, accessible via Tailscale on port 5050.

**Architecture:** FastAPI (uvicorn on 127.0.0.1:8000) handles `/api/*`; nginx (port 5050) serves the Vite `dist/` and proxies `/api/` upstream. MariaDB holds `saxhero_db` with the two-table schema. systemd manages the backend process. Vector/LogCentral aggregates JSON logs from `/data/saxhero/logs/saxhero.log`.

**Tech Stack:** Python 3.11 + FastAPI + PyMySQL + loguru · Node 18+ + Vite + React + Tailwind v3 · MariaDB 10.x · nginx · systemd · Vector (Docker)

---

## File Map

```
/data/saxhero/
├── .gitignore
├── backend/
│   ├── main.py          # FastAPI app + routes
│   ├── db.py            # PyMySQL connection
│   ├── logger.py        # loguru + LogCentral JSON sink
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── .env             # NOT committed — DB credentials
│   ├── .env.example     # committed template
│   └── tests/
│       ├── test_health.py
│       └── test_db.py
├── frontend/            # Vite project root
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── tailwind.config.js
├── sql/
│   └── schema.sql
├── deploy/
│   ├── saxhero.service
│   └── saxhero-nginx.conf
└── logs/                # NOT committed — runtime log dir
    └── saxhero.log      # written by loguru, read by Vector
```

---

## Task 1: Git repo + directory skeleton

**Files:** `/data/saxhero/.gitignore`

- [ ] **Step 1: Init git repo and create directories**

```bash
cd /data/saxhero
git init
mkdir -p backend/tests frontend sql deploy logs
```

- [ ] **Step 2: Create .gitignore**

Create `/data/saxhero/.gitignore`:
```
# Python
backend/.venv/
backend/__pycache__/
backend/.env
backend/logs/
*.pyc

# Frontend
frontend/node_modules/
frontend/dist/

# Runtime
logs/
*.log
```

- [ ] **Step 3: Initial commit**

```bash
cd /data/saxhero
git add .gitignore
git commit -m "chore: init saxhero repo"
```

Expected output: `[main (root-commit) xxxxxxx] chore: init saxhero repo`

---

## Task 2: SQL schema

**Files:** `sql/schema.sql`

- [ ] **Step 1: Write schema.sql**

Create `/data/saxhero/sql/schema.sql`:
```sql
CREATE DATABASE IF NOT EXISTS saxhero_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'saxhero'@'localhost' IDENTIFIED BY 'saxhero_dev_pw';
GRANT ALL ON saxhero_db.* TO 'saxhero'@'localhost';
FLUSH PRIVILEGES;

USE saxhero_db;

CREATE TABLE IF NOT EXISTS songs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  bpm           SMALLINT NOT NULL DEFAULT 100,
  beats_per_bar TINYINT  NOT NULL DEFAULT 4,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS song_events (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  song_id        INT NOT NULL,
  position       INT NOT NULL,
  kind           ENUM('note','rest') NOT NULL,
  pitch          CHAR(1) NULL,
  accidental     ENUM('sharp','flat') NULL,
  octave         TINYINT NULL,
  duration_beats DECIMAL(5,3) NOT NULL DEFAULT 1,
  CONSTRAINT fk_song FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
  UNIQUE KEY uq_song_position (song_id, position)
);
```

> ⚠️ Change the password `saxhero_dev_pw` to something real before running.

- [ ] **Step 2: Run schema against MariaDB**

```bash
sudo mariadb -u root -p < /data/saxhero/sql/schema.sql
```

Expected: no errors.

- [ ] **Step 3: Verify tables exist**

```bash
sudo mariadb -u root -p -e "USE saxhero_db; SHOW TABLES; DESCRIBE songs; DESCRIBE song_events;"
```

Expected output: both tables listed, columns match schema.

- [ ] **Step 4: Update .env.example and commit**

Create `/data/saxhero/backend/.env.example`:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=saxhero
DB_PASSWORD=saxhero_dev_pw
DB_NAME=saxhero_db
```

```bash
cd /data/saxhero
git add sql/schema.sql backend/.env.example
git commit -m "feat: add DB schema and env template"
```

---

## Task 3: Backend — Python venv + deps

**Files:** `backend/requirements.txt`, `backend/pytest.ini`

- [ ] **Step 1: Create venv and requirements.txt**

Create `/data/saxhero/backend/requirements.txt`:
```
fastapi==0.115.6
uvicorn[standard]==0.32.1
pymysql==1.1.1
python-dotenv==1.0.1
loguru==0.7.2
pytest==8.3.4
httpx==0.28.1
```

- [ ] **Step 2: Create venv and install**

```bash
cd /data/saxhero/backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Expected: no errors. Verify with:
```bash
python -c "import fastapi, pymysql, loguru; print('OK')"
```
Expected output: `OK`

- [ ] **Step 3: Create pytest.ini**

Create `/data/saxhero/backend/pytest.ini`:
```ini
[pytest]
testpaths = tests
```

- [ ] **Step 4: Commit**

```bash
cd /data/saxhero
git add backend/requirements.txt backend/pytest.ini
git commit -m "chore: backend python deps and pytest config"
```

---

## Task 4: Backend — health endpoint (TDD)

**Files:** `backend/logger.py`, `backend/main.py`, `backend/tests/test_health.py`

- [ ] **Step 1: Write the failing test**

Create `/data/saxhero/backend/tests/test_health.py`:
```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_returns_ok():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "service": "saxhero"}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /data/saxhero/backend
source .venv/bin/activate
pytest tests/test_health.py -v
```

Expected: `ERROR` — `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 3: Write logger.py**

Create `/data/saxhero/backend/logger.py`:
```python
import json
import os
import sys
from pathlib import Path

from loguru import logger

_LOG_PATH = Path(os.getenv("SAXHERO_LOG_PATH", "/data/saxhero/logs/saxhero.log"))


def setup_logger():
    _LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    logger.remove()
    logger.add(sys.stderr, level="INFO", format="{time:HH:mm:ss} | {level} | {message}")

    def _json_sink(message):
        record = message.record
        entry = {
            "timestamp": record["time"].strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "level": record["level"].name,
            "source": "saxhero",
            "message": record["message"],
        }
        with open(_LOG_PATH, "a") as f:
            f.write(json.dumps(entry) + "\n")

    logger.add(_json_sink, level="INFO")
    return logger
```

- [ ] **Step 4: Write main.py with /api/health**

Create `/data/saxhero/backend/main.py`:
```python
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI

from logger import setup_logger

load_dotenv()
log = setup_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("saxhero starting")
    yield
    log.info("saxhero stopped")


app = FastAPI(lifespan=lifespan)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "saxhero"}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /data/saxhero/backend
pytest tests/test_health.py -v
```

Expected:
```
PASSED tests/test_health.py::test_health_returns_ok
1 passed in 0.XXs
```

- [ ] **Step 6: Commit**

```bash
cd /data/saxhero
git add backend/logger.py backend/main.py backend/tests/test_health.py
git commit -m "feat: FastAPI skeleton with /api/health endpoint"
```

---

## Task 5: Backend — DB health endpoint (TDD)

**Files:** `backend/db.py`, `backend/main.py` (modified), `backend/tests/test_db.py`

- [ ] **Step 1: Write the failing test**

Create `/data/saxhero/backend/tests/test_db.py`:
```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_db_health_returns_ok():
    r = client.get("/api/db-health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["db"] == "saxhero_db"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /data/saxhero/backend
source .venv/bin/activate
pytest tests/test_db.py -v
```

Expected: `FAILED` — 404 (route doesn't exist yet)

- [ ] **Step 3: Create .env with real credentials**

Create `/data/saxhero/backend/.env` (NOT committed):
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=saxhero
DB_PASSWORD=saxhero_dev_pw
DB_NAME=saxhero_db
```

> Use the same password set in Task 2.

- [ ] **Step 4: Write db.py**

Create `/data/saxhero/backend/db.py`:
```python
import os

import pymysql
import pymysql.cursors
from dotenv import load_dotenv

load_dotenv()


def get_db_connection() -> pymysql.Connection:
    return pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "saxhero"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "saxhero_db"),
        cursorclass=pymysql.cursors.DictCursor,
    )
```

- [ ] **Step 5: Replace main.py with updated version including /api/db-health**

Replace `/data/saxhero/backend/main.py` entirely:
```python
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from db import get_db_connection
from logger import setup_logger

load_dotenv()
log = setup_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("saxhero starting")
    yield
    log.info("saxhero stopped")


app = FastAPI(lifespan=lifespan)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "saxhero"}


@app.get("/api/db-health")
def db_health():
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        conn.close()
        return {"status": "ok", "db": "saxhero_db"}
    except Exception as e:
        log.error(f"DB health check failed: {e}")
        raise HTTPException(status_code=503, detail=str(e))
```

- [ ] **Step 6: Run both tests to verify they pass**

```bash
cd /data/saxhero/backend
pytest tests/ -v
```

Expected:
```
PASSED tests/test_health.py::test_health_returns_ok
PASSED tests/test_db.py::test_db_health_returns_ok
2 passed in 0.XXs
```

- [ ] **Step 7: Commit**

```bash
cd /data/saxhero
git add backend/db.py backend/main.py backend/tests/test_db.py
git commit -m "feat: add /api/db-health endpoint and PyMySQL connection"
```

---

## Task 6: Frontend skeleton (Vite + React + Tailwind)

**Files:** `frontend/` (full Vite project)

- [ ] **Step 1: Scaffold Vite React project**

```bash
cd /data/saxhero/frontend
npm create vite@latest . -- --template react
```

When prompted "Current directory is not empty. Remove existing files and continue?" — answer `y` only if the directory is empty (it should be).

- [ ] **Step 2: Install dependencies + Tailwind**

```bash
cd /data/saxhero/frontend
npm install
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

Edit `/data/saxhero/frontend/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 4: Add Tailwind directives to CSS**

Replace the contents of `/data/saxhero/frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Write hello world App.jsx**

Replace `/data/saxhero/frontend/src/App.jsx`:
```jsx
export default function App() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">Sax Hero</h1>
        <p className="mt-2 text-gray-400 text-lg">Phase 0 — scaffolding OK</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Build and verify**

```bash
cd /data/saxhero/frontend
npm run build
```

Expected: `dist/` created, output ends with `✓ built in Xs`

```bash
ls dist/
```

Expected: `index.html`, `assets/`

- [ ] **Step 7: Commit**

```bash
cd /data/saxhero
git add frontend/
git commit -m "feat: Vite+React+Tailwind frontend hello world"
```

---

## Task 7: systemd service

**Files:** `deploy/saxhero.service`

- [ ] **Step 1: Write the service unit**

Create `/data/saxhero/deploy/saxhero.service`:
```ini
[Unit]
Description=Saxhero FastAPI backend
After=network.target mariadb.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/data/saxhero/backend
EnvironmentFile=/data/saxhero/backend/.env
ExecStart=/data/saxhero/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Install and enable service**

```bash
sudo cp /data/saxhero/deploy/saxhero.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable saxhero
sudo systemctl start saxhero
```

- [ ] **Step 3: Verify service is running**

```bash
sudo systemctl status saxhero
```

Expected: `active (running)`

```bash
curl -s http://127.0.0.1:8000/api/health
```

Expected: `{"status":"ok","service":"saxhero"}`

- [ ] **Step 4: Commit**

```bash
cd /data/saxhero
git add deploy/saxhero.service
git commit -m "feat: systemd service for uvicorn"
```

---

## Task 8: nginx vhost (port 5050)

**Files:** `deploy/saxhero-nginx.conf`

- [ ] **Step 1: Write nginx config**

Create `/data/saxhero/deploy/saxhero-nginx.conf`:
```nginx
server {
    listen 5050;
    server_name _;

    root /data/saxhero/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: Install and test config**

```bash
sudo cp /data/saxhero/deploy/saxhero-nginx.conf /etc/nginx/sites-available/saxhero
sudo ln -s /etc/nginx/sites-available/saxhero /etc/nginx/sites-enabled/saxhero
sudo nginx -t
```

Expected: `syntax is ok` / `test is successful`

- [ ] **Step 3: Reload nginx**

```bash
sudo systemctl reload nginx
```

- [ ] **Step 4: Verify locally**

```bash
curl -s http://127.0.0.1:5050/api/health
```

Expected: `{"status":"ok","service":"saxhero"}`

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5050/
```

Expected: `200`

- [ ] **Step 5: Verify via Tailscale**

From any Tailscale device, open `http://seb01:5050` in browser.
Expected: dark page with "Sax Hero" heading.

- [ ] **Step 6: Update STACK.md with new port**

Edit `/data/claude-dotfiles/STACK.md` — add row to the port table after port 4343:
```
| 5050 | **saxhero** (nginx frontend) | nginx | 0.0.0.0 | Tailscale-only | SPA + /api proxy → uvicorn :8000 |
```

- [ ] **Step 7: Commit**

```bash
cd /data/saxhero
git add deploy/saxhero-nginx.conf
git commit -m "feat: nginx vhost on port 5050 serving SPA + API proxy"
```

---

## Task 9: LogCentral — register saxhero source

**Files:** `/data/logcentral/vector/vector.toml`

- [ ] **Step 1: Verify log file is being written**

Trigger a request to create at least one log line:
```bash
curl -s http://127.0.0.1:8000/api/health
tail -5 /data/saxhero/logs/saxhero.log
```

Expected: JSON line with `"source":"saxhero"`.

If the file doesn't exist yet, check that the `logs/` directory exists:
```bash
ls /data/saxhero/logs/
```

If missing: `mkdir -p /data/saxhero/logs/` then restart saxhero: `sudo systemctl restart saxhero`.

- [ ] **Step 2: Add saxhero source to vector.toml**

Edit `/data/logcentral/vector/vector.toml`.

Add after the last `[sources.*]` block (after `[sources.gotasdivinas]`):
```toml
[sources.saxhero]
type = "file"
include = ["/data/saxhero/logs/saxhero.log"]
read_from = "beginning"
```

Add after the last `[transforms.parse_*]` block (after `[transforms.parse_gotasdivinas]`):
```toml
[transforms.parse_saxhero]
type = "remap"
inputs = ["saxhero"]
source = '''
  parsed, err = parse_json(.message)
  if err == null {
    . = parsed
  } else {
    .source = "saxhero"
    .level = "INFO"
  }
  del(.host)
  del(.source_type)
  del(.file)
'''
```

Add `parse_saxhero` to both sink `inputs` arrays:

In `[transforms.grafana_filter]`, change:
```toml
inputs = ["parse_scroogebot", "parse_clauderedditor", "parse_clauderedditor_json", "parse_n8n", "parse_piesplanos", "filter_mangataro", "parse_gotasdivinas"]
```
to:
```toml
inputs = ["parse_scroogebot", "parse_clauderedditor", "parse_clauderedditor_json", "parse_n8n", "parse_piesplanos", "filter_mangataro", "parse_gotasdivinas", "parse_saxhero"]
```

In `[sinks.local_ndjson]`, same change to its `inputs` array.

- [ ] **Step 3: Restart Vector and verify**

```bash
cd /data/logcentral/vector
docker compose restart
sleep 3
docker compose ps
```

Expected: vector container `Up`

```bash
grep '"source":"saxhero"' /data/logcentral/logs/all.ndjson | tail -3
```

Expected: JSON lines with `"source":"saxhero"`.

- [ ] **Step 4: Final commit**

```bash
cd /data/saxhero
git add -A
git status  # verify nothing sensitive is staged
git commit -m "chore: phase 0 complete — scaffolding done"
```

---

## Phase 0 Done — Checklist

- [ ] `curl http://127.0.0.1:8000/api/health` → `{"status":"ok","service":"saxhero"}`
- [ ] `curl http://127.0.0.1:8000/api/db-health` → `{"status":"ok","db":"saxhero_db"}`
- [ ] `http://seb01:5050` in browser (Tailscale) → Sax Hero page
- [ ] `sudo systemctl status saxhero` → active
- [ ] `grep saxhero /data/logcentral/logs/all.ndjson` → entries present
- [ ] Both pytest tests pass
