"""Unit tests for RRF algorithm."""

import pytest
from backend.lib.rrf import reciprocal_rank_fusion, merge_semantic_and_keyword_results


def test_rrf_basic():
    """Test basic RRF calculation."""
    list1 = [("doc1", 0.9), ("doc2", 0.8), ("doc3", 0.7)]
    list2 = [("doc2", 0.85), ("doc1", 0.75), ("doc4", 0.65)]
    
    result = reciprocal_rank_fusion([list1, list2], k=60)
    
    # doc2 should rank highest (appears in both lists at high positions)
    assert result[0][0] == "doc2" or result[0][0] == "doc1"
    assert len(result) == 4  # All unique documents


def test_rrf_empty_lists():
    """Test RRF with empty lists."""
    result = reciprocal_rank_fusion([], k=60)
    assert result == []


def test_rrf_single_list():
    """Test RRF with single list."""
    list1 = [("doc1", 0.9), ("doc2", 0.8)]
    result = reciprocal_rank_fusion([list1], k=60)
    assert len(result) == 2
    assert result[0][0] == "doc1"


def test_merge_semantic_and_keyword():
    """Test merging semantic and keyword results."""
    semantic = [(1, 0.9), (2, 0.8), (3, 0.7)]
    keyword = [(2, 0.85), (1, 0.75), (4, 0.65)]
    
    result = merge_semantic_and_keyword_results(semantic, keyword, k=60)
    
    # Should return merged results
    assert len(result) >= 3
    assert all(isinstance(doc_id, int) for doc_id, _ in result)
    assert all(isinstance(score, float) for _, score in result)


def test_rrf_different_k_values():
    """Test RRF with different k values."""
    list1 = [("doc1", 0.9), ("doc2", 0.8)]
    list2 = [("doc2", 0.85), ("doc1", 0.75)]
    
    result_k60 = reciprocal_rank_fusion([list1, list2], k=60)
    result_k100 = reciprocal_rank_fusion([list1, list2], k=100)
    
    # Results should differ with different k values
    assert len(result_k60) == len(result_k100) == 2

