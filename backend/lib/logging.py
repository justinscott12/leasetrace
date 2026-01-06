"""Structured logging configuration for LegalTrace."""

import logging
import sys
from typing import Any

import structlog


def configure_logging() -> None:
    """Configure structured logging with structlog."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=False,
    )


def get_logger(name: str) -> Any:
    """Get a structured logger instance."""
    return structlog.get_logger(name)


# Custom exception hierarchy
class AuditError(Exception):
    """Base exception for audit-related errors."""
    pass


class RetrievalError(AuditError):
    """Exception raised when retrieval/search fails."""
    pass


class ValidationError(AuditError):
    """Exception raised when validation fails."""
    pass


class GraphExecutionError(AuditError):
    """Exception raised when graph execution fails."""
    pass

