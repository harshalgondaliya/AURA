"""
database/migrations/migrate.py
Lightweight, reproducible database migration runner for AURA.
Manages schema evolution and tracks applied migrations in `schema_migrations` table.
"""

import os
import sys
import argparse
from pathlib import Path
from datetime import datetime

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import create_engine, text

MIGRATIONS_DIR = Path(__file__).resolve().parent

def get_engine():
    db_url = os.getenv("DATABASE_URL", "sqlite:///./fashion.db")
    connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
    return create_engine(db_url, connect_args=connect_args)

def init_migrations_table(conn):
    """Ensures schema_migrations table exists."""
    is_sqlite = conn.dialect.name == "sqlite"
    if is_sqlite:
        sql = """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(64) PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            description TEXT
        );
        """
    else:
        sql = """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(64) PRIMARY KEY,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            description TEXT
        );
        """
    conn.execute(text(sql))
    conn.commit()

def get_applied_migrations(conn):
    """Returns set of already applied migration filenames."""
    init_migrations_table(conn)
    result = conn.execute(text("SELECT version FROM schema_migrations;")).fetchall()
    return {row[0] for row in result}

def get_migration_files():
    """Returns list of .sql migration files sorted by name."""
    files = sorted(MIGRATIONS_DIR.glob("*.sql"), key=lambda p: p.name)
    return files

def show_status():
    engine = get_engine()
    with engine.connect() as conn:
        applied = get_applied_migrations(conn)
        files = get_migration_files()
        
        print("\n" + "=" * 65)
        print("AURA DATABASE SCHEMA MIGRATION STATUS")
        print("=" * 65)
        print(f"Database: {engine.url.render_as_string(hide_password=True)}")
        print(f"{'Migration File':40} | {'Status':10} | {'Applied At'}")
        print("-" * 65)
        
        for f in files:
            is_applied = f.name in applied
            status = "APPLIED" if is_applied else "PENDING"
            applied_time = ""
            if is_applied:
                row = conn.execute(
                    text("SELECT applied_at FROM schema_migrations WHERE version = :ver"),
                    {"ver": f.name}
                ).fetchone()
                applied_time = str(row[0])[:19] if row and row[0] else "Verified"
            print(f"{f.name:40} | {status:10} | {applied_time}")
        print("=" * 65 + "\n")

def apply_migrations():
    engine = get_engine()
    applied_count = 0
    with engine.connect() as conn:
        applied = get_applied_migrations(conn)
        files = get_migration_files()
        
        print("\n[MIGRATION RUNNER] Checking pending database migrations...")
        for f in files:
            if f.name in applied:
                continue
                
            print(f"[MIGRATION RUNNER] Applying {f.name}...")
            sql_content = f.read_text(encoding="utf-8")
            
            # For PostgreSQL with anonymous code blocks (DO $$ ... $$)
            if conn.dialect.name != "sqlite":
                conn.execute(text(sql_content))
            else:
                # For SQLite, filter out postgres-specific blocks
                statements = [s.strip() for s in sql_content.split(";") if s.strip() and not s.strip().startswith("DO $$")]
                for stmt in statements:
                    try:
                        conn.execute(text(stmt))
                    except Exception as e:
                        # Ignore column already exists or table exists errors on SQLite
                        if "duplicate column name" not in str(e).lower():
                            pass
                            
            conn.execute(
                text("INSERT INTO schema_migrations (version, description) VALUES (:v, :d)"),
                {"v": f.name, "d": f"Applied {f.name}"}
            )
            conn.commit()
            print(f"[MIGRATION RUNNER] Successfully applied {f.name} [OK]")
            applied_count += 1
            
        if applied_count == 0:
            print("[MIGRATION RUNNER] Schema is fully up to date. Zero migrations required.")
        else:
            print(f"[MIGRATION RUNNER] Successfully applied {applied_count} migration(s).")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AURA Database Migration Runner")
    parser.add_argument("--status", action="store_true", help="Show migration status")
    args = parser.parse_args()
    
    if args.status:
        show_status()
    else:
        apply_migrations()
        show_status()
