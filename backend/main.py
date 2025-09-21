from fastapi import FastAPI, Query, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import random
import os
import unicodedata
from typing import Optional, List, Tuple, Dict
from pydantic import BaseModel
from mangum import Mangum

import asyncio

try:
    import httpx
except Exception:  # httpx will be added to requirements, but keep backend working even if missing
    httpx = None  # type: ignore

# Import our new modules
from models import User, Score, create_tables, get_db
from auth import (
    authenticate_user, create_user, get_user_by_username, save_score,
    get_user_scores, get_user_stats, create_access_token, SECRET_KEY, ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES, unlock_achievement, get_user_achievements,
)
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from datetime import timedelta

# Pydantic models for API requests/responses
class UserRegister(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class SaveScoreRequest(BaseModel):
    score: int
    streak: int
    word: str
    difficulty: str = "normal"

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    created_at: str

class ScoreResponse(BaseModel):
    id: int
    score: int
    streak: int
    word: str
    difficulty: str
    completed_at: str

class UserStatsResponse(BaseModel):
    total_games: int
    total_score: int
    highest_score: int
    average_score: int
    best_streak: int

class AchievementUnlock(BaseModel):
    achievement_id: str

app = FastAPI()

# Allow the Next.js dev server to call this API during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple word bank with meanings for the Capybara game (fallback)
WORDS = [
    {"word": "hello", "meaning": "a greeting"},
    {"word": "capybara", "meaning": "the largest living rodent"},
    {"word": "python", "meaning": "a popular programming language"},
    {"word": "fastapi", "meaning": "a modern, fast web framework for building APIs with Python"},
    {"word": "nextjs", "meaning": "a React framework for building web apps"},
    {"word": "hangman", "meaning": "a classic word guessing game"},
    {"word": "javascript", "meaning": "a programming language of the web"},
    {"word": "puzzle", "meaning": "a problem designed to test ingenuity or knowledge"},
    {"word": "rocket", "meaning": "a vehicle designed to propel itself by ejecting exhaust gas"},
    {"word": "keyboard", "meaning": "a panel of keys for typing"},
    {"word": "next-js", "meaning": "a React framework (hyphenated variant)"},
]


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/hello/{name}")
async def say_hello(name: str):
    return {"message": f"Hello {name}"}


# --- Word sources utilities ---
_LOCAL_CACHE = {
    "any": None,  # type: Optional[List[str]]
    "adj": None,
    "noun": None,
    "verb": None,
}

_DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

_POS_MAP = {
    "adj": "adjective",
    "noun": "noun",
    "verb": "verb",
}

# Cache for meanings loaded from local mapping files
_MEANINGS_CACHE: Optional[Dict[str, str]] = None


def _parse_meanings_file(path: str) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith("#"):
                    continue
                key: Optional[str] = None
                val: Optional[str] = None
                if "|" in line:
                    parts = line.split("|", 1)
                    key, val = parts[0].strip(), parts[1].strip()
                elif "\t" in line:
                    parts = line.split("\t", 1)
                    key, val = parts[0].strip(), parts[1].strip()
                elif " - " in line:
                    parts = line.split(" - ", 1)
                    key, val = parts[0].strip(), parts[1].strip()
                else:
                    # If only a single token, skip (not a mapping)
                    continue
                if key:
                    k = key.lower()
                    if val:
                        mapping[k] = val
    except FileNotFoundError:
        return {}
    return mapping


def _load_all_local_meanings() -> Dict[str, str]:
    global _MEANINGS_CACHE
    if _MEANINGS_CACHE is not None:
        return _MEANINGS_CACHE
    mapping: Dict[str, str] = {}
    candidates = [
        ["adjectives_meanings.txt", "adj_meanings.txt", "adjectives_meaning.txt", "adj_meaning.txt"],
        ["nouns_meanings.txt", "noun_meanings.txt", "nouns_meaning.txt", "noun_meaning.txt"],
        ["verbs_meanings.txt", "verb_meanings.txt", "verbs_meaning.txt", "verb_meaning.txt"],
        ["words_meanings.txt", "words_meaning.txt"],
    ]
    for group in candidates:
        for name in group:
            path = os.path.join(_DATA_DIR, name)
            part = _parse_meanings_file(path)
            if part:
                mapping.update(part)
    _MEANINGS_CACHE = mapping
    return mapping


def _lookup_local_meaning(word: str) -> Optional[str]:
    m = _load_all_local_meanings()
    return m.get(word.lower())


# Meanings cache specifically for words_meanings.txt only
_WORDS_MEANINGS_CACHE: Optional[Dict[str, str]] = None

def _lookup_words_meaning_only(word: str) -> Optional[str]:
    """Lookup meaning only from words_meanings.txt (or words_meaning.txt).
    Returns None if not found or file missing.
    """
    global _WORDS_MEANINGS_CACHE
    if _WORDS_MEANINGS_CACHE is None:
        mapping: Dict[str, str] = {}
        for name in ["words_meanings.txt", "words_meaning.txt"]:
            path = os.path.join(_DATA_DIR, name)
            part = _parse_meanings_file(path)
            if part:
                mapping.update(part)
        _WORDS_MEANINGS_CACHE = mapping
    return (_WORDS_MEANINGS_CACHE or {}).get(word.lower())


def _read_list_file(path: str) -> List[str]:
    words: List[str] = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                w = line.strip()
                if not w or w.startswith("#"):  # comments supported
                    continue
                words.append(w)
    except FileNotFoundError:
        return []
    return words


def _load_local_words(kind: str) -> List[str]:
    # kind in {any, adj, noun, verb}
    if _LOCAL_CACHE.get(kind) is not None:
        return _LOCAL_CACHE[kind] or []
    lst: List[str] = []
    # prefer specific list, then fallback to words.txt
    if kind != "any":
        lst = _read_list_file(os.path.join(_DATA_DIR, f"{kind}.txt"))
    if not lst:
        lst = _read_list_file(os.path.join(_DATA_DIR, "words.txt"))
    # de-duplicate and normalize
    lst = sorted({w.lower() for w in lst if w})
    _LOCAL_CACHE[kind] = lst
    return lst


async def _fetch_definition(word: str) -> Optional[str]:
    """Try to fetch a short definition using the free dictionary API.
    Returns None if not available or httpx missing.
    """
    if httpx is None:
        return None
    url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            data = resp.json()
            # Expected shape: list[ { meanings: [ { definitions: [ { definition: str } ] } ] } ]
            if isinstance(data, list) and data:
                entry = data[0]
                meanings = entry.get("meanings") or []
                for m in meanings:
                    defs = m.get("definitions") or []
                    for d in defs:
                        txt = d.get("definition")
                        if txt:
                            return str(txt)
    except Exception:
        return None
    return None


async def _random_word_from_wordnik(pos: Optional[str]) -> Optional[Tuple[str, Optional[str]]]:
    """Use Wordnik APIs if WORDNIK_API_KEY is set. Returns (word, meaning) or None."""
    if httpx is None:
        return None
    api_key = os.getenv("WORDNIK_API_KEY")
    if not api_key:
        return None
    base = "https://api.wordnik.com/v4"
    # Get a random word filtered by POS if provided
    include_pos = _POS_MAP.get(pos or "", "")
    params = {
        "hasDictionaryDef": "true",
        "minLength": 3,
        "maxLength": 16,
        "api_key": api_key,
    }
    if include_pos:
        params["includePartOfSpeech"] = include_pos
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{base}/words.json/randomWord", params=params)
            if r.status_code != 200:
                return None
            w = (r.json() or {}).get("word")
            if not w:
                return None
            w = str(w).lower()
            # Fetch a definition
            r2 = await client.get(f"{base}/word.json/{w}/definitions", params={"limit": 5, "api_key": api_key})
            meaning: Optional[str] = None
            if r2.status_code == 200:
                defs = r2.json() or []
                if isinstance(defs, list) and defs:
                    first = defs[0]
                    meaning = first.get("text") or first.get("partOfSpeech")
            if not meaning:
                meaning = await _fetch_definition(w)
            return (w, meaning)
    except Exception:
        pass

# Initialize database tables (with error handling for serverless)
try:
    create_tables()
except Exception as e:
    print(f"Warning: Could not initialize database tables: {e}")
    # Tables will be created on first database access

# Health check endpoint for deployment
@app.get("/health")
async def health_check():
    """Health check endpoint for deployment platforms"""
    return {"status": "healthy", "service": "capybara-backend"}

# Authentication endpoints
@app.post("/auth/register", response_model=UserResponse)
async def register(user: UserRegister, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if user already exists
    db_user = get_user_by_username(db, user.username)
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )

    # Create new user
    db_user = create_user(db, user.username, user.password, user.email)

    return UserResponse(
        id=db_user.id,
        username=db_user.username,
        email=db_user.email,
        created_at=db_user.created_at.isoformat()
    )

@app.post("/auth/login", response_model=Token)
async def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """Login user and return JWT token"""
    user = authenticate_user(db, user_credentials.username, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )

    return Token(access_token=access_token, token_type="bearer")

@app.post("/auth/me", response_model=UserResponse)
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()), db: Session = Depends(get_db)):
    """Get current user information"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_username(db, username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at.isoformat()
    )

# Score endpoints
@app.post("/scores", response_model=ScoreResponse)
async def save_user_score(
    score_data: SaveScoreRequest,
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db)
):
    """Save a user's game score"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

    user = get_user_by_username(db, username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    db_score = save_score(
        db,
        user.id,
        score_data.score,
        score_data.streak,
        score_data.word,
        score_data.difficulty
    )

    return ScoreResponse(
        id=db_score.id,
        score=db_score.score,
        streak=db_score.streak,
        word=db_score.word,
        difficulty=db_score.difficulty,
        completed_at=db_score.completed_at.isoformat()
    )

@app.get("/scores", response_model=List[ScoreResponse])
async def get_user_scores_endpoint(
    limit: int = 10,
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db)
):
    """Get user's recent scores"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

    user = get_user_by_username(db, username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    scores = get_user_scores(db, user.id, limit)

    return [
        ScoreResponse(
            id=score.id,
            score=score.score,
            streak=score.streak,
            word=score.word,
            difficulty=score.difficulty,
            completed_at=score.completed_at.isoformat()
        )
        for score in scores
    ]

@app.get("/stats", response_model=UserStatsResponse)
async def get_user_stats_endpoint(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db)
):
    """Get user's game statistics"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

    user = get_user_by_username(db, username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    stats = get_user_stats(db, user.id)
    return UserStatsResponse(**stats)

@app.post("/achievements/unlock")
async def unlock_achievement_endpoint(
    achievement_data: AchievementUnlock,
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db)
):
    """Unlock an achievement for the current user"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication credentials"
            )

        user = get_user_by_username(db, username)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")

        unlocked = unlock_achievement(db, user.id, achievement_data.achievement_id)
        return {"unlocked": unlocked, "achievement_id": achievement_data.achievement_id}

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials"
        )

@app.get("/achievements")
async def get_achievements_endpoint(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db)
):
    """Get all achievements for the current user"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication credentials"
            )

        user = get_user_by_username(db, username)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")

        achievements = get_user_achievements(db, user.id)
        return {"achievements": achievements}

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials"
        )

