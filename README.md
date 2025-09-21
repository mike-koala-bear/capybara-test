# Run backend and frontend

Follow these steps to run both apps and see text in your browser.

## Features
- Solo or Multiplayer modes (same computer)
- Solo: 6 lives; +10 points per correctly revealed letter; bonus +20 per remaining life when you solve; lose when lives reach 0
- Multiplayer: turn-based; extra turn on correct guesses; wrong guesses pass the turn; winner is the player who completes the word
- Choose your pool: Global words (backend/data/words.txt) or Countries
- Countries use full official names for display (capitals and spaces preserved) but spaces/punctuation are ignored for guessing
- Optional local meanings via words_meanings.txt (and countries_meanings.txt)
- Click letters or type on your keyboard to guess

## Prerequisites
- Python 3.13
- Node.js (LTS recommended) and npm

---

## 1) Backend (FastAPI)

Open a terminal and start the API:

1. Change into the backend folder
   - macOS/Linux:
     - cd backend
     - python3 -m venv .venv
     - source .venv/bin/activate
   - Windows (PowerShell):
     - cd backend
     - py -m venv .venv
     - .venv\\Scripts\\Activate.ps1
2. Install dependencies
   - pip install -r requirements.txt
3. Run the development server (hot reload)
   - uvicorn main:app --reload --port 8000
4. Verify it works
   - Open http://127.0.0.1:8000/ — you should see: {"message":"Hello World"}
   - Open http://127.0.0.1:8000/hello/YourName — you should see your name in the message.

Tips:
- You can also test using the included HTTP file: backend/test_main.http (open it in your IDE and click the request), or curl:
  - curl http://127.0.0.1:8000/
  - curl http://127.0.0.1:8000/hello/User

## 3) User Accounts & Authentication Setup

The game now supports user accounts with score tracking. To enable this feature:

### Frontend Setup
1. Create `frontend/.env.local` with the following content:
```bash
# Backend API URL
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000

# NextAuth Configuration (generate a secure secret)
NEXTAUTH_SECRET=your-nextauth-secret-change-in-production
NEXTAUTH_URL=http://localhost:3000

# Optional: External database (if not using SQLite)
# DATABASE_URL=postgresql://user:password@localhost:5432/capybara
```

### Backend Setup
1. Set up the database and authentication secrets:
```bash
# Generate a secure secret key for JWT tokens
export SECRET_KEY="your-secret-key-change-in-production"

# Optional: Use PostgreSQL instead of SQLite
# export DATABASE_URL="postgresql://user:password@localhost:5432/capybara"
```

2. Install new dependencies:
```bash
cd backend
pip install -r requirements.txt
```

3. The database tables will be created automatically when you start the backend.

### Features Added
- ✅ User registration and login
- ✅ JWT-based authentication
- ✅ Score saving to user accounts
- ✅ User profile page with statistics
- ✅ Game history tracking
- ✅ Power-up system integration

### API Endpoints
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and get JWT token
- `POST /auth/me` - Get current user info
- `POST /scores` - Save a game score
- `GET /scores` - Get user's recent scores
- `GET /stats` - Get user's game statistics

### Testing Authentication
1. Start both backend and frontend servers
2. Visit http://localhost:3000
3. Click "Sign up" to create an account
4. Play games and check your profile to see saved scores

---


Open a new terminal tab/window and start the frontend:

1. Change into the frontend folder
   - cd frontend
2. Install dependencies (first time only)
   - npm install
3. Start the dev server
   - npm run dev
4. Open the app in your browser
   - http://localhost:3000
   - The home page shows the Capybara word game. Choose Solo or Multiplayer in the setup screen. In Solo you don't need to add players; in Multiplayer, add player names and start!
   - Optionally set a custom backend URL via env var: create frontend/.env.local with NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000

---

## Running both together
- Keep the backend running on http://127.0.0.1:8000 and the frontend on http://localhost:3000 in separate terminals.
- CORS is enabled on the backend for the Next.js dev server. If you change frontend port/host, update the allowed origins in backend/main.py.
- If your browser or OS blocks mixed localhost/127.0.0.1 calls, use the same host form consistently (e.g., 127.0.0.1 vs localhost).

## Troubleshooting
- If Python command isn’t found, try using py (Windows) or python3 (macOS/Linux).
- If port 8000 or 3000 is in use, change the port:
  - Backend: uvicorn main:app --reload --port 8001 (then visit 127.0.0.1:8001)
  - Frontend: npm run dev -- -p 3001 (then visit localhost:3001)
- After changing ports, remember to update any URLs and, if needed, NEXT_PUBLIC_API_BASE.

---

## Add more words (and countries)
You can expand the game easily using either local files or online data.

Option A — Edit local files (no API key needed):
1. Add words to backend/data/words.txt (one per line). Lines starting with # are comments.
2. Optional meanings in backend/data/words_meanings.txt using the syntax shown below.
3. Optional countries: create backend/data/countries.txt (one country per line). You may also add backend/data/countries_meanings.txt to override meanings. During play, spaces and punctuation in country names are ignored for guessing, but the display keeps capitals and spaces (e.g., display "United States of America" while you only guess the letters).
4. Restart the backend.

Option B — Use online data (automatic):
- If a meaning isn’t found locally, the server tries a short definition from https://dictionaryapi.dev.
- If countries.txt is not present, the server fetches all countries from the REST Countries API and includes them automatically.

Where to get large word lists:
- SCOWL: https://wordlist.aspell.net/
- wordfreq: https://github.com/rspeer/wordfreq
- dwyl English words: https://github.com/dwyl/english-words

API quick test (use your browser or the HTTP file):
- http://127.0.0.1:8000/game/random                  # both pools
- http://127.0.0.1:8000/game/random?source=global    # global words only
- http://127.0.0.1:8000/game/random?source=countries # countries only

Notes:
- You can choose the pool in the UI (Global or Countries). The backend also supports the `source` query parameter as shown above.
- If online lookups fail, the game still works and shows a generic meaning.
- If both online sources and local lists are unavailable, the server falls back to a small built‑in list.


## Quick start: edit 10 local words (used by default)
The game ships with a small local list so you can play immediately without any API keys.

Files to edit (backend/data/):
- words.txt — one word per line (used when Word type = Any, which is the default)
- words_meanings.txt — optional meanings mapping

Accepted syntax for meanings (any of these on each line):
- word | meaning
- word<TAB>meaning
- word - meaning    (dash must have spaces around it)

Example
- backend/data/words.txt
  apple
  book
  river
- backend/data/words_meanings.txt
  apple | a round fruit with red, green, or yellow skin
  river | a large natural flow of water

After editing, restart the backend server to pick up changes.

Notes:
- The backend uses a single global pool from backend/data/words.txt plus all countries.
- Meanings come from backend/data/words_meanings.txt when available; otherwise a short online definition may be used.
- Countries come from backend/data/countries.txt if present, otherwise they are fetched automatically from REST Countries.
