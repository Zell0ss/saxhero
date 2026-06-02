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
