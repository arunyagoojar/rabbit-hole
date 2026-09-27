import { apiClient } from './apiClient'

/**
 * analyticsService.js
 * Lightweight privacy-first tracking for topic engagement & learning patterns
 */
class AnalyticsService {
  constructor() {
    this.sessionStartTime = null
    this.activeTopicId = null
    this.activeMode = null
  }

  startTopicSession(topicId, consumeMode) {
    this.sessionStartTime = Date.now()
    this.activeTopicId = topicId
    this.activeMode = consumeMode

    this.track('topic_opened', {
      topicId,
      consumeMode
    })
  }

  endTopicSession() {
    if (this.sessionStartTime && this.activeTopicId) {
      const durationSeconds = Math.round((Date.now() - this.sessionStartTime) / 1000)
      if (durationSeconds > 2) {
        this.track('topic_session_ended', {
          topicId: this.activeTopicId,
          consumeMode: this.activeMode,
          durationSeconds
        })
      }
    }
    this.sessionStartTime = null
    this.activeTopicId = null
    this.activeMode = null
  }

  track(eventName, { topicId, consumeMode, durationSeconds = 0, metadata = {} } = {}) {
    try {
      fetch('/api/v1/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName,
          topicId: topicId || this.activeTopicId,
          consumeMode: consumeMode || this.activeMode,
          durationSeconds,
          metadata
        }),
        keepalive: true
      }).catch(() => {})
    } catch {}
  }
}

export const analytics = new AnalyticsService()
