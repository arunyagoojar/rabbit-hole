import { useState, useMemo } from 'react'
import { BookOpen, Bookmark } from 'lucide-react'
import { useCachedImage } from '../hooks/useCachedImage'
import { TOPIC_GRADIENTS } from '../data/gradients'
import { useAuth } from '../contexts/AuthContext'
import { TOPICS } from '../data/topics'
import TopicCard from '../components/TopicCard'
import {
  formatRelativeDate,
  groupSessionsByTopic,
  normalizeHistory,
  TOPIC_BY_ID
} from '../utils/readingHistory'

/**
 * SavedPage — holds both bookmarked topics and explored reading history
 */
export default function SavedPage({ onOpenTopic }) {
  const { userData } = useAuth()
  const [activeSubTab, setActiveSubTab] = useState('saved') // 'saved' | 'history'

  const historyList = useMemo(() => {
    return normalizeHistory(userData?.readHistory || {})
      .sort((a, b) => b.lastUpdated - a.lastUpdated)
  }, [userData?.readHistory])

  const readGroups = useMemo(() => groupSessionsByTopic(historyList), [historyList])

  const savedTopics = useMemo(() => {
    const savedIds = new Set(userData?.savedIds || [])
    if (savedIds.size === 0) return []

    const result = []
    const addedIds = new Set()

    for (const t of TOPICS) {
      if (savedIds.has(t.id)) {
        result.push(t)
        addedIds.add(t.id)
      }
    }

    for (const s of Object.values(userData?.readHistory || {})) {
      if (savedIds.has(s.topicId) && !addedIds.has(s.topicId) && s.topicSnapshot) {
        result.push({
          ...s.topicSnapshot,
          id: s.topicId,
          content: s.cards || []
        })
        addedIds.add(s.topicId)
      }
    }

    return result
  }, [userData?.savedIds, userData?.readHistory])

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <p className="explore-greeting" style={{ margin: 0 }}>your collection.</p>
        <div className="saved-subtabs" role="tablist" aria-label="Collection views">
          <button
            role="tab"
            aria-selected={activeSubTab === 'saved'}
            className={`saved-tab-btn ${activeSubTab === 'saved' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('saved')}
          >
            <Bookmark size={14} />
            <span>Saved ({savedTopics.length})</span>
          </button>
          <button
            role="tab"
            aria-selected={activeSubTab === 'history'}
            className={`saved-tab-btn ${activeSubTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('history')}
          >
            <BookOpen size={14} />
            <span>History ({readGroups.length})</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'saved' ? (
        savedTopics.length === 0 ? (
          <div className="empty-state page-enter">
            <Bookmark size={54} strokeWidth={1.2} aria-hidden="true" style={{ opacity: 0.4 }} />
            <p>No saved topics yet.<br />Tap the bookmark icon on any topic card to save it here.</p>
          </div>
        ) : (
          <div className="topic-grid">
            {savedTopics.map(topic => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onClick={onOpenTopic}
              />
            ))}
          </div>
        )
      ) : (
        readGroups.length === 0 ? (
          <div className="empty-state page-enter">
            <BookOpen size={54} strokeWidth={1.2} aria-hidden="true" style={{ opacity: 0.4 }} />
            <p>No reads yet.<br />Start a rabbit hole and it will live here.</p>
          </div>
        ) : (
          <div className="my-reads-list" role="list" aria-label="Previously explored rabbit holes">
            {readGroups.map(group => (
              <ReadMemory
                key={group.topicId}
                group={group}
                onOpenTopic={onOpenTopic}
              />
            ))}
          </div>
        )
      )}
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
