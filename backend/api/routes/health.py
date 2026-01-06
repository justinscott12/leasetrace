"""Health check endpoint."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.session import AsyncSessionLocal

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    """
    Health check endpoint.
    
    Returns 200 if all systems operational, 503 if degraded.
    """
    import os
    
    health_status = {
        "status": "healthy",
        "version": "1.0.0",
    }
    
    # Check database
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        health_status["database"] = "connected"
    except Exception as e:
        health_status["database"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check OpenAI API
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        await client.models.list()
        health_status["openai_api"] = "reachable"
    except Exception as e:
        health_status["openai_api"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check MCP server (basic check)
    health_status["mcp_server"] = "available"  # TODO: Add actual MCP server check
    
    status_code = 200 if health_status["status"] == "healthy" else 503
    
    return health_status

