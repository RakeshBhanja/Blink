import json
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlmodel import Session, select
from backend.database import engine
from backend.models import User, Message, RoomUserLink, Room
from backend.security import decode_access_token
from backend.websocket_manager import manager

router = APIRouter(tags=["websocket"])

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    if not token:
        await websocket.close(code=1008, reason="Missing authentication token")
        return
        
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=1008, reason="Invalid or expired token")
        return
        
    user_id = int(payload.get("sub"))
    
    # Check user authorization and status
    with Session(engine) as db:
        user = db.get(User, user_id)
        if not user:
            await websocket.close(code=1008, reason="User not found")
            return
        if user.role != "ADMIN" and user.status != "APPROVED":
            await websocket.close(code=1008, reason="Account not approved")
            return
            
        username = user.username
        avatar_url = user.avatar_url

    # Register websocket connection
    await manager.connect(user_id, websocket)
    
    # Broadcast online status
    await manager.broadcast_global({
        "type": "user_status",
        "user_id": user_id,
        "username": username,
        "online": True
    })

    try:
        while True:
            # Await incoming message payload
            data = await websocket.receive_text()
            event = json.loads(data)
            
            event_type = event.get("type")
            room_id = event.get("room_id")
            
            if not room_id:
                continue
                
            with Session(engine) as db:
                room = db.get(Room, room_id)
                if not room:
                    continue
                    
                # Verification for DMs
                if room.is_direct_message:
                    is_member = db.exec(
                        select(RoomUserLink).where(
                            (RoomUserLink.room_id == room_id) & 
                            (RoomUserLink.user_id == user_id)
                        )
                    ).first()
                    if not is_member:
                        continue
                
                # Identify message recipient IDs
                users_stmt = select(RoomUserLink.user_id).where(RoomUserLink.room_id == room_id)
                if room.is_direct_message:
                    room_participant_ids = db.exec(users_stmt).all()
                else:
                    # Public room: broadcast to all currently online users
                    room_participant_ids = list(manager.active_connections.keys())

            if event_type == "message":
                content = event.get("content", "")
                image_url = event.get("image_url")
                
                if not content and not image_url:
                    continue
                    
                # Persist to database
                with Session(engine) as db:
                    new_msg = Message(
                        content=content,
                        image_url=image_url,
                        sender_id=user_id,
                        room_id=room_id
                    )
                    db.add(new_msg)
                    db.commit()
                    db.refresh(new_msg)
                    
                    msg_payload = {
                        "type": "message",
                        "id": new_msg.id,
                        "content": new_msg.content,
                        "image_url": new_msg.image_url,
                        "sender_id": new_msg.sender_id,
                        "sender_name": username,
                        "room_id": new_msg.room_id,
                        "created_at": new_msg.created_at.isoformat()
                    }
                    
                # Dispatch real-time broadcast
                await manager.broadcast_to_users(msg_payload, room_participant_ids)
                
            elif event_type == "typing":
                is_typing = event.get("is_typing", False)
                typing_payload = {
                    "type": "typing",
                    "user_id": user_id,
                    "username": username,
                    "room_id": room_id,
                    "is_typing": is_typing
                }
                
                # Send to other active participants
                other_participants = [pid for pid in room_participant_ids if pid != user_id]
                await manager.broadcast_to_users(typing_payload, other_participants)

    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
        # Broadcast offline status
        await manager.broadcast_global({
            "type": "user_status",
            "user_id": user_id,
            "username": username,
            "online": False
        })
