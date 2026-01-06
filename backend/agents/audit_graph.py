"""LangGraph StateGraph definition for LegalTrace audit workflow."""

import os

from langgraph.graph import StateGraph, END

# Try to import PostgresSaver, fallback to None if not available
try:
    from langgraph.checkpoint.postgres import PostgresSaver
except ImportError:
    try:
        from langgraph.checkpoint.postgres.aio import PostgresSaverAsync as PostgresSaver
    except ImportError:
        PostgresSaver = None

from sqlalchemy import create_engine

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


def create_audit_graph():
    """
    Create and compile the LegalTrace audit StateGraph.
    
    Returns:
        Compiled LangGraph app with PostgresSaver persistence
    """
    # Initialize PostgresSaver for state persistence (optional)
    checkpointer = None
    if PostgresSaver is not None:
        try:
            checkpoint_db_url = os.getenv(
                "CHECKPOINT_DB_URL",
                os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/legaltrace_db"),
            )
            # Create sync engine for checkpointing
            sync_engine = create_engine(checkpoint_db_url)
            checkpointer = PostgresSaver(sync_engine)
        except Exception as e:
            print(f"Warning: Could not initialize PostgresSaver: {e}. Continuing without checkpointing.")
    
    # Create the graph
    workflow = StateGraph(AuditState)
    
    # Add nodes
    workflow.add_node("extract_clauses", extract_clauses_node)
    workflow.add_node("plan_retrieval", plan_retrieval_node)
    workflow.add_node("analyze_compliance", analyze_compliance_node)
    workflow.add_node("critique_analysis", critique_analysis_node)
    workflow.add_node("human_review", human_review_node)
    
    # Set entry point
    workflow.set_entry_point("extract_clauses")
    
    # Add edges
    workflow.add_edge("extract_clauses", "plan_retrieval")
    workflow.add_edge("plan_retrieval", "analyze_compliance")
    workflow.add_edge("analyze_compliance", "critique_analysis")
    
    # Helper node for compliance score check (pass-through)
    def check_compliance_score_node(state: AuditState) -> AuditState:
        """Pass-through node for compliance score check."""
        return state
    
    workflow.add_node("check_compliance_score", check_compliance_score_node)
    
    # Conditional edge from critique_analysis
    workflow.add_conditional_edges(
        "critique_analysis",
        should_continue_after_critique,
        {
            "self_correct": "analyze_compliance",
            "check_compliance": "check_compliance_score",
        },
    )
    
    # Conditional edge for compliance score check
    workflow.add_conditional_edges(
        "check_compliance_score",
        should_continue_after_compliance,
        {
            "self_correct": "analyze_compliance",
            "human_review": "human_review",
        },
    )
    
    # Human review goes to END (resumes via /approve endpoint)
    workflow.add_edge("human_review", END)
    
    # Compile with checkpointer and recursion limit
    app = workflow.compile(
        checkpointer=checkpointer,
        interrupt_before=["human_review"],  # Interrupt before human review for HITL
    )
    
    return app


# Create the graph instance
audit_graph = create_audit_graph()