@app.get("/game/random")
async def random_word(
    pos: Optional[str] = Query(None, description="(Deprecated) ignored."),
    source: Optional[str] = Query(
        None,
        description="Choose pool: 'global' (words.txt), 'countries' (countries only), or omit for both.",
    ),
):
    """Return a random word and its meaning for the Capybara game.

    Pools:
    - global: backend/data/words.txt (local list)
    - countries: All countries (from backend/data/countries.txt if present, otherwise fetched from REST Countries API)
    - default (both): union of the two

    Meanings are resolved from backend/data/words_meanings.txt (or words_meaning.txt),
    then country metadata ("a country in <region>"), then a dictionary lookup, then a generic fallback.

    For countries: the response includes `display` preserving capitals and spaces, while `word` removes spaces and non-letters for guessing.
    """
    # Load pools
    words_pool = _load_local_words("any")
    countries_pool: List[str] = await _load_countries()

    pick_from: List[str]
    src = (source or "").lower().strip()
    if src == "global":
        pick_from = words_pool
    elif src == "countries":
        pick_from = countries_pool
    else:
        pick_from = sorted({*words_pool, *countries_pool})

    if pick_from:
        w = random.choice(pick_from)
        # Country-specific handling (meaning + display) takes priority if applicable
        if (_COUNTRY_MEANINGS or {}).get(w) is not None:
            m = (_COUNTRY_MEANINGS or {}).get(w) or "a country"
            disp = (_COUNTRY_DISPLAY or {}).get(w) or w
            return {"word": w, "display": disp, "meaning": m}
        # Global words
        m = _lookup_words_meaning_only(w) or (await _fetch_definition(w)) or "a word"
        return {"word": w, "display": w, "meaning": m}

    # Try Wordnik (no POS)
    result: Optional[Tuple[str, Optional[str]]] = await _random_word_from_wordnik(None)
    if result:
        w, m = result
        if not m:
            m = "a word"
        return {"word": w, "display": w, "meaning": m}

    # Fallback to built-in small list
    choice = random.choice(WORDS)
    return {"word": choice["word"].lower(), "display": choice["word"], "meaning": choice["meaning"]}


