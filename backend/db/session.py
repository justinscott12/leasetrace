"""Database session management for LegalTrace."""

from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.db.models import Base


def get_database_url(sync: bool = False) -> str:
    """Get database URL from environment variables."""
    import os

    db_url = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/legaltrace_db")
    if sync:
        return db_url
    # Convert to async URL
    return db_url.replace("postgresql://", "postgresql+asyncpg://")


# Sync engine for migrations and initial setup
sync_engine = create_engine(
    get_database_url(sync=True),
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=20,
)

# Async engine for application use
async_engine = create_async_engine(
    get_database_url(sync=False),
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=20,
    echo=False,
)

# Session factories
SyncSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


def get_sync_session() -> Generator[Session, None, None]:
    """Get synchronous database session."""
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_session() -> Generator[AsyncSession, None, None]:
    """Get asynchronous database session."""
    async with AsyncSessionLocal() as session:
        yield session


def init_db() -> None:
    """Initialize database tables."""
    # Enable pgvector extension
    with sync_engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    
    Base.metadata.create_all(bind=sync_engine)


def drop_db() -> None:
    """Drop all database tables."""
    Base.metadata.drop_all(bind=sync_engine)

