from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
from models import User, Score, Achievement, SessionLocal

# Password hashing (use pbkdf2_sha256 to avoid bcrypt binary compatibility issues)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def authenticate_user(db, username: str, password: str):
    """Authenticate a user"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def get_user_by_username(db, username: str):
    """Get a user by username"""
    return db.query(User).filter(User.username == username).first()

def create_user(db, username: str, password: str, email: str = None):
    """Create a new user"""
    hashed_password = get_password_hash(password)
    db_user = User(
        username=username,
        email=email,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def save_score(db, user_id: int, score: int, streak: int, word: str, difficulty: str = "normal"):
    """Save a game score"""
    db_score = Score(
        user_id=user_id,
        score=score,
        streak=streak,
        word=word,
        difficulty=difficulty
    )
    db.add(db_score)
    db.commit()
    db.refresh(db_score)
    return db_score

def get_user_scores(db, user_id: int, limit: int = 10):
    """Get user's recent scores"""
    return db.query(Score).filter(Score.user_id == user_id).order_by(Score.completed_at.desc()).limit(limit).all()

def get_user_stats(db, user_id: int):
    """Get user's statistics"""
    scores = db.query(Score).filter(Score.user_id == user_id).all()

    if not scores:
        return {
            "total_games": 0,
            "total_score": 0,
            "highest_score": 0,
            "average_score": 0,
            "best_streak": 0
        }

    total_score = sum(score.score for score in scores)
    highest_score = max(score.score for score in scores)
    best_streak = max(score.streak for score in scores)

    return {
        "total_games": len(scores),
        "total_score": total_score,
        "highest_score": highest_score,
        "average_score": total_score // len(scores),
        "best_streak": best_streak
    }

def unlock_achievement(db, user_id: int, achievement_id: str):
    """Unlock an achievement for a user if not already unlocked"""
    # Check if achievement already exists
    existing = db.query(Achievement).filter(
        Achievement.user_id == user_id,
        Achievement.achievement_id == achievement_id
    ).first()
    
    if not existing:
        achievement = Achievement(
            user_id=user_id,
            achievement_id=achievement_id
        )
        db.add(achievement)
        db.commit()
        return True
    return False

def get_user_achievements(db, user_id: int):
    """Get all achievements for a user"""
    achievements = db.query(Achievement).filter(Achievement.user_id == user_id).all()
    return [ach.achievement_id for ach in achievements]
