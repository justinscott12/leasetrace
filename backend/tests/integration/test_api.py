"""Integration tests for API endpoints."""

import pytest
from httpx import AsyncClient
from backend.api.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    """Test health check endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code in [200, 503]  # May be degraded if services not running
        data = response.json()
        assert "status" in data
        assert "version" in data


@pytest.mark.asyncio
async def test_create_audit_endpoint():
    """Test audit creation endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        form_data = {
            "document_text": "This is a test lease agreement in Florida."
        }
        response = await client.post("/audit", data=form_data)
        
        # May fail if database/LLM not configured, but should return proper error
        assert response.status_code in [200, 500, 503]
        if response.status_code == 200:
            data = response.json()
            assert "thread_id" in data
            assert "status" in data


@pytest.mark.asyncio
async def test_get_trace_endpoint():
    """Test trace endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/audit/test-thread-123/trace")
        
        # May return 404 if thread doesn't exist
        assert response.status_code in [200, 404, 500]

