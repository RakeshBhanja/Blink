import os
from sqlmodel import SQLModel, create_engine, Session

# Database path (stored in a dedicated data subdirectory for safe volume mounting)
DATABASE_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATABASE_DIR, exist_ok=True)
DATABASE_FILE = os.path.join(DATABASE_DIR, "database.db")
DATABASE_URL = f"sqlite:///{DATABASE_FILE}"

# Connect args needed for SQLite to run in multithreaded environments (FastAPI)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
