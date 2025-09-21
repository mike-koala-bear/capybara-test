"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function Profile() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState(null)
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }

    if (session) {
      loadUserData()
    }
  }, [session, status, router])

  const loadUserData = async () => {
    try {
      setLoading(true)

      // Load user stats
      const statsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/stats`, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      })

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

      // Load recent scores
      const scoresResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/scores?limit=10`, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json'
        },
      })

      if (!scoresResponse.ok) {
        console.error('Failed to fetch scores:', scoresResponse.statusText)
        setScores([])
        return
      }

      try {
        const scoresData = await scoresResponse.json()
        setScores(scoresData)
      } catch (error) {
        console.error('Error parsing scores:', error)
        setScores([])
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile</h1>
          <div className="flex gap-4">
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Back to Game
            </button>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 text-sm rounded-md border bg-red-50 text-red-600 hover:bg-red-100"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Account Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
              <p className="mt-1 text-lg text-gray-900 dark:text-white">{session.user.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <p className="mt-1 text-lg text-gray-900 dark:text-white">{session.user.email || "Not provided"}</p>
            </div>
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Game Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total_games}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Games Played</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.highest_score}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Highest Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.total_score}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.average_score}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Average Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.best_streak}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Best Streak</div>
              </div>
            </div>
          </div>
        )}

        {/* Game History */}
        <GameHistorySection scores={scores} loading={loading} />

        {/* Recent Scores */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Recent Scores</h2>
          {scores.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">No games played yet. Start playing to see your scores!</p>
          ) : (
            <div className="space-y-3">
              {scores.map((score) => (
                <div key={score.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{score.word}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(score.completed_at).toLocaleDateString()} • Streak: {score.streak}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-green-600">{score.score}</div>
                    <div className="text-xs text-gray-500">{score.difficulty}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GameHistorySection({ scores, loading }) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Game History</h2>
        <div className="flex justify-center py-8">
          <div className="text-gray-500">Loading game history...</div>
        </div>
      </div>
    )
  }

  if (scores.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Game History</h2>
        <p className="text-gray-600 dark:text-gray-400">
          No games played yet. <a href="/" className="text-blue-600 hover:underline">Play a game</a> to see your scores!
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Game History</h2>
      <div className="space-y-3">
        {scores.map((score) => (
          <div key={score.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{score.word || 'Unknown word'}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {score.completed_at ? new Date(score.completed_at).toLocaleDateString() : 'Unknown date'} • 
                Streak: {score.streak}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-lg text-green-600">{score.score}</div>
              <div className="text-xs text-gray-500 capitalize">{score.difficulty || 'normal'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
