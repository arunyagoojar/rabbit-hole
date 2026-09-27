import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'

export const interestsRoutes = new Hono()

interestsRoutes.use('*', requireAuth())

/**
 * GET /api/v1/interests
 * Get user's selected interests
 */
interestsRoutes.get('/', async (c) => {
  const user = c.get('user')
  const db = c.env.DB

  const { results } = await db.prepare(
    'SELECT interest_id FROM user_interests WHERE user_id = ? ORDER BY created_at ASC'
  ).bind(user.uid).all()

  return c.json({
    interests: (results || []).map(r => r.interest_id)
  })
})

/**
 * PUT /api/v1/interests
 * Atomically replace user's interests and mark as onboarded
 */
interestsRoutes.put('/', async (c) => {
  const user = c.get('user')
  const db = c.env.DB
  const now = Date.now()
  const { interests } = await c.req.json()

  if (!Array.isArray(interests)) {
    return c.json({ error: 'interests must be an array' }, 400)
  }

  const statements = [
    // 1. Clear existing
    db.prepare('DELETE FROM user_interests WHERE user_id = ?').bind(user.uid),
    // 2. Mark onboarded on user record
    db.prepare('UPDATE users SET onboarded = 1, updated_at = ? WHERE id = ?').bind(now, user.uid)
  ]

  // 3. Insert new interests
  for (const interestId of interests) {
    statements.push(
      db.prepare(`
        INSERT INTO user_interests (user_id, interest_id, created_at)
        VALUES (?, ?, ?)
      `).bind(user.uid, String(interestId), now)
    )
  }

  await db.batch(statements)

  return c.json({ success: true, interests })
})
