import { Hono } from 'hono'
import { optionalAuth, requireAuth } from '../middleware/auth'

export const analyticsRoutes = new Hono()

/**
 * POST /api/v1/analytics/track
 * Ingest privacy-first application & topic events
 */
analyticsRoutes.post('/track', optionalAuth(), async (c) => {
  const db = c.env.DB
  if (!db) {
    return c.json({ error: 'Database binding missing' }, 500)
  }

  const user = c.get('user')
  const {
    eventName,
    topicId,
    consumeMode,
    metadata = {},
    durationSeconds = 0
  } = await c.req.json()

  if (!eventName) {
    return c.json({ error: 'eventName is required' }, 400)
  }

  const id = crypto.randomUUID()
  const now = Date.now()
  const metaString = typeof metadata === 'string' ? metadata : JSON.stringify(metadata)

  await db.prepare(`
    INSERT INTO analytics_events (
      id, event_name, user_id, topic_id, consume_mode, metadata, duration_seconds, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    eventName,
    user?.uid || null,
    topicId || null,
    consumeMode || null,
    metaString,
    Number(durationSeconds) || 0,
    now
  ).run().catch(console.error)

  return c.json({ success: true, id })
})

/**
 * GET /api/v1/analytics/summary
 * Admin-protected aggregate analytics dashboard metrics
 */
analyticsRoutes.get('/summary', optionalAuth(), async (c) => {
  const db = c.env.DB
  const adminKey = c.req.header('x-admin-key')
  const user = c.get('user')

  // Simple admin gate: matches configured secret OR email
  const configuredAdminKey = c.env.ADMIN_KEY || 'rabbithole_admin_secret_2026'
  const isAuthorized = (adminKey && adminKey === configuredAdminKey) || (user?.email && user.email.includes('admin'))

  if (!isAuthorized) {
    return c.json({ error: 'Unauthorized admin access' }, 403)
  }

  // 1. Total counts by event name
  const { results: eventCounts } = await db.prepare(`
    SELECT event_name, count(*) as count 
    FROM analytics_events 
    GROUP BY event_name 
    ORDER BY count DESC
  `).all().catch(() => ({ results: [] }))

  // 2. Consume mode breakdown (reading vs audio)
  const { results: modeBreakdown } = await db.prepare(`
    SELECT consume_mode, count(*) as count 
    FROM analytics_events 
    WHERE consume_mode IS NOT NULL 
    GROUP BY consume_mode
  `).all().catch(() => ({ results: [] }))

  // 3. Top opened topics
  const { results: topTopics } = await db.prepare(`
    SELECT topic_id, count(*) as opens, avg(duration_seconds) as avg_duration
    FROM analytics_events 
    WHERE event_name = 'topic_opened' AND topic_id IS NOT NULL
    GROUP BY topic_id 
    ORDER BY opens DESC 
    LIMIT 10
  `).all().catch(() => ({ results: [] }))

  // 4. Recent activity log
  const { results: recentEvents } = await db.prepare(`
    SELECT id, event_name, topic_id, consume_mode, duration_seconds, created_at
    FROM analytics_events 
    ORDER BY created_at DESC 
    LIMIT 50
  `).all().catch(() => ({ results: [] }))

  return c.json({
    summary: {
      eventCounts: eventCounts || [],
      modeBreakdown: modeBreakdown || [],
      topTopics: topTopics || [],
      recentEvents: recentEvents || []
    }
  })
})
