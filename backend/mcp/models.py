"""Pydantic models for MCP tool inputs/outputs."""

from typing import List, Optional

from pydantic import BaseModel, Field


class QueryFloridaStatutesInput(BaseModel):
    """Input model for query_florida_statutes tool."""
    
    query: str = Field(..., description="Search query for Florida statutes")
    limit: int = Field(default=5, ge=1, le=20, description="Maximum number of results")
    retrieval_plan: Optional[dict] = Field(
        default=None,
        description="State-aware retrieval plan with jurisdiction, chapter, category filters",
    )


class StatuteResult(BaseModel):
    """Model for a single statute search result."""
    
    id: int
    citation: str
    title: str
    text: str
    rrf_score: float
    search_method: str = Field(..., description="semantic, keyword, or both")


class QueryFloridaStatutesOutput(BaseModel):
    """Output model for query_florida_statutes tool."""
    
    statutes: List[StatuteResult]
    query: str
    total_results: int

