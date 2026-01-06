"""Reciprocal Rank Fusion (RRF) algorithm implementation."""

from typing import Dict, List, Tuple


def reciprocal_rank_fusion(
    ranked_lists: List[List[Tuple[str, float]]],
    k: int = 60,
) -> List[Tuple[str, float]]:
    """
    Merge multiple ranked lists using Reciprocal Rank Fusion.
    
    Formula: RRF(d) = Σ(1 / (k + rank_i(d)))
    where k is a constant (typically 60) and rank_i(d) is the rank of document d in list i.
    
    Args:
        ranked_lists: List of ranked lists, where each list contains tuples of (document_id, score)
        k: RRF constant (default: 60)
        
    Returns:
        Merged ranked list sorted by RRF score (descending)
    """
    # Dictionary to store RRF scores for each document
    rrf_scores: Dict[str, float] = {}
    
    # Process each ranked list
    for rank_list in ranked_lists:
        for rank, (doc_id, _) in enumerate(rank_list, start=1):
            # Calculate RRF contribution: 1 / (k + rank)
            rrf_contribution = 1.0 / (k + rank)
            
            # Accumulate RRF score
            if doc_id not in rrf_scores:
                rrf_scores[doc_id] = 0.0
            rrf_scores[doc_id] += rrf_contribution
    
    # Sort by RRF score (descending) and return as list of tuples
    sorted_results = sorted(
        rrf_scores.items(),
        key=lambda x: x[1],
        reverse=True,
    )
    
    return sorted_results


def merge_semantic_and_keyword_results(
    semantic_results: List[Tuple[int, float]],  # (statute_id, cosine_similarity)
    keyword_results: List[Tuple[int, float]],   # (statute_id, relevance_score)
    k: int = 60,
) -> List[Tuple[int, float]]:
    """
    Merge semantic and keyword search results using RRF.
    
    Args:
        semantic_results: Ranked list from semantic search (pgvector)
        keyword_results: Ranked list from keyword search (tsvector)
        k: RRF constant (default: 60)
        
    Returns:
        Merged ranked list sorted by RRF score (descending)
    """
    # Convert to format expected by RRF: (doc_id, score) tuples
    semantic_list = [(str(statute_id), score) for statute_id, score in semantic_results]
    keyword_list = [(str(statute_id), score) for statute_id, score in keyword_results]
    
    # Apply RRF
    merged = reciprocal_rank_fusion([semantic_list, keyword_list], k=k)
    
    # Convert back to (int, float) format
    return [(int(doc_id), rrf_score) for doc_id, rrf_score in merged]

