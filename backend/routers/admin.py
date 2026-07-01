from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from backend.database import get_session
from backend.models import User
from backend.schemas import UserResponse, UserStatusUpdate
from backend.dependencies import get_admin_user
from backend.websocket_manager import manager

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/users", response_model=List[UserResponse])
def get_users(
    db: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    # Fetch all users (excluding the current admin to prevent self-modification)
    users = db.exec(select(User).where(User.id != admin.id)).all()
    return users

@router.post("/users/status", response_model=UserResponse)
async def update_user_status(
    payload: UserStatusUpdate,
    db: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot modify your own administrative status"
        )

    # Apply changes
    user.status = payload.status
    if payload.role:
        user.role = payload.role
        
    db.add(user)
    db.commit()
    db.refresh(user)

    # If the user is rejected, notify and disconnect them instantly from websocket
    if payload.status in ["REJECTED", "PENDING"]:
        message = {
            "type": "account_status_change",
            "status": payload.status,
            "message": f"Your account status was updated to {payload.status}. Disconnecting..."
        }
        await manager.send_personal_message(message, user.id)
        # Disconnect all active socket connections for this user
        if user.id in manager.active_connections:
            sockets_to_close = list(manager.active_connections[user.id])
            for ws in sockets_to_close:
                try:
                    await ws.close(code=1008, reason="Status changed to non-approved")
                except Exception:
                    pass
                manager.disconnect(user.id, ws)
    else:
        # Notify user they were approved
        message = {
            "type": "account_status_change",
            "status": payload.status,
            "message": "Your account has been approved by an administrator!"
        }
        await manager.send_personal_message(message, user.id)

    return user

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_session),
    admin: User = Depends(get_admin_user)
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete yourself"
        )
        
    db.delete(user)
    db.commit()
    return None
