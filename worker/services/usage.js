/**
 * usage.js — Backend User Usage & Quota Tracking Architecture
 * 
 * Tracks:
 * - AI Starter requests
 * - Rabbit Hole Branch inquiries
 * - TTS narration characters
 * Supports authenticated users and guest quotas without exposing API credentials.
 */

export async function recordUsage(db, user, requestType, units = 1) {
  if (!db) return
  const userId = user?.uid || user?.id || 'anonymous_guest'
  const id = `usage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  try {
    await db.prepare(`
      INSERT INTO user_usage (id, user_id, request_type, units, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, userId, requestType, units, Date.now()).run()
  } catch (err) {
    // Non-blocking for high availability
    console.warn('Usage tracking notice:', err?.message)
  }
}
