import { TOPICS } from '../data/topics.js'

/**
 * recommendationService.js
 * Intelligent, curated recommendation engine for Rabbit Hole.
 * 
 * Rules:
 * - "For You": exactly 5 topics max.
 * - "Top Interests": matched to user's selected interests, zero overlap with "For You".
 * - "Recently Explored": tracks history from reading sessions.
 * - "Unexplored": unexplored topics relevant or adjacent to interests.
 * - "Cross-Category": topics bridging 2 or more distinct interest domains.
 * - "Surprise": exactly 1 topic outside the user's orbit.
 * - "Explore More": finite list (15-20 topics).
 */

export function getCuratedHomepageSections({
  allTopics = TOPICS,
  userInterests = [],
  readHistory = {},
  savedIds = []
} = {}) {
  // Validate and clean all incoming topics: strictly reject malformed items
  const rawPool = Array.isArray(allTopics) && allTopics.length > 0 ? allTopics : TOPICS
  const topics = rawPool.filter(t => t && t.id && typeof t.title === 'string' && t.title.trim().length > 0)
  const defaultSeeds = TOPICS.filter(t => t && t.id && typeof t.title === 'string' && t.title.trim().length > 0)

  const exploredIds = new Set()
  const exploredTitles = new Set()

  // 1. Gather explored topic IDs & titles
  Object.values(readHistory || {}).forEach(session => {
    if (!session) return
    if (session.topicId) exploredIds.add(String(session.topicId))
    if (session.id) exploredIds.add(String(session.id))
    if (session.title) exploredTitles.add(normalizeTitle(session.title))
    if (session.topicSnapshot?.title) exploredTitles.add(normalizeTitle(session.topicSnapshot.title))
  })

  const isExplored = (topic) => {
    return exploredIds.has(String(topic?.id)) || exploredTitles.has(normalizeTitle(topic?.title))
  }

  // Global uniqueness set across the entire homepage
  const shownIds = new Set()

  // ─── 1. "For You" Section (EXACTLY 5 TOPICS) ───
  // Scored by user interest match, tag diversity, and editorial weight
  const forYouScored = topics
    .filter(t => !isExplored(t))
    .map(t => {
      let score = 0
      const topicTags = t.tags || [t.category]
      
      // Interest match score
      userInterests.forEach(interest => {
        if (topicTags.includes(interest)) score += 4
      })
      if (userInterests.includes(t.category)) score += 5

      // Quality seed variation
      score += (t.id.length % 5) * 0.5
      return { topic: t, score }
    })
    .sort((a, b) => b.score - a.score)

  const forYouTopics = forYouScored.slice(0, 5).map(item => item.topic)
  forYouTopics.forEach(t => shownIds.add(t.id))

  // Cold-start fallback: If new user or forYou is less than 5, backfill from unexplored or default seeds
  if (forYouTopics.length < 5) {
    for (const t of topics) {
      if (forYouTopics.length >= 5) break
      if (!shownIds.has(t.id) && !isExplored(t)) {
        forYouTopics.push(t)
        shownIds.add(t.id)
      }
    }
  }
  // Ultimate safety: never leave For You empty
  if (forYouTopics.length < 5) {
    for (const seed of defaultSeeds) {
      if (forYouTopics.length >= 5) break
      if (!shownIds.has(seed.id)) {
        forYouTopics.push(seed)
        shownIds.add(seed.id)
      }
    }
  }

  // ─── 2. "Top Interests" Section ───
  // Topics from user's strongest interests, strictly excluding topics already shown.
  // For guests, use curated broad seed interests.
  const topInterestsTopics = []
  const effectiveInterests = userInterests.length > 0
    ? userInterests
    : ['Physics', 'Space & Cosmos', 'Neuroscience', 'Philosophy', 'Engineering']

  const interestPool = topics.filter(t => {
    if (shownIds.has(t.id)) return false
    const tags = t.tags || [t.category]
    return tags.some(tag => effectiveInterests.includes(tag))
  })

  for (const interest of effectiveInterests) {
    if (topInterestsTopics.length >= 4) break
    const match = interestPool.find(t => 
      !shownIds.has(t.id) && (t.category === interest || (t.tags && t.tags.includes(interest)))
    )
    if (match) {
      topInterestsTopics.push(match)
      shownIds.add(match.id)
    }
  }

  // ─── 3. "Recently Explored" Section ───
  // Real sessions from user's reading/listening history, non-duplicated
  const recentlyExploredTopics = []
  const sortedSessions = Object.values(readHistory || {})
    .filter(s => s && (s.topicId || s.id))
    .sort((a, b) => (b.lastUpdated || b.createdAt || 0) - (a.lastUpdated || a.createdAt || 0))

  for (const session of sortedSessions) {
    if (recentlyExploredTopics.length >= 3) break
    const match = topics.find(t => (t.id === session.topicId || t.id === session.id) && !shownIds.has(t.id))
    if (match) {
      recentlyExploredTopics.push({
        ...match,
        resumeSession: session
      })
      shownIds.add(match.id)
    }
  }

  // ─── 4. "Topics You Haven't Explored" Section ───
  // Unexplored topics strictly unique to this section
  const unexploredTopics = []
  for (const t of topics) {
    if (unexploredTopics.length >= 4) break
    if (!shownIds.has(t.id) && !isExplored(t)) {
      unexploredTopics.push(t)
      shownIds.add(t.id)
    }
  }

  // ─── 5. "Cross-Category" Intersections ───
  // Topics bridging 2 or more distinct disciplines (e.g. Technology + Neuroscience)
  const crossCategoryTopics = []
  const multiTagTopics = topics.filter(t => !shownIds.has(t.id) && t.tags && t.tags.length >= 2)
  
  for (const t of multiTagTopics) {
    if (crossCategoryTopics.length >= 4) break
    const hasTech = t.tags.some(tag => ['Technology', 'Computer Science', 'Engineering', 'Mathematics'].includes(tag))
    const hasHumanities = t.tags.some(tag => ['History', 'Philosophy', 'Art & Culture', 'Psychology', 'Linguistics'].includes(tag))
    const hasNature = t.tags.some(tag => ['Physics', 'Space & Cosmos', 'Biology', 'Neuroscience'].includes(tag))

    if ((hasTech && hasHumanities) || (hasTech && hasNature) || (hasHumanities && hasNature) || t.tags.length >= 3) {
      crossCategoryTopics.push(t)
      shownIds.add(t.id)
    }
  }

  // Backfill cross-category if still under 3 from unused diverse topics
  if (crossCategoryTopics.length < 3) {
    for (const t of topics) {
      if (crossCategoryTopics.length >= 3) break
      if (!shownIds.has(t.id)) {
        crossCategoryTopics.push(t)
        shownIds.add(t.id)
      }
    }
  }

  // ─── 6. "Surprise" Slot (EXACTLY ONE TOPIC) ───
  // A deliberately selected topic outside the user's normal orbit
  let surpriseTopic = null
  const outsidePool = topics.filter(t => {
    if (shownIds.has(t.id)) return false
    const tags = t.tags || [t.category]
    return !tags.some(tag => effectiveInterests.includes(tag))
  })

  if (outsidePool.length > 0) {
    const surpriseIndex = (Date.now() + 7) % outsidePool.length
    surpriseTopic = outsidePool[surpriseIndex]
    shownIds.add(surpriseTopic.id)
  } else {
    const leftover = topics.find(t => !shownIds.has(t.id))
    if (leftover) {
      surpriseTopic = leftover
      shownIds.add(leftover.id)
    } else if (defaultSeeds.length > 0) {
      surpriseTopic = defaultSeeds[defaultSeeds.length - 1]
    }
  }

  // ─── Filter sections for meaningful content thresholds ───
  const validRecentlyExplored = recentlyExploredTopics.length >= 1 ? recentlyExploredTopics : []
  const validTopInterests = topInterestsTopics.length >= 2 ? topInterestsTopics : []
  const validUnexplored = unexploredTopics.length >= 2 ? unexploredTopics : []
  const validCrossCategory = crossCategoryTopics.length >= 2 ? crossCategoryTopics : []

  // ─── 7. "Explore More" Collection (Finite 15-20 Topics) ───
  const exploreMorePool = topics
    .filter(t => !shownIds.has(t.id) && !isExplored(t))
    .slice(0, 18)

  return {
    forYouTopics,
    topInterestsTopics: validTopInterests,
    recentlyExploredTopics: validRecentlyExplored,
    unexploredTopics: validUnexplored,
    crossCategoryTopics: validCrossCategory,
    surpriseTopic,
    exploreMorePool
  }
}

function normalizeTitle(title = '') {
  return String(title).trim().toLowerCase()
}
