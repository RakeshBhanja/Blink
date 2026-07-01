from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from sqlmodel import Session
from backend.database import get_session
from backend.models import User
from backend.security import decode_access_token

# Use APIKeyHeader to fetch Bearer Token directly from headers (simplifies client-side API requests)
api_key_header = APIKeyHeader(name="Authorization", auto_error=False)

def get_current_user(token: Optional[str] = Depends(api_key_header), db: Session = Depends(get_session)) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    
    # Strip Bearer prefix if present
    if token.startswith("Bearer "):
        token = token[7:]
        
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token content",
        )
        
    user = db.get(User, int(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user

def get_approved_user(current_user: User = Depends(get_current_user)) -> User:
    # Admins are automatically allowed, otherwise status must be APPROVED
    if current_user.role != "ADMIN" and current_user.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your account is {current_user.status}. Please wait for admin approval.",
        )
    return current_user

def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
