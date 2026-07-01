import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select
from backend.database import init_db, engine
from backend.models import Room
from backend.routers import auth, admin, chat, websocket

app = FastAPI(title="Blink Chat API", version="1.0.0")

# Setup CORS middleware to allow communication with the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev. Restrict to specific domains in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload directories and mount static files
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Attach REST API and WebSocket routes
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(chat.router)
app.include_router(websocket.router)

# Mount frontend production build if it exists
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")


@app.on_event("startup")
def on_startup():
    # Execute database setup and migrate schema tables
    init_db()
    
    # Establish a default public chat room if none exists
    with Session(engine) as db:
        default_room = db.exec(select(Room).where(Room.name == "General Chat")).first()
        if not default_room:
            new_room = Room(name="General Chat", is_direct_message=False)
            db.add(new_room)
            db.commit()
            print("Created default chat room: General Chat")

if not os.path.exists(FRONTEND_DIST):
    @app.get("/")
    def read_root():
        return {"message": "Blink Chat API is active", "version": "1.0.0"}

