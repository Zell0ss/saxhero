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
