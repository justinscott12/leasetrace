"""FastAPI routes for audit endpoints."""

import os
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from sqlalchemy import create_engine
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.agents.audit_graph import create_audit_graph
from backend.agents.state import AuditState
from backend.lib.logging import get_logger

logger = get_logger("api.routes.audit")

router = APIRouter(prefix="/audit", tags=["audit"])

# Initialize graph (checkpointer is handled inside create_audit_graph)
audit_graph = create_audit_graph()

# Rate limiter instance (will be set by main app)
limiter = None


@router.post("")
async def create_audit(
    request: Request,
    document_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
) -> dict:
    """
    Create a new audit and trigger LangGraph execution.
    
    Accepts either document_text or file upload.
    """
    import os
    
    # Get document text
    if file:
        # Read file content
        content = await file.read()
        if file.content_type == "application/pdf":
            # TODO: Add PDF parsing
            raise HTTPException(status_code=400, detail="PDF parsing not yet implemented")
        else:
            document_text = content.decode("utf-8")
    elif not document_text:
        raise HTTPException(status_code=400, detail="Either document_text or file must be provided")
    
    # Create thread ID
    thread_id = str(uuid.uuid4())
    config = {
        "configurable": {"thread_id": thread_id},
    }
    # Set recursion limit separately - LangGraph expects it at the top level
    config["recursion_limit"] = 50  # Allow up to 50 steps (should be more than enough)
    
    # Initial state
    initial_state: AuditState = {
        "document_text": document_text,
        "document_metadata": {},
        "extracted_findings": [],
        "retrieval_plan": None,
        "statute_references": [],
        "compliance_score": 0.0,
        "critique_feedback": None,
        "user_feedback": None,
        "user_action": None,
        "thread_id": thread_id,
        "iteration_count": 0,
        "current_node": None,
    }
    
    # Invoke graph (will run until interrupt or completion)
    try:
        logger.info("audit_started", thread_id=thread_id, correlation_id=getattr(request.state, "correlation_id", None))
        result = await audit_graph.ainvoke(initial_state, config)
        logger.info("audit_completed", thread_id=thread_id, status=result.get("current_node"))
        return {
            "thread_id": thread_id,
            "status": "completed" if result.get("current_node") != "human_review" else "awaiting_review",
            "state": result,
        }
    except Exception as e:
        logger.error("audit_failed", thread_id=thread_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Audit execution failed: {str(e)}")


@router.post("/{thread_id}/approve")
async def approve_audit(
    thread_id: str,
    request: Request,
) -> dict:
    """
    Resume graph from human_review interrupt with user action.
    
    Actions:
    - approve: Proceed with agent's findings
    - edit: Fix agent reasoning with user input
    - retry: Loop back with corrected context
    """
    import json
    
    body = await request.json()
    action = body.get("action", "approve")
    user_feedback = body.get("user_feedback")
    
    if action not in ["approve", "edit", "retry"]:
        raise HTTPException(status_code=400, detail="action must be 'approve', 'edit', or 'retry'")
    
    config = {"configurable": {"thread_id": thread_id}}
    
    # Get current state
    try:
        current_state = await audit_graph.aget_state(config)
        if not current_state or not current_state.values:
            raise HTTPException(status_code=404, detail="Thread not found")
        
        state = current_state.values
        
        # Update state with user feedback
        state["user_action"] = action
        state["user_feedback"] = user_feedback
        
        # Resume graph
        if action == "retry":
            # Reset to analyze_compliance for retry
            state["iteration_count"] = 0
            # Update retrieval plan if feedback provided
            if user_feedback:
                # TODO: Parse user feedback to update retrieval plan
                pass
        
        result = await audit_graph.ainvoke(state, config)
        
        return {
            "thread_id": thread_id,
            "status": "completed",
            "state": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume audit: {str(e)}")


@router.get("/{thread_id}/trace")
async def get_audit_trace(thread_id: str) -> dict:
    """
    Get live execution trace for frontend dashboard.
    
    Returns current state and execution history.
    """
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        # Try to get state from checkpointer
        try:
            state = await audit_graph.aget_state(config)
            if state and state.values:
                return {
                    "thread_id": thread_id,
                    "current_state": state.values,
                    "next": state.next if hasattr(state, "next") else [],
                }
        except Exception as e:
            # If checkpointer fails, return empty state (graph might be running without checkpointing)
            logger.warning("trace_checkpointer_failed", thread_id=thread_id, error=str(e))
        
        # Fallback: return empty state if checkpointer not available
        return {
            "thread_id": thread_id,
            "current_state": {},
            "next": [],
        }
    except Exception as e:
        logger.error("trace_error", thread_id=thread_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get trace: {str(e)}")


@router.post("/{thread_id}/retry")
async def retry_audit(
    thread_id: str,
    request: Request,
) -> dict:
    """
    Retry audit analysis with improved context.
    
    Allows users to request a re-analysis after audit completion.
    """
    import json
    
    body = await request.json()
    action = body.get("action", "retry")
    user_feedback = body.get("user_feedback", "Please re-analyze with improved context")
    
    config = {"configurable": {"thread_id": thread_id}}
    config["recursion_limit"] = 50
    
    try:
        # Get current state
        current_state = await audit_graph.aget_state(config)
        if not current_state or not current_state.values:
            raise HTTPException(status_code=404, detail="Thread not found")
        
        state = current_state.values
        
        # Reset iteration count and update with feedback
        state["iteration_count"] = 0
        state["user_action"] = action
        state["user_feedback"] = user_feedback
        state["current_node"] = None  # Reset to start from analyze_compliance
        
        # Re-invoke from analyze_compliance
        logger.info("audit_retry_started", thread_id=thread_id, feedback=user_feedback[:100])
        result = await audit_graph.ainvoke(state, config)
        logger.info("audit_retry_completed", thread_id=thread_id, status=result.get("current_node"))
        
        return {
            "thread_id": thread_id,
            "status": "completed" if result.get("current_node") != "human_review" else "awaiting_review",
            "state": result,
        }
    except Exception as e:
        logger.error("audit_retry_failed", thread_id=thread_id, error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retry audit: {str(e)}")


@router.get("/{thread_id}/statute/{statute_id}")
async def get_statute(thread_id: str, statute_id: int) -> dict:
    """
    Get full statute text by ID for Audit Trail "View Source" feature.
    """
    from sqlalchemy.ext.asyncio import AsyncSession
    from backend.db.models import Statute
    from backend.db.session import AsyncSessionLocal
    from sqlalchemy import select
    
    async with AsyncSessionLocal() as session:
        stmt = select(Statute).where(Statute.id == statute_id)
        result = await session.execute(stmt)
        statute = result.scalar_one_or_none()
        
        if not statute:
            raise HTTPException(status_code=404, detail="Statute not found")
        
        return {
            "id": statute.id,
            "citation": statute.citation,
            "title": statute.title,
            "text": statute.text,
            "chapter": statute.chapter,
            "jurisdiction": statute.jurisdiction,
            "category": statute.category,
        }