# --- Countries support (global list augmentation) ---
_COUNTRIES_CACHE: Optional[List[str]] = None
_COUNTRY_MEANINGS: Optional[Dict[str, str]] = None
_COUNTRY_DISPLAY: Optional[Dict[str, str]] = None


def _normalize_game_word(s: str) -> str:
    """General normalization used for non-country words: letters and single hyphens.
    Keeps hyphens for multi-word phrases (legacy behavior).
    """
    # Lowercase and strip accents
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = s.encode("ascii", "ignore").decode("ascii")
    s = s.replace("&", " and ")
    # Map various separators/punctuation to hyphens and drop others
    out_chars: List[str] = []
    prev_hyphen = False
    for ch in s:
        if "a" <= ch <= "z":
            out_chars.append(ch)
            prev_hyphen = False
        elif ch in [" ", "-", "'", "’", ".", ",", "(", ")", "/"]:
            # collapse consecutive hyphens later
            if not prev_hyphen:
                out_chars.append("-")
                prev_hyphen = True
        else:
            # skip other characters
            continue
    # Remove leading/trailing hyphens and collapse multiples
    cleaned: List[str] = []
    prev_h = False
    for ch in out_chars:
        if ch == "-":
            if not prev_h:
                cleaned.append("-")
            prev_h = True
        else:
            cleaned.append(ch)
            prev_h = False
    result = "".join(cleaned).strip("-")
    return result


