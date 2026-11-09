"""
backend/common/database.py
SQLAlchemy Database Engine and Session Factory.
"""

import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.common.models import Base

# Read database URL from environment variable, fallback to local SQLite for rapid testing
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fashion.db")

# SQLite specific argument for multithreading
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """FastAPI dependency yielding database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Creates all database tables defined in models."""
    Base.metadata.create_all(bind=engine)
    db_loc = DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL
    print(f"Database initialized: {db_loc}")
