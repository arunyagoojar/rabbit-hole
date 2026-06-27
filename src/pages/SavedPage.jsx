import { BookOpen } from 'lucide-react'
import { useCachedImage } from '../hooks/useCachedImage'
import { TOPIC_GRADIENTS } from '../data/gradients'
import { useAuth } from '../contexts/AuthContext'
import {
  formatRelativeDate,
  groupSessionsByTopic,
  normalizeHistory,
  TOPIC_BY_ID
} from '../utils/readingHistory'

/**
 * SavedPage now behaves as My Reads: a history-first shelf of explored rabbit holes.
 */
export default function SavedPage({ onOpenTopic }) {
  const { userData } = useAuth()
  const historyList = normalizeHistory(userData?.readHistory || {})
    .sort((a, b) => b.lastUpdated - a.lastUpdated)
  const readGroups = groupSessionsByTopic(historyList)

  if (readGroups.length === 0) {
    return (
      <div className="empty-state page-enter">
        <BookOpen size={64} strokeWidth={1.2} aria-hidden="true" />
        <p>No reads yet.<br />Start a rabbit hole and it will live here.</p>
      </div>
    )
  }

  return (
    <div className="page-enter">
      <p className="explore-greeting">your reads.</p>
      <div className="my-reads-list" role="list" aria-label="Previously explored rabbit holes">
        {readGroups.map(group => (
          <ReadMemory
            key={group.topicId}
            group={group}
            onOpenTopic={onOpenTopic}
          />
        ))}
      </div>
    </div>
  )
}

function ReadMemory({ group, onOpenTopic }) {
  const latestSession = group.sessions[0]
  const snapshotTopic = latestSession?.topicSnapshot
    ? {
        ...latestSession.topicSnapshot,
        content: latestSession.cards || [],
        selectedPrompt: latestSession.selectedPrompt
      }
    : null
  const topic = TOPIC_BY_ID.get(group.topicId) || snapshotTopic
  const gradient = TOPIC_GRADIENTS[group.category] || 'linear-gradient(135deg, #1a1a1a, #333)'

  const cachedImage = useCachedImage(topic?.imageUrl, topic?.imageQuery || topic?.id)

  const openTopic = () => {
    if (topic && onOpenTopic) {
      onOpenTopic(topic)
    }
  }

  return (
    <article className="read-memory" role="listitem">
      <button
        className="read-memory-image"
        style={{
          backgroundImage: cachedImage ? `${gradient}, url(${cachedImage})` : gradient
        }}
        onClick={openTopic}
        disabled={!topic}
        aria-label={`Reopen ${group.title}`}
      />

      <div className="read-memory-body">
        <div>
          <p className="read-memory-kicker">{group.category} · {formatRelativeDate(group.lastDate)}</p>
          <h2 className="read-memory-title">{group.title}</h2>
        </div>

        <div className="read-memory-progress" aria-label={`${group.completionPct}% explored`}>
          <div
            className="read-memory-progress-fill"
            style={{ width: `${group.completionPct}%` }}
          />
        </div>

        <div className="read-memory-meta">
          <span>{group.sessions.length} {group.sessions.length === 1 ? 'session' : 'sessions'}</span>
          <span>{group.totalCardsRead} cards read</span>
          <span>best dive {group.bestDive}/{group.totalCards || latestSession?.totalCards || 0}</span>
        </div>

        <button className="read-memory-action" onClick={openTopic} disabled={!topic}>
          {topic ? 'Explore again' : 'Unavailable'}
        </button>
      </div>
    </article>
  )
}
