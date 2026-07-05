from datetime import datetime
from typing import List, Optional
from sqlmodel import Field, Relationship, SQLModel

class RoomUserLink(SQLModel, table=True):
    room_id: Optional[int] = Field(default=None, foreign_key="room.id", primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", primary_key=True)

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    role: str = Field(default="USER")  # "ADMIN", "USER"
    status: str = Field(default="PENDING")  # "PENDING", "APPROVED", "REJECTED"
    avatar_url: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    rooms: List["Room"] = Relationship(back_populates="users", link_model=RoomUserLink)

class Room(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None, index=True)  # Can be empty for DMs
    is_direct_message: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    users: List[User] = Relationship(back_populates="rooms", link_model=RoomUserLink)

class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    content: str
    image_url: Optional[str] = Field(default=None)
    sender_id: int = Field(foreign_key="user.id")
    room_id: int = Field(foreign_key="room.id")
    status: str = Field(default="sent")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    sender_name: Optional[str] = Field(default=None) # Denormalized or runtime field for convenience

