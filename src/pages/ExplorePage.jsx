import { useState, useEffect, useRef } from 'react'
import { PREFETCHED_TOPICS } from '../data/prefetchedTopics'
import TopicCard from '../components/TopicCard'
import { useAuth } from '../contexts/AuthContext'
import { generateInterestTopics, isAIConfigured } from '../services/aiService'
import { getTopics, saveTopics } from '../services/db'

/**
 * ExplorePage — main discovery feed.
 * Starts with a Gemini-prefetched seed, then refreshes from live Gemini.
 */
export default function ExplorePage({ onOpenTopic }) {
  const { userData } = useAuth()
  const userInterests = userData?.interests || []
  const greeting = getGreeting()
  const interestsKey = userInterests.join('|')

  // Show fallback topics immediately so the page is never blank
  const [topics, setTopics] = useState(() => getFallbackTopics(userInterests, 1))
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [topicError, setTopicError] = useState('')
  const [refreshMessage, setRefreshMessage] = useState('')
  const hasLoadedRef = useRef(false)
  const prevInterestsRef = useRef(interestsKey)

  async function runTopicRefresh({ shouldUpdate = () => true } = {}) {
    setLoadingTopics(true)
    setTopicError('')
    setRefreshMessage('Checking saved topics...')

    const refreshSeed = Date.now()
    let cachedUnexplored = []

    try {
      const dbTopics = await getTopics()
      cachedUnexplored = getUnexploredTopics(
        dbTopics,
        userData?.readHistory,
        userInterests,
        refreshSeed
      )

      if (cachedUnexplored.length > 0 && shouldUpdate()) {
        setTopics(buildRefreshFeed(cachedUnexplored, [], userData?.readHistory, userInterests, refreshSeed))
        setRefreshMessage(`Found ${Math.min(cachedUnexplored.length, 20)} saved unexplored topics...`)
      }
    } catch (err) {
      console.error('Failed to load saved topics for refresh:', err)
    }

    const remainingCount = Math.max(0, 20 - cachedUnexplored.length)

    if (remainingCount === 0) {
      if (shouldUpdate()) {
        setTopics(limitFeedTopics(cachedUnexplored))
        setRefreshMessage('Refreshed from saved unexplored topics.')
        setLoadingTopics(false)
      }
      return
    }

    if (!isAIConfigured()) {
      if (shouldUpdate()) {
        setTopics(buildRefreshFeed(cachedUnexplored, [], userData?.readHistory, userInterests, refreshSeed))
        setRefreshMessage(
          cachedUnexplored.length > 0
            ? 'Showing saved unexplored topics. AI topics are not configured yet.'
            : 'Showing shuffled default topics. AI topics are not configured yet.'
        )
        setLoadingTopics(false)
      }
      return
    }

    setRefreshMessage(
      cachedUnexplored.length > 0
        ? `Using ${Math.min(cachedUnexplored.length, 20)} saved topics. Finding ${remainingCount} more...`
        : 'Starting topic refresh...'
    )

    try {
      const generated = await generateInterestTopics(userInterests, remainingCount, {
        onProgress: (partial) => {
          if (!shouldUpdate()) return
          const normalizedPartial = partial.map((t, i) => normalizeTopic(t, i, refreshSeed))
          setTopics(buildRefreshFeed(cachedUnexplored, normalizedPartial, userData?.readHistory, userInterests, refreshSeed))
          setRefreshMessage(`Found ${partial.length} of ${remainingCount} new topics...`)
        }
      })

      if (generated.length === 0 && cachedUnexplored.length === 0) {
        throw new Error('No topics returned')
      }

      const normalized = generated.map((t, i) => normalizeTopic(t, i, refreshSeed))
      if (shouldUpdate()) {
        setTopics(buildRefreshFeed(cachedUnexplored, normalized, userData?.readHistory, userInterests, refreshSeed))
        setRefreshMessage(
          cachedUnexplored.length > 0
            ? `Refreshed with ${Math.min(cachedUnexplored.length, 20)} saved and ${normalized.length} new topics.`
            : `Refreshed ${normalized.length} topics.`
        )
      }
      await saveTopics(normalized)
    } catch (err) {
      console.error('Failed to refresh topics:', err)
      if (shouldUpdate()) {
        if (cachedUnexplored.length > 0) {
          setTopics(buildRefreshFeed(cachedUnexplored, [], userData?.readHistory, userInterests, refreshSeed))
          setRefreshMessage('Using saved unexplored topics. New topic refresh failed.')
        } else {
          setTopicError('Refresh failed. Try again later.')
          setRefreshMessage('')
        }
      }
    } finally {
      if (shouldUpdate()) setLoadingTopics(false)
    }
  }

  // Load cached topics from IndexedDB on mount (once)
  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true

    let mounted = true

    async function loadFromDB() {
      try {
        const dbTopics = await getTopics()
        if (dbTopics && dbTopics.length > 0 && mounted) {
          const unexplored = getUnexploredTopics(dbTopics, userData?.readHistory, userInterests, Date.now())
          setTopics(limitFeedTopics(unexplored.length > 0 ? unexplored : dbTopics))
        }
      } catch (err) {
        console.error("Failed to load topics from DB:", err)
      }
    }

    loadFromDB()

    return () => { mounted = false }
  }, [])

  // React to interest changes (after the initial load)
  useEffect(() => {
    if (prevInterestsRef.current === interestsKey) return
    prevInterestsRef.current = interestsKey

    // When interests change, generate fresh topics
    let mounted = true

    async function refreshForInterests() {
      await runTopicRefresh({ shouldUpdate: () => mounted })
    }

    refreshForInterests()

    return () => { mounted = false }
  }, [interestsKey])

  // Explicit refresh — only triggered by the user clicking the button
  const refreshTopics = async () => {
    if (loadingTopics) return
    await runTopicRefresh()
  }

  return (
    <div className="page-enter">
      <p className="explore-greeting">
        {loadingTopics ? 'finding rabbit holes for you...' : greeting}
      </p>

      {refreshMessage ? (
        <p className="refresh-status" aria-live="polite">
          {refreshMessage}
        </p>
      ) : null}

      {topicError ? (
        <div className="topic-error-state" role="alert">
          <p>{topicError}</p>
          <button onClick={refreshTopics}>Retry</button>
        </div>
      ) : null}

      <div className="topic-grid" role="list" aria-label="Topics to explore">
        {topics.map((topic, index) => {
          const isWide = topic.wide || index % 5 === 4
          return (
            <div
              key={topic.id}
              role="listitem"
              style={isWide ? { gridColumn: '1 / -1' } : {}}
            >
              <TopicCard
                topic={topic}
                onClick={onOpenTopic}
                wide={isWide}
              />
            </div>
          )
        })}
      </div>

      <button
        className="refresh-link"
        aria-label="Refresh topics"
        onClick={refreshTopics}
        disabled={loadingTopics}
      >
        {loadingTopics ? 'Refreshing...' : 'Refresh topics →'}
      </button>
    </div>
  )
}

