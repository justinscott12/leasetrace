"""FastMCP server for Florida statute queries."""

import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from typing import Optional

from mcp.server.fastmcp import FastMCP
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from backend.db.models import Statute
from backend.db.session import get_database_url
from backend.lib.embeddings import get_embedding
from backend.lib.vector_search import hybrid_search
from backend.mcp.models import QueryFloridaStatutesInput, QueryFloridaStatutesOutput, StatuteResult

# Initialize FastMCP server
mcp = FastMCP("LegalTrace Law Server")

# Database setup for MCP server
async_engine = create_async_engine(
    get_database_url(sync=False),
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=20,
)
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@mcp.tool()
async def query_florida_statutes(
    query: str,
    limit: int = 5,
    retrieval_plan: Optional[dict] = None,
) -> dict:
    """
    Query Florida statutes using hybrid search (semantic + keyword) with RRF.
    
    Args:
        query: Search query for Florida statutes
        limit: Maximum number of results (1-20)
        retrieval_plan: Optional state-aware retrieval plan with filters
        
    Returns:
        Dictionary with matching statutes, RRF scores, and search method attribution
    """
    try:
        # Validate input
        input_data = QueryFloridaStatutesInput(
            query=query,
            limit=limit,
            retrieval_plan=retrieval_plan,
        )
    except Exception as e:
        return {"error": f"Validation error: {str(e)}"}
    
    try:
        # Get query embedding
        query_embedding = await get_embedding(input_data.query)
        
        # Perform hybrid search
        async with AsyncSessionLocal() as session:
            search_results = await hybrid_search(
                session=session,
                query_text=input_data.query,
                query_embedding=query_embedding,
                limit=input_data.limit,
                retrieval_plan=input_data.retrieval_plan,
            )
            
            # Fetch full statute details
            statute_ids = [statute_id for statute_id, _, _ in search_results]
            if not statute_ids:
                return {
                    "statutes": [],
                    "query": input_data.query,
                    "total_results": 0,
                }
            
            stmt = select(Statute).where(Statute.id.in_(statute_ids))
            result = await session.execute(stmt)
            statutes = result.scalars().all()
            
            # Create statute map for quick lookup
            statute_map = {stat.id: stat for stat in statutes}
            
            # Build results with RRF scores and search method
            statute_results = []
            for statute_id, rrf_score, search_method in search_results:
                if statute_id in statute_map:
                    stat = statute_map[statute_id]
                    statute_results.append(
                        StatuteResult(
                            id=stat.id,
                            citation=stat.citation,
                            title=stat.title,
                            text=stat.text,
                            rrf_score=rrf_score,
                            search_method=search_method,
                        )
                    )
            
            output = QueryFloridaStatutesOutput(
                statutes=statute_results,
                query=input_data.query,
                total_results=len(statute_results),
            )
            
            return output.model_dump()
            
    except Exception as e:
        return {"error": f"Search error: {str(e)}"}


def run_server() -> None:
    """Run the MCP server on stdio."""
    mcp.run(transport="stdio")


if __name__ == "__main__":
    run_server()

