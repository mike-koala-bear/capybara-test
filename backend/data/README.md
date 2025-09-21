Word list files for the Capybara game (optional).

How it works:
- The backend uses a single global pool composed of words.txt plus all countries.
- Countries come from countries.txt if present; otherwise they are fetched automatically from the REST Countries API.
- If a local meanings file is present, its definition is returned instantly (no network needed).
- If there is no local meaning, the backend will try a short definition from dictionaryapi.dev.
- If no local lists exist and the network is unavailable, the server falls back to a tiny built‑in list.

Supported word list files (all optional; one entry per line):
- words.txt — global word pool (used by default)
- countries.txt — list of country names (optional; otherwise fetched online)

Optional meanings mapping files (any of these names will be detected):
- words_meanings.txt (or words_meaning.txt)
- countries_meanings.txt (or countries_meaning.txt)

Line formats accepted in meanings files (one per line):
- word | meaning
- word<TAB>meaning
- word - meaning   (only if the dash is surrounded by spaces)

Notes:
- Lines starting with # are comments. Words are normalized to lowercase.
- For large lists (1,000+), paste/append more lines and restart the backend.

Where to get big lists:
- SCOWL word lists: https://wordlist.aspell.net/ (choose sizes and parts of speech)
- wordfreq English lists: https://github.com/rspeer/wordfreq
- dwyl/english-words: https://github.com/dwyl/english-words

Tip: If you only want country names, fill countries.txt (and optionally countries_meanings.txt). During play, spaces and punctuation in country names are ignored for guessing, but the display keeps capitals and spaces (e.g., display "United States of America" while you only guess the letters).


Quick start — 10 local words (included)
- Out of the box, the game uses backend/data/words.txt (10 words) and shows meanings from backend/data/words_meanings.txt.
- Edit these files to change the starter words without touching any code. Restart the backend after edits.

Syntax
- Word lists: one word per line (lowercase recommended). Example (words.txt):
  apple
  book
  river
- Meanings mapping: one per line using any of these separators:
  word | meaning
  word<TAB>meaning
  word - meaning    (dash must have spaces around it)

Example (words_meanings.txt)
  apple | a round fruit with red, green, or yellow skin
  river | a large natural flow of water

---