/**
 * Returns a time-appropriate greeting string.
 */
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 5) return "it's late. here's something worth staying up for."
  if (hour < 12) return "good morning. here's what's waiting for you."
  if (hour < 17) return "good afternoon. ready to fall down a rabbit hole?"
  if (hour < 21) return "good evening. something new is waiting."
  return "can't sleep? good. here's something worth thinking about."
}

function shuffleTopics(topics, seed) {
  const shuffled = [...topics]
  let state = seed % 2147483647

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    state = (state * 48271) % 2147483647
    const j = state % (i + 1)
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = temp
  }

  return shuffled
}

function getFallbackTopics(interests, seed) {
  const filtered = PREFETCHED_TOPICS.filter(topic =>
    interests.length === 0 ||
    (topic.tags || [topic.category]).some(tag => interests.includes(tag))
  )
  const base = filtered.length > 0 ? filtered : PREFETCHED_TOPICS
  return shuffleTopics(base, seed || 1).slice(0, 20).map((topic, index) => normalizeTopic(topic, index, seed))
}

function limitFeedTopics(topics) {
  return (topics || []).slice(0, 20)
}

function buildRefreshFeed(cachedTopics, generatedTopics, readHistory, interests, seed) {
  const explored = getExploredTopicKeys(readHistory)
  const fallbackTopics = getFallbackTopics(interests, seed)
  const seen = new Set()

  return [...cachedTopics, ...generatedTopics, ...fallbackTopics]
    .filter(topic => {
      const key = getTopicKey(topic)
      if (!key || seen.has(key) || isTopicExplored(topic, explored)) return false
      seen.add(key)
      return true
    })
    .slice(0, 20)
}

function getUnexploredTopics(topics, readHistory, interests, seed) {
  const explored = getExploredTopicKeys(readHistory)
  const seen = new Set()

  return shuffleTopics(topics || [], seed)
    .filter(topic => {
      const key = getTopicKey(topic)
      if (!key || seen.has(key)) return false
      if (!matchesInterests(topic, interests)) return false
      if (isTopicExplored(topic, explored)) return false
      seen.add(key)
      return true
    })
}

function getExploredTopicKeys(readHistory) {
  const ids = new Set()
  const titles = new Set()

  Object.values(readHistory || {}).forEach(session => {
    if (!session || typeof session !== 'object') return
    if (session.topicId) ids.add(String(session.topicId))
    if (session.id) ids.add(String(session.id))
    if (session.title) titles.add(normalizeTitle(session.title))
    if (session.topicSnapshot?.title) titles.add(normalizeTitle(session.topicSnapshot.title))
  })

  return { ids, titles }
}

function isTopicExplored(topic, explored) {
  return explored.ids.has(String(topic?.id || '')) || explored.titles.has(normalizeTitle(topic?.title))
}

function matchesInterests(topic, interests) {
  if (!interests || interests.length === 0) return true
  return (topic?.tags || [topic?.category]).some(tag => interests.includes(tag))
}

function getTopicKey(topic) {
  return topic?.id || normalizeTitle(topic?.title)
}

function normalizeTopic(topic, index, seed) {
  const category = topic.category || topic.tags?.[0] || 'Science'
  const tags = topic.tags?.length ? topic.tags : [category]
  const imageTags = topic.imageTags?.length ? topic.imageTags : tags
  const id = topic.id || slugify(topic.title)

  // Use topic title as the Pexels search query for high-quality images.
  // The useCachedImage hook resolves this into an actual Pexels URL.
  const imageQuery = topic.imageQuery || topic.title || imageTags.join(' ')

  return {
    id,
    title: topic.title,
    description: topic.description || topic.hook || '',
    category,
    tags,
    imageTags,
    imageQuery,
    imageUrl: topic.imageUrl || null,
    introBody: topic.introBody || '',
    introPrompts: topic.introPrompts || [],
    content: [],
    isAI: !topic.id || topic.isAI === true
  }
}

function slugify(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'rabbit-hole'
}

function normalizeTitle(title = '') {
  return String(title).trim().toLowerCase()
}
