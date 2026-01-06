"""Vector search utilities with RRF for LegalTrace."""

from typing import List, Optional, Tuple

from sqlalchemy import func, select, text, cast
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import AsyncSession
from pgvector.sqlalchemy import Vector

from backend.db.models import Statute
from backend.lib.embeddings import get_embedding
from backend.lib.rrf import merge_semantic_and_keyword_results


async def semantic_search(
    session: AsyncSession,
    query_embedding: List[float],
    limit: int = 10,
    retrieval_plan: Optional[dict] = None,
) -> List[Tuple[int, float]]:
    """
    Perform semantic search using pgvector cosine similarity.
    
    Args:
        session: Database session
        query_embedding: Query embedding vector
        limit: Maximum number of results
        retrieval_plan: Optional state-aware retrieval plan for filtering
        
    Returns:
        List of (statute_id, cosine_similarity) tuples, sorted by similarity
    """
    # Build query with optional filters from retrieval_plan
    # Use raw SQL with proper vector array format for pgvector
    # Convert embedding list to PostgreSQL array string format
    embedding_array = "[" + ",".join(map(str, query_embedding)) + "]"
    
    # Build WHERE clause with filters
    where_parts = ["statutes.vector IS NOT NULL"]
    params_dict = {"embedding": embedding_array}
    param_idx = 1
    
    if retrieval_plan:
        if "jurisdiction" in retrieval_plan:
            param_key = f"jurisdiction_{param_idx}"
            where_parts.append(f"statutes.jurisdiction = :{param_key}")
            params_dict[param_key] = retrieval_plan["jurisdiction"]
            param_idx += 1
        if "chapter" in retrieval_plan:
            param_key = f"chapter_{param_idx}"
            where_parts.append(f"statutes.chapter = :{param_key}")
            params_dict[param_key] = retrieval_plan["chapter"]
            param_idx += 1
        if "category" in retrieval_plan:
            param_key = f"category_{param_idx}"
            where_parts.append(f"statutes.category = :{param_key}")
            params_dict[param_key] = retrieval_plan["category"]
            param_idx += 1
    
    params_dict["limit_val"] = limit
    
    # Use raw SQL with proper vector casting using named parameters
    where_clause = " AND ".join(where_parts)
    sql = text(f"""
        SELECT 
            similarity_subquery.id,
            similarity_subquery.similarity
        FROM (
            SELECT 
                statutes.id AS id,
                1 - cosine_distance(statutes.vector, CAST(:embedding AS vector)) AS similarity
            FROM statutes
            WHERE {where_clause}
        ) AS similarity_subquery
        ORDER BY similarity_subquery.similarity DESC
        LIMIT :limit_val
    """)
    
    result = await session.execute(sql, params_dict)
    return [(row.id, float(row.similarity)) for row in result]


async def keyword_search(
    session: AsyncSession,
    query_text: str,
    limit: int = 10,
    retrieval_plan: Optional[dict] = None,
) -> List[Tuple[int, float]]:
    """
    Perform keyword search using PostgreSQL full-text search (tsvector).
    
    Args:
        session: Database session
        query_text: Query text for full-text search
        limit: Maximum number of results
        retrieval_plan: Optional state-aware retrieval plan for filtering
        
    Returns:
        List of (statute_id, relevance_score) tuples, sorted by relevance
    """
    # Build full-text search query using raw SQL to avoid double plainto_tsquery calls
    # Build WHERE clause with filters using named parameters
    where_parts = ["statutes.tsvector @@ plainto_tsquery('english', :query_text)"]
    params_dict = {"query_text": query_text}
    param_idx = 1
    
    if retrieval_plan:
        if "jurisdiction" in retrieval_plan:
            param_key = f"jurisdiction_{param_idx}"
            where_parts.append(f"statutes.jurisdiction = :{param_key}")
            params_dict[param_key] = retrieval_plan["jurisdiction"]
            param_idx += 1
        if "chapter" in retrieval_plan:
            param_key = f"chapter_{param_idx}"
            where_parts.append(f"statutes.chapter = :{param_key}")
            params_dict[param_key] = retrieval_plan["chapter"]
            param_idx += 1
        elif retrieval_plan.get("chapter") is None:
            # Explicitly check for NULL chapter
            where_parts.append("statutes.chapter IS NULL")
        if "category" in retrieval_plan:
            param_key = f"category_{param_idx}"
            where_parts.append(f"statutes.category = :{param_key}")
            params_dict[param_key] = retrieval_plan["category"]
            param_idx += 1
    
    params_dict["limit_val"] = limit
    
    # Use raw SQL with proper tsquery handling using named parameters
    where_clause = " AND ".join(where_parts)
    sql = text(f"""
        SELECT 
            rank_subquery.id,
            rank_subquery.rank
        FROM (
            SELECT 
                statutes.id AS id,
                ts_rank(statutes.tsvector, plainto_tsquery('english', :query_text)) AS rank
            FROM statutes
            WHERE {where_clause}
        ) AS rank_subquery
        ORDER BY rank_subquery.rank DESC
        LIMIT :limit_val
    """)
    
    result = await session.execute(sql, params_dict)
    return [(row.id, float(row.rank)) for row in result]


async def hybrid_search(
    session: AsyncSession,
    query_text: str,
    query_embedding: List[float],
    limit: int = 5,
    retrieval_plan: Optional[dict] = None,
    k: int = 60,
) -> List[Tuple[int, float, str]]:
    """
    Perform hybrid search combining semantic and keyword search using RRF.
    
    Args:
        session: Database session
        query_text: Query text for keyword search
        query_embedding: Query embedding for semantic search
        limit: Maximum number of results
        retrieval_plan: Optional state-aware retrieval plan
        k: RRF constant (default: 60)
        
    Returns:
        List of (statute_id, rrf_score, search_method) tuples, sorted by RRF score
        search_method indicates if result came from semantic, keyword, or both
    """
    # Perform both searches
    semantic_results = await semantic_search(session, query_embedding, limit * 2, retrieval_plan)
    keyword_results = await keyword_search(session, query_text, limit * 2, retrieval_plan)
    
    # Merge using RRF
    merged_results = merge_semantic_and_keyword_results(semantic_results, keyword_results, k=k)
    
    # Determine search method attribution
    semantic_ids = {statute_id for statute_id, _ in semantic_results}
    keyword_ids = {statute_id for statute_id, _ in keyword_results}
    
    results_with_method = []
    for statute_id, rrf_score in merged_results[:limit]:
        if statute_id in semantic_ids and statute_id in keyword_ids:
            method = "both"
        elif statute_id in semantic_ids:
            method = "semantic"
        else:
            method = "keyword"
        results_with_method.append((statute_id, rrf_score, method))
    
    return results_with_method

