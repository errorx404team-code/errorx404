import os
import sqlite3
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./modernization.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _get_sqlite_path() -> str:
    return DATABASE_URL.replace("sqlite:///", "").replace("./", "")


def _sqlite_columns(cursor, table: str):
    cursor.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cursor.fetchall()]


def _sqlite_tables(cursor):
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    return [row[0] for row in cursor.fetchall()]


def ensure_relative_path_column():
    if not DATABASE_URL.startswith("sqlite"):
        return
    try:
        conn = sqlite3.connect(_get_sqlite_path())
        cols = _sqlite_columns(conn.cursor(), "routines")
        if "relative_path" not in cols:
            conn.execute("ALTER TABLE routines ADD COLUMN relative_path VARCHAR(500)")
            conn.commit()
        conn.close()
    except Exception:
        pass


def ensure_workspace_id_column():
    if not DATABASE_URL.startswith("sqlite"):
        return
    try:
        conn = sqlite3.connect(_get_sqlite_path())
        cols = _sqlite_columns(conn.cursor(), "routines")
        if "workspace_id" not in cols:
            conn.execute("ALTER TABLE routines ADD COLUMN workspace_id VARCHAR(100)")
            conn.commit()
        conn.close()
    except Exception:
        pass


def ensure_new_columns():
    """
    Safe, additive migrations for all new columns added in this update.
    Never drops or modifies existing columns — only ADDs missing ones.
    """
    if not DATABASE_URL.startswith("sqlite"):
        return
    try:
        conn = sqlite3.connect(_get_sqlite_path())
        tables = _sqlite_tables(conn.cursor())

        # routines.file_action
        if "routines" in tables:
            cols = _sqlite_columns(conn.cursor(), "routines")
            if "file_action" not in cols:
                conn.execute("ALTER TABLE routines ADD COLUMN file_action VARCHAR(50) DEFAULT 'CONVERT'")

        # conversions.traceability_header
        if "conversions" in tables:
            cols = _sqlite_columns(conn.cursor(), "conversions")
            if "traceability_header" not in cols:
                conn.execute("ALTER TABLE conversions ADD COLUMN traceability_header TEXT")

        # test_cases.test_type
        if "test_cases" in tables:
            cols = _sqlite_columns(conn.cursor(), "test_cases")
            if "test_type" not in cols:
                conn.execute("ALTER TABLE test_cases ADD COLUMN test_type VARCHAR(50) DEFAULT 'unit'")

        # confidence_scores new fields
        if "confidence_scores" in tables:
            cols = _sqlite_columns(conn.cursor(), "confidence_scores")
            if "dependency_preservation_pct" not in cols:
                conn.execute("ALTER TABLE confidence_scores ADD COLUMN dependency_preservation_pct REAL DEFAULT 100.0")
            if "interface_compatibility_pct" not in cols:
                conn.execute("ALTER TABLE confidence_scores ADD COLUMN interface_compatibility_pct REAL DEFAULT 100.0")

        # dependency_graph new fields
        if "dependency_graph" in tables:
            cols = _sqlite_columns(conn.cursor(), "dependency_graph")
            for col, typ in [
                ("source_file", "VARCHAR(500)"),
                ("target_file", "VARCHAR(500)"),
                ("source_symbol", "VARCHAR(200)"),
                ("target_symbol", "VARCHAR(200)"),
                ("confidence", "REAL DEFAULT 1.0"),
            ]:
                if col not in cols:
                    conn.execute(f"ALTER TABLE dependency_graph ADD COLUMN {col} {typ}")

        conn.commit()
        conn.close()
    except Exception:
        pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
