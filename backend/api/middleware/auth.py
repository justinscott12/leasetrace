"""Authentication middleware (placeholder for JWT implementation)."""

from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()


async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    Verify JWT token (placeholder implementation).
    
    TODO: Implement actual JWT verification
    """
    # Placeholder: accept any token for now
    # In production, verify JWT signature and extract user info
    token = credentials.credentials
    return {"user_id": "anonymous", "token": token}

