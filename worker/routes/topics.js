import { Hono } from 'hono'
import { optionalAuth, requireAuth } from '../middleware/auth'

export const topicsRoutes = new Hono()

/**
 * GET /api/v1/topics
 * Fetch saved or custom explore topics from D1
 */
topicsRoutes.get('/', optionalAuth(), async (c) => {
  const db = c.env.DB
  const category = c.req.query('category')

  let query = 'SELECT * FROM topics'
  const params = []

  if (category) {
    query += ' WHERE category = ?'
    params.push(category)
  }

  query += ' ORDER BY created_at DESC LIMIT 100'

  const { results } = await db.prepare(query).bind(...params).all()

  const topics = (results || []).map(row => {
    let content = []
    try {
      if (row.content_data) content = JSON.parse(row.content_data)
    } catch {}

    return {
      id: row.id,
      title: row.title,
      category: row.category,
      blurb: row.blurb,
      readingTime: row.reading_time,
      coverImage: row.cover_image,
      content,
      isSystem: row.is_system === 1,
      createdBy: row.created_by,
      createdAt: row.created_at
    }
  })

  return c.json({ topics })
})

/**
 * POST /api/v1/topics
 * Save newly generated topics into D1
 */
topicsRoutes.post('/', optionalAuth(), async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const now = Date.now()
  const { topics } = await c.req.json()

  if (!Array.isArray(topics) || topics.length === 0) {
    return c.json({ error: 'topics must be a non-empty array' }, 400)
  }

  const statements = topics.map(topic => {
    return db.prepare(`
      INSERT OR REPLACE INTO topics (
        id, title, category, blurb, reading_time, cover_image, content_data, is_system, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      String(topic.id),
      String(topic.title || ''),
      String(topic.category || topic.tags?.[0] || 'General'),
      String(topic.blurb || topic.description || ''),
      String(topic.readingTime || '3 min'),
      String(topic.coverImage || ''),
      JSON.stringify(topic.content || []),
      topic.isSystem ? 1 : 0,
      user?.uid || null,
      topic.createdAt || now
    )
  })

  await db.batch(statements)

  return c.json({ success: true, count: topics.length })
})
