import os

import pymysql
import pymysql.cursors
from dotenv import load_dotenv

load_dotenv()


def get_db_connection() -> pymysql.Connection:
    return pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "josem"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "saxhero_db"),
        cursorclass=pymysql.cursors.DictCursor,
    )
