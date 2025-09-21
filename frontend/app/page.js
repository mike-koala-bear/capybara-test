"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

function LetterKey({ ch, status, onGuess }) {
  const common = "w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center border text-base font-bold transition-all duration-200 focus:outline-none focus:ring-2 shadow-md hover:shadow-lg transform hover:scale-105";
  if (status === "correct") {
    return (
      <button className={`${common} bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-500 text-white animate-pulse`} disabled>{ch}</button>
    );
  }
  if (status === "wrong") {
    return (
      <button className={`${common} bg-gradient-to-br from-red-400 to-red-600 border-red-500 text-white line-through opacity-60 scale-95`} disabled>{ch}</button>
    );
  }
  return (
    <button className={`${common} bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-800 hover:from-blue-100 hover:to-blue-200 dark:hover:from-slate-600 dark:hover:to-slate-700 border-blue-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-slate-500`} onClick={() => onGuess(ch)}>{ch}</button>
  );
}

function KeyCapture({ enabled, onGuess }) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e) => {
      const active = document.activeElement;
      const tag = active && active.tagName ? active.tagName.toLowerCase() : "";
      const isEditable = active && (active.isContentEditable || active.getAttribute?.("contenteditable") === "true");
      if (tag === "input" || tag === "textarea" || isEditable) return;
      const k = e.key || "";
      if (k.length === 1) {
        const ch = k.toLowerCase();
        if ((ch >= "a" && ch <= "z") || ch === "-") {
          onGuess(ch);
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onGuess]);
  return null;
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  // Mode: solo or multiplayer
  const [mode, setMode] = useState("solo"); // 'solo' | 'multi'
  const [soloName, setSoloName] = useState("");

  // Multiplayer state
  const [players, setPlayers] = useState([]);
  const [nameInput, setNameInput] = useState("");

  // Game state
  const [phase, setPhase] = useState("setup"); // setup | play | finished
  const [currentIdx, setCurrentIdx] = useState(0);
  const [word, setWord] = useState(""); // normalized guessable word (lowercase)
  const [displayRaw, setDisplayRaw] = useState(""); // optional display preserving spaces/capitals
  const [meaning, setMeaning] = useState("");
  const [revealed, setRevealed] = useState([]); // boolean[] of word length
  const [guessed, setGuessed] = useState({}); // { [char]: 'correct' | 'wrong' }
  const [winner, setWinner] = useState(null); // multiplayer only
  const [result, setResult] = useState(null); // solo: 'win' | 'lose' | null
  const [error, setError] = useState(null);
  const [source, setSource] = useState("global"); // 'global' | 'countries'

  // Solo meta
  const MAX_LIVES = 6;
  const [powerUp, setPowerUp] = useState(null);
  const [lives, setLives] = useState(MAX_LIVES);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [scoreMultiplier, setScoreMultiplier] = useState(1);
  const [perfectStreak, setPerfectStreak] = useState(0); // Track perfect games (no wrong guesses)
  const [achievements, setAchievements] = useState([]);
  const [showAchievement, setShowAchievement] = useState(null);
  const [powerUpsUsed, setPowerUpsUsed] = useState(0); // Track total power-ups used
  const [wordsCompleted, setWordsCompleted] = useState(0); // Track total words completed
  const [doublePointsUsed, setDoublePointsUsed] = useState(0); // Track double points usage
  const [revealLetterUsed, setRevealLetterUsed] = useState(0); // Track reveal letter usage

  // Define power-ups
  const POWER_UPS = {
    doublePoints: {
      name: "Double Points",
      icon: "💎",
      description: "Double your score for 30 seconds"
    },
    revealLetter: {
      name: "Reveal Letter",
      icon: "🔍",
      description: "Reveal a random unrevealed letter"
    },
    extraLife: {
      name: "Extra Life",
      icon: "❤️",
      description: "Gain an extra life"
    }
  };

  // Available power-ups stored in state so they can be consumed/granted dynamically
  const [availablePowerUps, setAvailablePowerUps] = useState([]);

  // Load achievements from database
  const loadAchievements = useCallback(async () => {
    if (!session) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/achievements`, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setAchievements(data.achievements || []);
      }
    } catch (error) {
      console.error('Failed to load achievements:', error);
    }
  }, [session]);

  // Load achievements when user logs in
  useEffect(() => {
    if (session) {
      loadAchievements();
    }
  }, [session, loadAchievements]);

  // Add this effect to handle power-up logic
  useEffect(() => {
    if (powerUp) {
      // Handle the power-up logic here
      console.log('Using power-up:', powerUp);
      
      // Track power-up usage
      setPowerUpsUsed(prev => prev + 1);

      // Handle score multiplier power-up
      if (powerUp === 'doublePoints') {
        setScoreMultiplier(2);
        setDoublePointsUsed(prev => prev + 1);
        // Reset the multiplier after 30 seconds
        const timer = setTimeout(() => {
          setScoreMultiplier(1);
        }, 30000);

        return () => clearTimeout(timer);
      }

      // Handle reveal letter power-up
      if (powerUp === 'revealLetter') {
        setRevealLetterUsed(prev => prev + 1);
        // Find first unrevealed letter and reveal it
        const unrevealedIndex = revealed.findIndex(r => !r);
        if (unrevealedIndex !== -1) {
          const newRevealed = [...revealed];
          newRevealed[unrevealedIndex] = true;
          setRevealed(newRevealed);
        }
      }

      // Handle extra life power-up
      if (powerUp === 'extraLife') {
        setLives(lives => lives + 1);
      }

      // Reset the power-up after use
      setPowerUp(null);
    }
  }, [powerUp, revealed, lives]);

  // Handle power-up activation
  const handlePowerUp = useCallback((type) => {
    // Consume the selected power-up
    setPowerUp(type);
    setAvailablePowerUps((prev) => prev.filter((p) => p !== type));
  }, []);

  // Define achievements - More fun and varied!
  const ACHIEVEMENTS = {
    firstWin: { name: "First Victory", icon: "🎉", description: "Win your first game" },
    perfectGame: { name: "Flawless", icon: "⭐", description: "Win without any wrong guesses" },
    streak5: { name: "Hot Streak", icon: "🔥", description: "Win 5 games in a row" },
    streak10: { name: "Unstoppable", icon: "🌟", description: "Win 10 games in a row" },
    perfectStreak3: { name: "Perfectionist", icon: "💎", description: "3 perfect games in a row" },
    perfectStreak5: { name: "Master", icon: "👑", description: "5 perfect games in a row" },
    perfectStreak10: { name: "Legend", icon: "🏆", description: "10 perfect games in a row" },
    highScore: { name: "High Scorer", icon: "🚀", description: "Score over 500 points" },
    megaScore: { name: "Score Master", icon: "💰", description: "Score over 1000 points" },
    speedster: { name: "Lightning Fast", icon: "⚡", description: "Win with all 6 lives remaining" },
    powerMaster: { name: "Power User", icon: "🌈", description: "Use 10 power-ups total" },
    wordsmith: { name: "Wordsmith", icon: "📚", description: "Solve 25 words" },
    scholar: { name: "Scholar", icon: "🎓", description: "Solve 100 words" },
    multiplierMania: { name: "Multiplier Mania", icon: "✨", description: "Use double points 5 times" },
    detective: { name: "Detective", icon: "🔍", description: "Use reveal letter 10 times" },
    survivor: { name: "Survivor", icon: "❤️‍🔥", description: "Win a game with only 1 life left" },
    comeback: { name: "Comeback Kid", icon: "💪", description: "Win after being down to 1 life" }
  };


  // Save achievement to database
  const saveAchievement = useCallback(async (achievementId) => {
    if (!session) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/achievements/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ achievement_id: achievementId }),
      });
      
      if (!response.ok) {
        console.error('Failed to save achievement');
      }
    } catch (error) {
      console.error('Error saving achievement:', error);
    }
  }, [session]);

  // Check and award achievements
  const checkAchievements = useCallback((gameData) => {
    const newAchievements = [];
    
    // First win
    if (streak === 0 && gameData.won && !achievements.includes('firstWin')) {
      newAchievements.push('firstWin');
    }
    
    // Perfect game (no wrong guesses)
    if (gameData.perfect && !achievements.includes('perfectGame')) {
      newAchievements.push('perfectGame');
    }
    
    // Streak achievements
    if (gameData.won) {
      if (streak + 1 >= 5 && !achievements.includes('streak5')) {
        newAchievements.push('streak5');
      }
      if (streak + 1 >= 10 && !achievements.includes('streak10')) {
        newAchievements.push('streak10');
      }
      
      if (gameData.perfect) {
        if (perfectStreak + 1 >= 3 && !achievements.includes('perfectStreak3')) {
          newAchievements.push('perfectStreak3');
        }
        if (perfectStreak + 1 >= 5 && !achievements.includes('perfectStreak5')) {
          newAchievements.push('perfectStreak5');
        }
        if (perfectStreak + 1 >= 10 && !achievements.includes('perfectStreak10')) {
          newAchievements.push('perfectStreak10');
        }
      }
    }
    
    // Score achievements
    if (gameData.finalScore >= 500 && !achievements.includes('highScore')) {
      newAchievements.push('highScore');
    }
    if (gameData.finalScore >= 1000 && !achievements.includes('megaScore')) {
      newAchievements.push('megaScore');
    }
    
    // Speedster (win with all lives)
    if (gameData.won && lives === MAX_LIVES && !achievements.includes('speedster')) {
      newAchievements.push('speedster');
    }
    
    // Survivor (win with only 1 life left)
    if (gameData.won && lives === 1 && !achievements.includes('survivor')) {
      newAchievements.push('survivor');
    }
    
    // Power-up achievements
    if (powerUpsUsed >= 10 && !achievements.includes('powerMaster')) {
      newAchievements.push('powerMaster');
    }
    
    // Word count achievements
    if (gameData.won) {
      const newWordCount = wordsCompleted + 1;
      if (newWordCount >= 25 && !achievements.includes('wordsmith')) {
        newAchievements.push('wordsmith');
      }
      if (newWordCount >= 100 && !achievements.includes('scholar')) {
        newAchievements.push('scholar');
      }
    }
    
    // Specific power-up usage achievements
    if (doublePointsUsed >= 5 && !achievements.includes('multiplierMania')) {
      newAchievements.push('multiplierMania');
    }
    if (revealLetterUsed >= 10 && !achievements.includes('detective')) {
      newAchievements.push('detective');
    }
    
    // Update achievements
    if (newAchievements.length > 0) {
      setAchievements(prev => [...prev, ...newAchievements]);
      setShowAchievement(newAchievements[0]); // Show first new achievement
      setTimeout(() => setShowAchievement(null), 4000);
      
      // Save to database
      newAchievements.forEach(achievement => {
        saveAchievement(achievement);
      });
    }
  }, [streak, perfectStreak, achievements, lives, powerUpsUsed, wordsCompleted, doublePointsUsed, revealLetterUsed, saveAchievement]);

  // Save score to user's account
  const saveScore = useCallback(async (finalScore, finalStreak) => {
    if (!session) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          score: finalScore,
          streak: finalStreak,
          word: word,
          difficulty: "normal", // You can make this dynamic based on game settings
        }),
      });

      if (!response.ok) {
        console.error('Failed to save score');
      }
    } catch (error) {
      console.error('Error saving score:', error);
    }
  }, [session, word]);

  const alphabet = useMemo(() => {
    return "ABCDEFGHIJKLMNOPQRSTUVWXYZ-".split("");
  }, []);

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

  const addPlayer = useCallback(() => {
    const n = nameInput.trim();
    if (!n) return;
    setPlayers((prev) => [...prev, n]);
    setNameInput("");
  }, [nameInput]);

  const removePlayer = useCallback((idx) => {
    setPlayers((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const startGame = useCallback(async () => {
    setError(null);
    let w = "hello";
    let m = "a greeting";
    let disp = "";
    try {
      const res = await fetch(`${baseUrl}/game/random?source=${encodeURIComponent(source)}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data?.word && data?.meaning) {
          w = String(data.word).toLowerCase();
          m = String(data.meaning);
          disp = typeof data.display === "string" ? data.display : w;
        }
      }
    } catch (e) {
      setError("Could not reach backend, using a fallback word.");
      disp = w;
    }
    setWord(w);
    setDisplayRaw(disp);
    setMeaning(m);
    setRevealed(Array.from({ length: w.length }, () => false));
    setGuessed({});
    // Give the player ONE random power-up to start (solo mode only)
    if (mode === "solo") {
      const POOL = ["doublePoints", "revealLetter", "extraLife"];
      const starter = POOL[Math.floor(Math.random() * POOL.length)];
      setAvailablePowerUps([starter]);
    } else {
      setAvailablePowerUps([]);
    }
    setCurrentIdx(0);
    setWinner(null);
    // Solo specific resets (keep score/streak across words)
    setResult(null);
    setLives(MAX_LIVES);
    setPhase("play");
  }, [baseUrl, source, mode]);

  const displayed = useMemo(() => {
    // If we have a display string (e.g., countries with capitals/spaces),
    // reveal letters according to `revealed` while preserving capitals, spaces and punctuation.
    if (displayRaw) {
      const tokens = [];
      const letterRe = /\p{L}/u; // any unicode letter
      let gi = 0; // index into guessable `word`
      for (let i = 0; i < displayRaw.length; i++) {
        const ch = displayRaw[i];
        const isLetter = letterRe.test(ch);
        if (isLetter) {
          const show = revealed[gi] ? ch : "_";
          tokens.push(show);
          gi += 1;
        } else if (ch === " ") {
          // Preserve a visible gap between words
          tokens.push("\u00A0");
        } else {
          // show punctuation as-is
          tokens.push(ch);
        }
      }
      // Do not insert extra spaces between every character; return as-is.
      return tokens.join("");
    }
    // Fallback: classic behavior using normalized `word`
    return word
      .split("")
      .map((ch, i) => (revealed[i] ? ch : "_"))
      .join(" ");
  }, [word, revealed, displayRaw]);

  const onGuess = useCallback(
    (raw) => {
      if (phase !== "play" || !word) return;
      const ch = raw.toLowerCase();
      if (guessed[ch]) return; // already guessed

      const matchIdx = [];
      for (let i = 0; i < word.length; i++) {
        if (word[i] === ch) matchIdx.push(i);
      }

      if (matchIdx.length > 0) {
        const newRev = revealed.slice();
        matchIdx.forEach((i) => (newRev[i] = true));
        const allRevealed = newRev.every(Boolean);
        setRevealed(newRev);
        setGuessed((g) => ({ ...g, [ch]: "correct" }));
        // Solo scoring for correct letters
        if (mode === "solo") {
          setScore((s) => s + 10 * matchIdx.length);
        }
        if (allRevealed) {
          if (mode === "solo") {
            // Win in solo: bonus for remaining lives
            const finalScore = score + 20 * lives;
            setScore(finalScore);
            setResult("win");
            setStreak((t) => t + 1);
            
            // Check if this was a perfect game (no wrong guesses)
            const wrongGuesses = Object.values(guessed).filter(status => status === "wrong").length;
            const isPerfect = wrongGuesses === 0;
            
            if (isPerfect) {
              setPerfectStreak((p) => p + 1);
              // Bonus points for perfect game
              setScore((s) => s + 100);
            } else {
              setPerfectStreak(0); // Reset perfect streak
            }
            
            // Track word completion
            setWordsCompleted(prev => prev + 1);
            
            setPhase("finished");

            // Check achievements
            checkAchievements({
              won: true,
              perfect: isPerfect,
              finalScore: finalScore + (isPerfect ? 100 : 0),
              livesRemaining: lives
            });

            // Grant a random new power-up for the next word to keep solo play fun
            setAvailablePowerUps((prev) => {
              const POOL = ["doublePoints", "revealLetter", "extraLife"];
              const remaining = POOL.filter((p) => !prev.includes(p));
              if (remaining.length === 0) return prev;
              const reward = remaining[Math.floor(Math.random() * remaining.length)];
              return [...prev, reward];
            });

            // Save score when game ends
            setTimeout(() => {
              saveScore(finalScore + (isPerfect ? 100 : 0), streak + 1);
            }, 100);
          } else {
            setWinner(players[currentIdx] ?? `Player ${currentIdx + 1}`);
            setPhase("finished");
          }
        }
        // Extra turn on correct guess: do not change currentIdx
      } else {
        setGuessed((g) => ({ ...g, [ch]: "wrong" }));
        if (mode === "solo") {
          const nextLives = lives - 1;
          setLives(nextLives);
          if (nextLives <= 0) {
            // Reveal the solution and end game
            setRevealed(Array.from({ length: word.length }, () => true));
            setResult("lose");
            setStreak(0);
            setPerfectStreak(0); // Reset perfect streak on loss
            setPhase("finished");
            
            // Check achievements for loss (none currently, but structure is there)
            checkAchievements({
              won: false,
              perfect: false,
              finalScore: score,
              livesRemaining: nextLives
            });
          }
        } else {
          // Advance to next player on wrong guess (multiplayer)
          setCurrentIdx((idx) => (players.length ? (idx + 1) % players.length : idx));
        }
      }
    },
    [phase, word, guessed, revealed, players, currentIdx, mode, lives]
  );

  return (
    <main className="min-h-screen p-6 sm:p-8 md:p-10 flex flex-col gap-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-600 bg-clip-text text-transparent drop-shadow-sm">🦫 Capybara</span>
            <span className="text-lg sm:text-xl font-semibold text-gray-600 dark:text-gray-300 block mt-2 tracking-wide">Guess the word, collect power-ups!</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {status === "loading" ? (
            <div className="text-sm text-gray-600">Loading...</div>
          ) : session ? (
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/profile")}
                className="px-3 py-1 text-sm rounded-md border bg-gray-50 text-gray-600 hover:bg-gray-100"
              >
                Profile
              </button>
              <div className="text-sm text-gray-600">
                Welcome, <span className="font-semibold">{session.user.name}</span>
              </div>
              <button
                onClick={() => signOut()}
                className="px-3 py-1 text-sm rounded-md border bg-red-50 text-red-600 hover:bg-red-100"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => signIn()}
                className="px-3 py-1 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                Sign in
              </button>
              <a
                href="/auth/signup"
                className="px-3 py-1 text-sm rounded-md border bg-green-50 text-green-600 hover:bg-green-100"
              >
                Sign up
              </a>
            </div>
          )}
        </div>
      </div>

      {phase === "setup" && (
        <section className="rounded-xl border p-5 sm:p-6 bg-white/70 dark:bg-white/5 backdrop-blur shadow-sm flex flex-col gap-4 border-gray-200/60 dark:border-white/10">
          <div className="text-sm text-gray-700">
            Play Solo or Multiplayer on one computer. In Solo you have 6 lives. Correct letters reveal all occurrences and give you an extra turn. Score +10 per letter, and a bonus of +20 per remaining life when you solve the word. Wrong guesses reduce lives; hit 0 lives to lose.
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Mode:</span>
            <button
              type="button"
              onClick={() => setMode("solo")}
              className={`px-2 py-1 text-xs rounded-md border shadow-sm ${mode === "solo" ? "bg-blue-600 text-white border-blue-600" : "bg-white/70 dark:bg-white/10 border-gray-300/70 dark:border-white/15"}`}
            >
              Solo
            </button>
            <button
              type="button"
              onClick={() => setMode("multi")}
              className={`px-2 py-1 text-xs rounded-md border shadow-sm ${mode === "multi" ? "bg-blue-600 text-white border-blue-600" : "bg-white/70 dark:bg-white/10 border-gray-300/70 dark:border-white/15"}`}
            >
              Multiplayer
            </button>
          </div>

          {/* Player inputs */}
          {mode === "multi" ? (
            <>
              <div className="flex gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter player name"
                  className="border rounded-md px-3 py-2 flex-1 bg-white/80 dark:bg-white/10 border-gray-300/70 dark:border-white/15 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition shadow-sm"
                />
                <button onClick={addPlayer} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow">Add</button>
              </div>
              {players.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {players.map((p, i) => (
                    <li key={i} className="flex items-center gap-2 bg-white/80 dark:bg-white/10 border border-gray-200/60 dark:border-white/10 rounded-md px-2.5 py-1.5 shadow-sm">
                      <span>{p}</span>
                      <button onClick={() => removePlayer(i)} className="text-xs text-red-600 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500/30 rounded">remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="flex gap-2">
              <input
                value={soloName}
                onChange={(e) => setSoloName(e.target.value)}
                placeholder="Your name (optional)"
                className="border rounded-md px-3 py-2 flex-1 bg-white/80 dark:bg-white/10 border-gray-300/70 dark:border-white/15 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition shadow-sm"
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs bg-white/70 dark:bg-white/10 border-gray-300/70 dark:border-white/15">
                {source === "countries" ? "Countries" : "Global list"}
              </span>
              <div className="flex items-center gap-1 ml-2">
                <button
                  type="button"
                  onClick={() => setSource("global")}
                  className={`px-2 py-1 text-xs rounded-md border shadow-sm ${source === "global" ? "bg-blue-600 text-white border-blue-600" : "bg-white/70 dark:bg-white/10 border-gray-300/70 dark:border-white/15"}`}
                >
                  Global
                </button>
                <button
                  type="button"
                  onClick={() => setSource("countries")}
                  className={`px-2 py-1 text-xs rounded-md border shadow-sm ${source === "countries" ? "bg-blue-600 text-white border-blue-600" : "bg-white/70 dark:bg-white/10 border-gray-300/70 dark:border-white/15"}`}
                >
                  Countries
                </button>
              </div>
              {source === "countries" && (
                <div className="text-[11px] text-gray-500 ml-2">Using backend/data/countries.txt</div>
              )}
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 flex-1">
              {mode === "multi" ? (
                <div className="text-sm text-gray-600">Players: {players.length || 0} (2+ recommended)</div>
              ) : (
                <div className="text-sm text-gray-600">Solo mode</div>
              )}
              <button
                onClick={startGame}
                disabled={mode === "multi" && players.length < 2}
                className={`px-4 py-2 rounded-md shadow ${mode === "multi" && players.length < 2 ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"}`}
              >
                Start {mode === "solo" ? "Solo" : "Game"}
              </button>
            </div>
          </div>
        </section>
      )}

      {phase !== "setup" && (
        <section className="rounded-xl border p-5 sm:p-6 bg-white/70 dark:bg-white/5 backdrop-blur shadow-sm flex flex-col gap-4 border-gray-200/60 dark:border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-sm text-gray-700">
              {phase === "play" && (
                mode === "multi" ? (
                  players.length > 0 ? (
                    <>Turn: <span className="font-semibold">{players[currentIdx]}</span></>
                  ) : (
                    <></>
                  )
                ) : (
                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 shadow-inner">
                      <div className="flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <span className="text-sm font-medium text-red-700 dark:text-red-300">Lives:</span>
                        <span className="text-lg">{"❤️".repeat(lives)}</span>
                      </div>
                      <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Score:</span>
                        <span className="font-bold text-lg text-blue-800 dark:text-blue-200">{score.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Streak:</span>
                        <span className="font-bold text-lg text-purple-800 dark:text-purple-200">{streak}</span>
                      </div>
                      {perfectStreak > 0 && (
                        <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-lg">
                          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Perfect:</span>
                          <span className="font-bold text-lg text-amber-800 dark:text-amber-200">{perfectStreak} ⭐</span>
                        </div>
                      )}
                      {scoreMultiplier > 1 && (
                        <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-yellow-200 to-orange-200 dark:from-yellow-800 dark:to-orange-800 rounded-lg animate-bounce">
                          <span className="text-lg">✨</span>
                          <span className="font-bold text-orange-800 dark:text-orange-200">{scoreMultiplier}x Multiplier!</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Power-ups */}
                    {availablePowerUps.length > 0 && (
                      <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">⚡ Power-ups Available:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {availablePowerUps.map((powerUp, idx) => (
                            <button
                              key={idx}
                              onClick={() => handlePowerUp(powerUp)}
                              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                              title={POWER_UPS[powerUp]?.description}
                            >
                              <span className="text-lg">{POWER_UPS[powerUp]?.icon}</span>
                              <span className="text-sm">{POWER_UPS[powerUp]?.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
              {phase === "finished" && (
                mode === "multi" ? (
                  <>Winner: <span className="font-semibold text-green-700">{winner}</span></>
                ) : (
                  <>
                    {result === "win" ? (
                      <span className="font-semibold text-green-700">You solved it!</span>
                    ) : (
                      <span className="font-semibold text-rose-700">Out of lives.</span>
                    )}
                    <span className="ml-3">Score: <span className="font-semibold">{score}</span></span>
                    <span className="ml-3">Streak: <span className="font-semibold">{streak}</span></span>
                  </>
                )
              )}
            </div>
            <div className="text-sm text-gray-600">Hint: {meaning}</div>
          </div>

          <div className="text-5xl sm:text-6xl font-mono tracking-[0.2em] text-center select-none mt-4 mb-6 text-transparent bg-gradient-to-r from-slate-700 via-slate-900 to-slate-700 dark:from-slate-200 dark:via-white dark:to-slate-200 bg-clip-text drop-shadow-sm">
            {displayed || "_ _ _ _ _"}
          </div>

          {error && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">{error}</div>
          )}

          <div className="grid grid-cols-9 sm:grid-cols-13 gap-3 justify-items-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
            {alphabet.map((ch) => (
              <LetterKey key={ch} ch={ch} status={guessed[ch.toLowerCase()]} onGuess={onGuess} />
            ))}
          </div>

          {/* Keyboard typing support */}
          <KeyCapture enabled={phase === "play"} onGuess={onGuess} />

          <div className="flex justify-end gap-2">
            {phase === "finished" && (
              <button
                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow"
                onClick={startGame}
              >
                New Word
              </button>
            )}
            <button
              className="px-4 py-2 rounded-md border bg-white/60 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-gray-400/40"
              onClick={() => {
                // Reset to setup
                setPhase("setup");
                setPlayers([]);
                setNameInput("");
                setSoloName("");
                setGuessed({});
                setRevealed([]);
                setWinner(null);
                setResult(null);
                setWord("");
                setMeaning("");
                setDisplayRaw("");
                setCurrentIdx(0);
                setLives(MAX_LIVES);
                setAvailablePowerUps([]);
                setScore(0);
                setStreak(0);
              }}
            >
              Reset
            </button>
          </div>
        </section>
      )}

      {/* Achievement Notification */}
      {showAchievement && (
        <div className="fixed top-4 right-4 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-4 rounded-xl shadow-2xl border-2 border-yellow-300">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{ACHIEVEMENTS[showAchievement]?.icon}</span>
              <div>
                <div className="font-bold text-lg">Achievement Unlocked!</div>
                <div className="text-sm">{ACHIEVEMENTS[showAchievement]?.name}</div>
                <div className="text-xs opacity-90">{ACHIEVEMENTS[showAchievement]?.description}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Achievements Display */}
      {achievements.length > 0 && (
        <div className="mt-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl border border-yellow-200 dark:border-yellow-700">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-3">
            🏆 Achievements ({achievements.length}/{Object.keys(ACHIEVEMENTS).length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {achievements.map((achievement) => (
              <div
                key={achievement}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-200 to-amber-200 dark:from-yellow-800 dark:to-amber-800 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                title={ACHIEVEMENTS[achievement]?.description}
              >
                <span className="text-lg animate-pulse">{ACHIEVEMENTS[achievement]?.icon}</span>
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {ACHIEVEMENTS[achievement]?.name}
                </span>
              </div>
            ))}
          </div>
          
          {/* Progress indicators for fun stats */}
          <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-600">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="text-center">
                <div className="font-semibold text-yellow-700 dark:text-yellow-300">{wordsCompleted}</div>
                <div className="text-yellow-600 dark:text-yellow-400">Words Solved</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-purple-700 dark:text-purple-300">{powerUpsUsed}</div>
                <div className="text-purple-600 dark:text-purple-400">Power-ups Used</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-blue-700 dark:text-blue-300">{doublePointsUsed}</div>
                <div className="text-blue-600 dark:text-blue-400">Double Points</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-green-700 dark:text-green-300">{revealLetterUsed}</div>
                <div className="text-green-600 dark:text-green-400">Letters Revealed</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="text-sm text-gray-600">
        Backend base URL can be set via NEXT_PUBLIC_API_BASE (e.g., http://127.0.0.1:8000). Open the FastAPI docs to test the /game/random endpoint.
      </div>
    </main>
  );
}
