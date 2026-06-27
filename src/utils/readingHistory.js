import { TOPICS } from '../data/topics'

export const TOPIC_BY_ID = new Map(TOPICS.map(topic => [topic.id, topic]))
export const DAY_MS = 24 * 60 * 60 * 1000

export function normalizeHistory(readHistory) {
  return Object.entries(readHistory || {})
    .map(([key, item]) => {
      if (!item || typeof item !== 'object') return null

      const possibleTopicId = item.topicId || (TOPIC_BY_ID.has(item.id) ? item.id : key)
      const topic = TOPIC_BY_ID.get(possibleTopicId)
      const lastUpdated = normalizeTimestamp(item.lastUpdated)
      const date = item.date || getDateKey(new Date(lastUpdated || Date.now()))

      return {
        ...item,
        id: item.id || key,
        topicId: possibleTopicId,
        title: item.title || topic?.title || 'Untitled rabbit hole',
        category: item.category || topic?.category || topic?.tags?.[0] || 'Uncategorized',
        cardsRead: Number(item.cardsRead || 0),
        totalCards: Number(item.totalCards || topic?.content?.length || 0),
        date,
        lastUpdated
      }
    })
    .filter(Boolean)
}

export function normalizeTimestamp(value) {
  if (typeof value === 'number') {
    return value < 1000000000000 ? value * 1000 : value
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? Date.now() : parsed
  }

  return Date.now()
}

export function getDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatRelativeDate(dateKey) {
  const today = getDateKey(new Date())
  const yesterday = getDateKey(new Date(Date.now() - DAY_MS))

  if (dateKey === today) return 'Today'
  if (dateKey === yesterday) return 'Yesterday'

  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

export function groupSessionsByTopic(historyList) {
  const groups = new Map()

  historyList.forEach(session => {
    const existing = groups.get(session.topicId) || {
      topicId: session.topicId,
      title: session.title,
      category: session.category,
      sessions: [],
      totalCardsRead: 0,
      totalCards: session.totalCards,
      lastUpdated: 0,
      lastDate: session.date
    }

    existing.sessions.push(session)
    existing.totalCardsRead += session.cardsRead || 0
    existing.totalCards = Math.max(existing.totalCards || 0, session.totalCards || 0)

    if ((session.lastUpdated || 0) > existing.lastUpdated) {
      existing.lastUpdated = session.lastUpdated
      existing.lastDate = session.date
      existing.title = session.title
      existing.category = session.category
    }

    groups.set(session.topicId, existing)
  })

  return Array.from(groups.values())
    .map(group => {
      const sessions = group.sessions.sort((a, b) => b.lastUpdated - a.lastUpdated)
      const bestDive = Math.max(...sessions.map(session => session.cardsRead || 0), 0)

      return {
        ...group,
        sessions,
        bestDive,
        completionPct: group.totalCards
          ? Math.min(100, Math.round((bestDive / group.totalCards) * 100))
          : 0
      }
    })
    .sort((a, b) => b.lastUpdated - a.lastUpdated)
}