def _normalize_country_guess(s: str) -> str:
    """Country guess normalization: keep only letters a-z, remove spaces and punctuation, lowercase.
    Accents are stripped (e.g., Côte d'Ivoire -> cotedivoire).
    """
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = s.encode("ascii", "ignore").decode("ascii")
    out: List[str] = []
    for ch in s:
        if "a" <= ch <= "z":
            out.append(ch)
        # else ignore spaces/punctuation/digits
    return "".join(out)


async def _load_countries() -> List[str]:
    """Load country names for inclusion in the global pool.

    Order of preference:
    1) backend/data/countries.txt (one name per line). Optional meanings via countries_meanings.txt.
    2) REST Countries API (https://restcountries.com/v3.1/all) with region-based meanings.
    3) Small built-in fallback list.
    """
    global _COUNTRIES_CACHE, _COUNTRY_MEANINGS, _COUNTRY_DISPLAY

    # If a local countries.txt exists, ALWAYS rebuild from it so the list strictly
    # matches the file and reflects any edits without needing a server restart.
    local_path = os.path.join(_DATA_DIR, "countries.txt")
    if os.path.exists(local_path):
        names: List[str] = []  # list of guess tokens (letters-only)
        meanings: Dict[str, str] = {}
        displays: Dict[str, str] = {}

        local_list = _read_list_file(local_path)
        local_meanings: Dict[str, str] = {}
        for fname in ["countries_meanings.txt", "countries_meaning.txt"]:
            path = os.path.join(_DATA_DIR, fname)
            part = _parse_meanings_file(path)
            if part:
                local_meanings.update(part)
        for raw in local_list:
            disp = raw.strip()
            if not disp:
                continue
            guess = _normalize_country_guess(disp)
            if not guess:
                continue
            names.append(guess)
            displays[guess] = disp
            m = local_meanings.get(disp.lower()) or local_meanings.get(guess)
            meanings[guess] = m or "a country"
        # Deduplicate and cache, then return
        names = sorted({n for n in names if n})
        _COUNTRIES_CACHE = names
        _COUNTRY_MEANINGS = meanings
        _COUNTRY_DISPLAY = displays
        return names

    # No local file — use cached remote/builtin list if available
    if _COUNTRIES_CACHE is not None:
        return _COUNTRIES_CACHE or []

    names: List[str] = []  # list of guess tokens (letters-only)
    meanings: Dict[str, str] = {}
    displays: Dict[str, str] = {}

    # 2) Try REST Countries API
    if httpx is not None:
        try:
            async with httpx.AsyncClient(timeout=7.0) as client:
                r = await client.get("https://restcountries.com/v3.1/all", params={"fields": "name,region"})
                if r.status_code == 200:
                    data = r.json() or []
                    if isinstance(data, list):
                        for item in data:
                            name_obj = item.get("name") or {}
                            nm = name_obj.get("official") or name_obj.get("common")
                            region = item.get("region")
                            if not nm:
                                continue
                            disp = str(nm)
                            guess = _normalize_country_guess(disp)
                            if not guess:
                                continue
                            names.append(guess)
                            displays[guess] = disp
                            meanings[guess] = f"a country in {region}" if region else "a country"
        except Exception:
            pass
    # 3) Minimal fallback if API unavailable
    if not names:
        fallback = [
            "Japan", "Brazil", "Kenya", "Canada", "France", "India", "Australia", "Egypt", "Mexico", "Spain",
            "China", "Italy", "Germany", "Norway", "Peru", "United States of America", "United Kingdom", "South Africa",
        ]
        for disp in fallback:
            guess = _normalize_country_guess(disp)
            if not guess:
                continue
            names.append(guess)
            displays[guess] = disp
            meanings[guess] = "a country"

    # Deduplicate and cache
    names = sorted({n for n in names if n})
    _COUNTRIES_CACHE = names
    _COUNTRY_MEANINGS = meanings
    _COUNTRY_DISPLAY = displays
    return names

# Vercel serverless function handler
handler = Mangum(app)
