import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'

export const savedRoutes = new Hono()

savedRoutes.use('*', requireAuth())

/**
 * GET /api/v1/saved
 * Get array of saved topic IDs for current user
 */
savedRoutes.get('/', async (c) => {
  const user = c.get('user')
  const db = c.env.DB

  const { results } = await db.prepare(
    'SELECT topic_id FROM saved_topics WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.uid).all()

  return c.json({
    savedIds: (results || []).map(r => r.topic_id)
  })
})

/**
 * POST /api/v1/saved/toggle
 * Toggles saved state of a topic for the current user
 */
savedRoutes.post('/toggle', async (c) => {
  const user = c.get('user')
  const db = c.env.DB
  const now = Date.now()
  const { topicId } = await c.req.json()

  if (!topicId) {
    return c.json({ error: 'topicId is required' }, 400)
  }

  const existing = await db.prepare(
    'SELECT 1 FROM saved_topics WHERE user_id = ? AND topic_id = ?'
  ).bind(user.uid, String(topicId)).first()

  let isSaved = false

  if (existing) {
    // Remove
    await db.prepare(
      'DELETE FROM saved_topics WHERE user_id = ? AND topic_id = ?'
    ).bind(user.uid, String(topicId)).run()
    isSaved = false
  } else {
    // Add
    await db.prepare(`
      INSERT INTO saved_topics (user_id, topic_id, created_at)
      VALUES (?, ?, ?)
    `).bind(user.uid, String(topicId), now).run()
    isSaved = true
  }

  // Fetch updated list
  const { results } = await db.prepare(
    'SELECT topic_id FROM saved_topics WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.uid).all()

  return c.json({
    isSaved,
    savedIds: (results || []).map(r => r.topic_id)
  })
})
