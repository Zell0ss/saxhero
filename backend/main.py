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
