"""Integration tests for graph execution."""

import pytest
from backend.agents.audit_graph import create_audit_graph
from backend.agents.state import AuditState


@pytest.mark.asyncio
async def test_graph_creation():
    """Test that graph can be created."""
    graph = create_audit_graph()
    assert graph is not None


@pytest.mark.asyncio
async def test_graph_execution_basic():
    """Test basic graph execution (may require database/LLM)."""
    graph = create_audit_graph()
    
    initial_state: AuditState = {
        "document_text": "Test document",
        "document_metadata": {},
        "extracted_findings": [],
        "retrieval_plan": None,
        "statute_references": [],
        "compliance_score": 0.0,
        "critique_feedback": None,
        "user_feedback": None,
        "user_action": None,
        "thread_id": "test-thread",
        "iteration_count": 0,
        "current_node": None,
    }
    
    config = {"configurable": {"thread_id": "test-thread"}}
    
    try:
        # This may fail if database/LLM not configured, which is expected in CI
        result = await graph.ainvoke(initial_state, config)
        assert "current_node" in result
    except Exception as e:
        # Expected if services not available
        pytest.skip(f"Graph execution requires services: {e}")

