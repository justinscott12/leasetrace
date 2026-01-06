"""SQLAlchemy models for LegalTrace database."""

from datetime import datetime
from typing import Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    Text,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func as sql_func

Base = declarative_base()


class Statute(Base):
    """Florida Statute model with vector and full-text search support."""

    __tablename__ = "statutes"

    id = Column(Integer, primary_key=True, index=True)
    citation = Column(String(255), nullable=False, unique=True, index=True)
    title = Column(String(500), nullable=False)
    text = Column(Text, nullable=False)
    vector = Column(Vector(1536), nullable=True)  # OpenAI embedding dimension
    tsvector = Column(TSVECTOR, nullable=True)  # Full-text search column
    chapter = Column(Integer, nullable=True, index=True)
    jurisdiction = Column(String(10), nullable=False, default="FL", index=True)
    category = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=sql_func.now())

    # Indexes
    __table_args__ = (
        Index("idx_statutes_tsvector", "tsvector", postgresql_using="gin"),
        Index("idx_statutes_vector", "vector", postgresql_using="hnsw", postgresql_ops={"vector": "vector_cosine_ops"}),
        Index("idx_statutes_chapter_category", "chapter", "category"),
    )

    def __repr__(self) -> str:
        return f"<Statute(id={self.id}, citation='{self.citation}', title='{self.title[:50]}...')>"

