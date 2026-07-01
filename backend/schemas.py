from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    username_or_email: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    status: str
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class UserStatusUpdate(BaseModel):
    user_id: int
    status: str  # "APPROVED", "REJECTED", "PENDING"
    role: Optional[str] = None  # "ADMIN", "USER"

class RoomCreate(BaseModel):
    name: Optional[str] = None
    is_direct_message: bool = False
    participant_ids: Optional[List[int]] = None # User IDs to add (DMs need exactly 1 other user)

class RoomResponse(BaseModel):
    id: int
    name: Optional[str] = None
    is_direct_message: bool
    created_at: datetime
    users: List[UserResponse]

    class Config:
        from_attributes = True

class MessageResponse(BaseModel):
    id: int
    content: str
    image_url: Optional[str] = None
    sender_id: int
    sender_name: Optional[str] = None
    room_id: int
    created_at: datetime

    class Config:
        from_attributes = True
