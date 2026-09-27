import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'

export const sessionsRoutes = new Hono()

sessionsRoutes.use('*', requireAuth())

function getTodayStr() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getYesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * GET /api/v1/sessions
 * Returns user's reading history sessions map + streak
 */
sessionsRoutes.get('/', async (c) => {
  const user = c.get('user')
  const db = c.env.DB

  const { results } = await db.prepare(
    'SELECT * FROM reading_sessions WHERE user_id = ? ORDER BY last_updated DESC'
  ).bind(user.uid).all()

  // Format into { [sessionId]: sessionRecord } matching client expectation
  const historyMap = {}
  for (const row of results || []) {
    let parsedCards = []
    let parsedSnapshot = null
    try {
      if (row.cards_data) parsedCards = JSON.parse(row.cards_data)
    } catch {}
    try {
      if (row.topic_snapshot) parsedSnapshot = JSON.parse(row.topic_snapshot)
    } catch {}

    historyMap[row.id] = {
      id: row.id,
      topicId: row.topic_id,
      title: row.title,
      category: row.category,
      cardsRead: row.cards_read,
      totalCards: row.total_cards,
      date: row.read_date,
      lastUpdated: row.last_updated,
      selectedPrompt: row.selected_prompt,
      cards: parsedCards,
      topicSnapshot: parsedSnapshot,
      audioUrl: row.audio_url
    }
  }

  const userRow = await db.prepare(
    'SELECT streak, last_read_date FROM users WHERE id = ?'
  ).bind(user.uid).first()

  return c.json({
    history: historyMap,
    streak: userRow?.streak || 0,
    lastReadDate: userRow?.last_read_date || ''
  })
})

/**
 * POST /api/v1/sessions
 * Record a completed reading session and calculate daily streak
 */
sessionsRoutes.post('/', async (c) => {
  const user = c.get('user')
  const db = c.env.DB
  const now = Date.now()
  const today = getTodayStr()
  const yesterday = getYesterdayStr()

  const body = await c.req.json()
  const {
    topicId,
    title = 'Untitled',
    category = 'General',
    cardsRead = 0,
    totalCards = 0,
    selectedPrompt = null,
    cards = [],
    topicSnapshot = null,
    audioUrl = null
  } = body

  if (!topicId) {
    return c.json({ error: 'topicId is required' }, 400)
  }

  const sessionId = `${now}-${topicId}`

  // Fetch current streak info
  const userRow = await db.prepare(
    'SELECT streak, last_read_date FROM users WHERE id = ?'
  ).bind(user.uid).first()

  const currentStreak = userRow?.streak || 0
  const lastReadDate = userRow?.last_read_date || ''

  let newStreak = 1
  if (lastReadDate === today) {
    newStreak = currentStreak || 1
  } else if (lastReadDate === yesterday) {
    newStreak = currentStreak + 1
  } else {
    newStreak = 1
  }

  const statements = [
    // 1. Insert session record
    db.prepare(`
      INSERT INTO reading_sessions (
        id, user_id, topic_id, title, category, cards_read, total_cards,
        read_date, last_updated, selected_prompt, cards_data, topic_snapshot,
        audio_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId,
      user.uid,
      String(topicId),
      String(title),
      String(category),
      Number(cardsRead),
      Number(totalCards),
      today,
      now,
      selectedPrompt ? String(selectedPrompt) : null,
      JSON.stringify(cards || []),
      topicSnapshot ? JSON.stringify(topicSnapshot) : null,
      audioUrl ? String(audioUrl) : null,
      now
    ),

    // 2. Update user streak
    db.prepare(`
      UPDATE users
      SET streak = ?, last_read_date = ?, updated_at = ?
      WHERE id = ?
    `).bind(newStreak, today, now, user.uid)
  ]

  await db.batch(statements)

  return c.json({
    success: true,
    sessionId,
    streak: newStreak,
    lastReadDate: today,
    session: {
      id: sessionId,
      topicId,
      title,
      category,
      cardsRead,
      totalCards,
      date: today,
      lastUpdated: now,
      selectedPrompt,
      cards,
      topicSnapshot,
      audioUrl
    }
  })
})
