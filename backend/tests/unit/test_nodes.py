"""Unit tests for LangGraph nodes."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.agents.nodes import (
    extract_clauses_node,
    plan_retrieval_node,
    analyze_compliance_node,
    critique_analysis_node,
    human_review_node,
    should_continue_after_critique,
    should_continue_after_compliance,
)
from backend.agents.state import AuditState


@pytest.fixture
def sample_state():
    """Sample audit state for testing."""
    return {
        "document_text": "This is a sample lease agreement for a commercial property in Pinellas County, Florida.",
        "document_metadata": {},
        "extracted_findings": [],
        "retrieval_plan": None,
        "statute_references": [],
        "compliance_score": 0.0,
        "critique_feedback": None,
        "user_feedback": None,
        "user_action": None,
        "thread_id": "test-thread-123",
        "iteration_count": 0,
        "current_node": None,
    }


@pytest.mark.asyncio
async def test_extract_clauses_node(sample_state):
    """Test extract_clauses node."""
    with patch('backend.agents.nodes.main_llm') as mock_llm:
        mock_llm.with_structured_output.return_value.ainvoke = AsyncMock(return_value={
            "clauses": [
                {"clause_text": "Landlord must maintain premises", "clause_type": "obligation", "risk_level": "low"}
            ],
            "document_type": "lease",
            "jurisdiction": "FL",
            "location": "Pinellas County",
            "date": None,
        })
        
        result = await extract_clauses_node(sample_state)
        
        assert "extracted_findings" in result
        assert len(result["extracted_findings"]) > 0
        assert result["current_node"] == "extract_clauses"


@pytest.mark.asyncio
async def test_plan_retrieval_node(sample_state):
    """Test plan_retrieval node."""
    sample_state["document_metadata"] = {
        "document_type": "lease",
        "jurisdiction": "FL",
        "location": "Pinellas County",
    }
    
    with patch('backend.agents.nodes.main_llm') as mock_llm:
        mock_llm.with_structured_output.return_value.ainvoke = AsyncMock(return_value={
            "jurisdiction": "FL",
            "chapter": 83,
            "category": "commercial_lease",
        })
        
        result = await plan_retrieval_node(sample_state)
        
        assert "retrieval_plan" in result
        assert result["retrieval_plan"]["jurisdiction"] == "FL"
        assert result["current_node"] == "plan_retrieval"


def test_should_continue_after_critique():
    """Test critique conditional edge function."""
    # Test passed critique
    state_passed = {
        "critique_feedback": {"passed": True, "confidence_score": 0.9}
    }
    assert should_continue_after_critique(state_passed) == "check_compliance"
    
    # Test failed critique
    state_failed = {
        "critique_feedback": {"passed": False, "confidence_score": 0.5}
    }
    assert should_continue_after_critique(state_failed) == "self_correct"


def test_should_continue_after_compliance():
    """Test compliance conditional edge function."""
    # Test high score
    state_high = {
        "compliance_score": 0.85,
        "iteration_count": 1,
    }
    assert should_continue_after_compliance(state_high) == "human_review"
    
    # Test low score
    state_low = {
        "compliance_score": 0.5,
        "iteration_count": 1,
    }
    assert should_continue_after_compliance(state_low) == "self_correct"
    
    # Test max iterations
    state_max_iter = {
        "compliance_score": 0.5,
        "iteration_count": 3,
    }
    assert should_continue_after_compliance(state_max_iter) == "human_review"

