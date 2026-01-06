"""Unit tests for utility functions."""

import pytest
from unittest.mock import AsyncMock, patch
from backend.lib.embeddings import get_embedding, get_embeddings_batch


@pytest.mark.asyncio
async def test_get_embedding():
    """Test embedding generation."""
    with patch('backend.lib.embeddings.client') as mock_client:
        mock_client.embeddings.create = AsyncMock(return_value=MagicMock(
            data=[MagicMock(embedding=[0.1] * 1536)]
        ))
        
        embedding = await get_embedding("test text")
        
        assert len(embedding) == 1536
        assert all(isinstance(x, float) for x in embedding)


@pytest.mark.asyncio
async def test_get_embeddings_batch():
    """Test batch embedding generation."""
    with patch('backend.lib.embeddings.client') as mock_client:
        mock_client.embeddings.create = AsyncMock(return_value=MagicMock(
            data=[
                MagicMock(embedding=[0.1] * 1536),
                MagicMock(embedding=[0.2] * 1536),
            ]
        ))
        
        embeddings = await get_embeddings_batch(["text1", "text2"])
        
        assert len(embeddings) == 2
        assert all(len(emb) == 1536 for emb in embeddings)

