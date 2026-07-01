import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from backend.database import get_session
from backend.models import Room, User, Message, RoomUserLink
from backend.schemas import RoomResponse, RoomCreate, MessageResponse, UserResponse
from backend.dependencies import get_approved_user

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Upload directory configuration
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/rooms", response_model=List[RoomResponse])
def get_rooms(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_approved_user)
):
    # Retrieve all rooms where the user is a participant
    # (Or all public rooms where is_direct_message is False)
    stmt = (
        select(Room)
        .join(RoomUserLink, isouter=True)
        .where(
            (Room.is_direct_message == False) |  # Public rooms
            (RoomUserLink.user_id == current_user.id) # DM rooms containing user
        )
        .distinct()
    )
    rooms = db.exec(stmt).all()
    
    # We want to format the response to contain list of users
    result = []
    for room in rooms:
        # Load users for each room
        users_stmt = select(User).join(RoomUserLink).where(RoomUserLink.room_id == room.id)
        room_users = db.exec(users_stmt).all()
        
        # If it's a DM room, we customize the name of the room to be the other user's name for client display
        room_name = room.name
        if room.is_direct_message:
            other_users = [u.username for u in room_users if u.id != current_user.id]
            room_name = other_users[0] if other_users else "Direct Message"
            
        result.append({
            "id": room.id,
            "name": room_name,
            "is_direct_message": room.is_direct_message,
            "created_at": room.created_at,
            "users": room_users
        })
        
    return result

@router.post("/rooms", response_model=RoomResponse)
def create_room(
    payload: RoomCreate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_approved_user)
):
    if payload.is_direct_message:
        if not payload.participant_ids or len(payload.participant_ids) != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Direct messages require exactly one other participant"
            )
        
        other_user_id = payload.participant_ids[0]
        other_user = db.get(User, other_user_id)
        if not other_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Participant user not found"
            )

        # Check if a DM room already exists between current_user and other_user
        # Find rooms that are DMs
        dm_stmt = (
            select(Room)
            .where(Room.is_direct_message == True)
        )
        existing_dm_rooms = db.exec(dm_stmt).all()
        for r in existing_dm_rooms:
            # Get members
            members_stmt = select(RoomUserLink.user_id).where(RoomUserLink.room_id == r.id)
            members = set(db.exec(members_stmt).all())
            if members == {current_user.id, other_user_id}:
                # Return existing room
                users_stmt = select(User).join(RoomUserLink).where(RoomUserLink.room_id == r.id)
                room_users = db.exec(users_stmt).all()
                return {
                    "id": r.id,
                    "name": other_user.username,
                    "is_direct_message": True,
                    "created_at": r.created_at,
                    "users": room_users
                }

        # Create new DM room
        room = Room(name=f"DM_{current_user.id}_{other_user_id}", is_direct_message=True)
        db.add(room)
        db.commit()
        db.refresh(room)
        
        # Link both users
        db.add(RoomUserLink(room_id=room.id, user_id=current_user.id))
        db.add(RoomUserLink(room_id=room.id, user_id=other_user_id))
        db.commit()
        
        users_stmt = select(User).join(RoomUserLink).where(RoomUserLink.room_id == room.id)
        room_users = db.exec(users_stmt).all()
        
        return {
            "id": room.id,
            "name": other_user.username,
            "is_direct_message": True,
            "created_at": room.created_at,
            "users": room_users
        }
        
    else:
        # Creating a public chat room
        if not payload.name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Room name is required for public channels"
            )
            
        existing_room = db.exec(select(Room).where(Room.name == payload.name)).first()
        if existing_room:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A room with this name already exists"
            )
            
        room = Room(name=payload.name, is_direct_message=False)
        db.add(room)
        db.commit()
        db.refresh(room)
        
        # Link creator to room
        db.add(RoomUserLink(room_id=room.id, user_id=current_user.id))
        
        # Link other participants if specified
        if payload.participant_ids:
            for pid in payload.participant_ids:
                if pid != current_user.id:
                    db.add(RoomUserLink(room_id=room.id, user_id=pid))
                    
        db.commit()
        
        users_stmt = select(User).join(RoomUserLink).where(RoomUserLink.room_id == room.id)
        room_users = db.exec(users_stmt).all()
        
        return {
            "id": room.id,
            "name": room.name,
            "is_direct_message": False,
            "created_at": room.created_at,
            "users": room_users
        }

@router.get("/rooms/{room_id}/messages", response_model=List[MessageResponse])
def get_messages(
    room_id: int,
    limit: int = 50,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_approved_user)
):
    # Verify room exists
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
        
    # If DM, verify current user is a member
    if room.is_direct_message:
        is_member = db.exec(
            select(RoomUserLink).where(
                (RoomUserLink.room_id == room_id) & 
                (RoomUserLink.user_id == current_user.id)
            )
        ).first()
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this conversation"
            )
            
    # Fetch messages
    messages = db.exec(
        select(Message)
        .where(Message.room_id == room_id)
        .order_by(Message.created_at.asc())
        .limit(limit)
    ).all()
    
    # Populate sender names
    result = []
    for msg in messages:
        sender = db.get(User, msg.sender_id)
        sender_name = sender.username if sender else "Deleted User"
        result.append({
            "id": msg.id,
            "content": msg.content,
            "image_url": msg.image_url,
            "sender_id": msg.sender_id,
            "sender_name": sender_name,
            "room_id": msg.room_id,
            "created_at": msg.created_at
        })
        
    return result

@router.post("/rooms/{room_id}/upload")
def upload_file(
    room_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_approved_user)
):
    # Verify room exists
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
        
    # Save the file
    file_ext = os.path.splitext(file.filename)[1]
    safe_filename = f"chat_{room_id}_{datetime.utcnow().timestamp()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    file_url = f"/api/uploads/{safe_filename}"
    return {"file_url": file_url}

@router.get("/users", response_model=List[UserResponse])
def get_available_chat_users(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_approved_user)
):
    # Fetch all approved users that are not the current user, so we can start DMs with them!
    users = db.exec(
        select(User)
        .where((User.id != current_user.id) & (User.status == "APPROVED"))
    ).all()
    return users
