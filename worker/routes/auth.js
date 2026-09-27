import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'

export const authRoutes = new Hono()

authRoutes.use('*', requireAuth())

/**
 * POST /api/v1/auth/sync
 * Syncs/bootstraps a Firebase user in D1.
 * Merges anonymous local client data (interests, savedIds, theme, streak) if provided on first login.
 */
authRoutes.post('/sync', async (c) => {
  const user = c.get('user')
  const db = c.env.DB
  const now = Date.now()

  let body = {}
  try {
    body = await c.req.json()
  } catch {
    body = {}
  }

  // Check if user already exists
  const existingUser = await db.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(user.uid).first()

  const incomingRawKey = typeof body.geminiApiKey === 'string' ? body.geminiApiKey.trim() : (typeof body.gemini_api_key === 'string' ? body.gemini_api_key.trim() : '')
  const validApiKey = incomingRawKey.length > 5 ? incomingRawKey : null

  if (!existingUser) {
    // New user in D1
    const theme = body.theme || 'dark'
    const onboarded = body.onboarded ? 1 : 0
    const streak = typeof body.streak === 'number' ? body.streak : 0
    const lastReadDate = body.lastReadDate || ''

    await db.prepare(`
      INSERT INTO users (id, email, display_name, photo_url, streak, last_read_date, theme, onboarded, schema_version, gemini_api_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 2, ?, ?, ?)
    `).bind(
      user.uid,
      user.email,
      user.name || body.displayName || '',
      user.picture || body.photoURL || '',
      streak,
      lastReadDate,
      theme,
      onboarded,
      validApiKey,
      now,
      now
    ).run()

    // Insert any local interests
    if (Array.isArray(body.interests) && body.interests.length > 0) {
      const interestStatements = body.interests.map(interestId =>
        db.prepare(`
          INSERT OR IGNORE INTO user_interests (user_id, interest_id, created_at)
          VALUES (?, ?, ?)
        `).bind(user.uid, String(interestId), now)
      )
      if (interestStatements.length > 0) {
        await db.batch(interestStatements)
      }
    }

    // Insert any local saved topics
    if (Array.isArray(body.savedIds) && body.savedIds.length > 0) {
      const savedStatements = body.savedIds.map(topicId =>
        db.prepare(`
          INSERT OR IGNORE INTO saved_topics (user_id, topic_id, created_at)
          VALUES (?, ?, ?)
        `).bind(user.uid, String(topicId), now)
      )
      if (savedStatements.length > 0) {
        await db.batch(savedStatements)
      }
    }
  } else {
    // Existing user: update name/email/avatar, and update apiKey only if provided non-empty
    const fields = [
      'email = COALESCE(?, email)',
      'display_name = COALESCE(?, display_name)',
      'photo_url = COALESCE(?, photo_url)',
      'updated_at = ?'
    ]
    const values = [
      user.email || null,
      user.name || null,
      user.picture || null,
      now
    ]

    if (validApiKey) {
      fields.push('gemini_api_key = ?')
      values.push(validApiKey)
    }

    values.push(user.uid)
    await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()

    // Merge incoming saved topics or interests if provided
    if (Array.isArray(body.interests) && body.interests.length > 0) {
      const interestStatements = body.interests.map(interestId =>
        db.prepare(`
          INSERT OR IGNORE INTO user_interests (user_id, interest_id, created_at)
          VALUES (?, ?, ?)
        `).bind(user.uid, String(interestId), now)
      )
      await db.batch(interestStatements)
    }

    if (Array.isArray(body.savedIds) && body.savedIds.length > 0) {
      const savedStatements = body.savedIds.map(topicId =>
        db.prepare(`
          INSERT OR IGNORE INTO saved_topics (user_id, topic_id, created_at)
          VALUES (?, ?, ?)
        `).bind(user.uid, String(topicId), now)
      )
      await db.batch(savedStatements)
    }
  }

  // Fetch complete aggregated user state to return to client
  const fullUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.uid).first()
  const { results: interestsResult } = await db.prepare(
    'SELECT interest_id FROM user_interests WHERE user_id = ?'
  ).bind(user.uid).all()
  const { results: savedResult } = await db.prepare(
    'SELECT topic_id FROM saved_topics WHERE user_id = ?'
  ).bind(user.uid).all()

  const userKey = fullUser?.gemini_api_key || validApiKey || ''

  return c.json({
    user: {
      ...fullUser,
      geminiApiKey: userKey,
      onboarded: fullUser?.onboarded === 1,
      interests: (interestsResult || []).map(r => r.interest_id),
      savedIds: (savedResult || []).map(r => r.topic_id)
    }
  })
})
