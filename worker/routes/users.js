import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'

export const userRoutes = new Hono()

userRoutes.use('*', requireAuth())

/**
 * GET /api/v1/user/me
 * Returns full profile, interests, saved topic IDs, streak, and recent sessions count
 */
userRoutes.get('/me', async (c) => {
  const user = c.get('user')
  const db = c.env.DB

  const userRecord = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.uid).first()
  if (!userRecord) {
    return c.json({ error: 'User not found in D1' }, 404)
  }

  const { results: interestsResult } = await db.prepare(
    'SELECT interest_id FROM user_interests WHERE user_id = ?'
  ).bind(user.uid).all()

  const { results: savedResult } = await db.prepare(
    'SELECT topic_id FROM saved_topics WHERE user_id = ?'
  ).bind(user.uid).all()

  return c.json({
    user: {
      ...userRecord,
      onboarded: userRecord.onboarded === 1,
      interests: (interestsResult || []).map(r => r.interest_id),
      savedIds: (savedResult || []).map(r => r.topic_id)
    }
  })
})

/**
 * PATCH /api/v1/user/me
 * Update theme, onboarded status, or profile info
 */
userRoutes.patch('/me', async (c) => {
  const user = c.get('user')
  const db = c.env.DB
  const now = Date.now()
  const body = await c.req.json()

  const fields = []
  const values = []

  if (body.theme !== undefined) {
    fields.push('theme = ?')
    values.push(body.theme)
  }
  if (body.onboarded !== undefined) {
    fields.push('onboarded = ?')
    values.push(body.onboarded ? 1 : 0)
  }
  if (body.streak !== undefined) {
    fields.push('streak = ?')
    values.push(body.streak)
  }
  if (body.lastReadDate !== undefined) {
    fields.push('last_read_date = ?')
    values.push(body.lastReadDate)
  }

  if (fields.length === 0) {
    return c.json({ success: true })
  }

  fields.push('updated_at = ?')
  values.push(now)
  values.push(user.uid)

  const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`
  await db.prepare(query).bind(...values).run()

  return c.json({ success: true })
})
