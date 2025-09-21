from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./capybara.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# User model
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to scores and achievements
    scores = relationship("Score", back_populates="user")
    achievements = relationship("Achievement", back_populates="user")

# Score model
class Score(Base):
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Integer, nullable=False)
    streak = Column(Integer, nullable=False, default=0)
    word = Column(String, nullable=False)
    difficulty = Column(String, default="normal")  # normal, hard, expert
    completed_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to user
    user = relationship("User", back_populates="scores")

# Achievement model
class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    achievement_id = Column(String, nullable=False)  # e.g., "firstWin", "perfectGame"
    unlocked_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to user
    user = relationship("User", back_populates="achievements")

# Create tables
def create_tables():
    Base.metadata.create_all(bind=engine)

# Database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
