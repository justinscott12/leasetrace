"""LangGraph state schema for LegalTrace audit workflow."""

from typing import TypedDict, Optional, List, Dict, Any


class AuditState(TypedDict):
    """State schema for the LegalTrace audit graph."""
    
    # Document input
    document_text: str
    document_metadata: Dict[str, Any]  # Extracted metadata (type, location, date, etc.)
    
    # Extraction results
    extracted_findings: List[Dict[str, Any]]  # Pydantic-parsed clauses/findings
    
    # Retrieval planning
    retrieval_plan: Optional[Dict[str, Any]]  # State-aware retrieval strategy
    
    # RAG results
    statute_references: List[Dict[str, Any]]  # Matched statutes from RRF-based search
    
    # Compliance analysis
    compliance_score: float  # Score from 0.0 to 1.0
    compliance_analysis: Optional[str]  # Detailed analysis text
    recommendations: Optional[List[str]]  # Actionable recommendations to improve compliance
    missing_clauses: Optional[List[str]]  # Suggested clauses to add
    
    # Multi-agent critique
    critique_feedback: Optional[Dict[str, Any]]  # Critique results (hallucination checks, confidence scores)
    
    # Human review
    user_feedback: Optional[str]  # Human review feedback
    user_action: Optional[str]  # "approve", "edit", or "retry"
    
    # Execution tracking
    thread_id: str  # LangGraph thread identifier
    iteration_count: int  # Track self-correction iterations
    current_node: Optional[str]  # Current node name for tracing

