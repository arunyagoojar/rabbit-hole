import { useState, useEffect, useMemo } from 'react'
import { 
  Compass, 
  Sparkles, 
  ArrowRight, 
  Clock, 
  Zap, 
  Shuffle, 
  Layers, 
  Bookmark,
  RefreshCw
} from 'lucide-react'
import TopicCard from '../components/TopicCard'
import { useAuth } from '../contexts/AuthContext'
import { TOPICS } from '../data/topics'
import { getCuratedHomepageSections } from '../services/recommendationService'
import { getTopics } from '../services/db'

/**
 * ExplorePage — Curated Magazine Discovery Experience
 * 
 * Rules:
 * 1. "For you": MAXIMUM 5 topic cards + 6th "Explore more" tile.
 * 2. "Top Interests": Non-duplicate topics matching user's selected interests.
 * 3. "Recently Explored": History sessions with progress tracking.
 * 4. "Topics You Haven't Explored": Curated adjacent unexplored topics.
 * 5. "Cross-Category": Intersections spanning multiple domains (e.g., CS + Physics).
 * 6. "Surprise": EXACTLY ONE card outside user's usual orbit.
 * Strictly no infinite scrolling.
 */
export default function ExplorePage({ 
  onOpenTopic, 
  onNavigateExploreMore 
}) {
  const { user, userData } = useAuth()
  const userInterests = userData?.interests || []
  const readHistory = userData?.readHistory || {}
  const savedIds = userData?.savedIds || []

  const [dbTopics, setDbTopics] = useState(TOPICS)

  // Load latest topic database from local storage / D1
  useEffect(() => {
    getTopics()
      .then(saved => {
        if (Array.isArray(saved) && saved.length > 0) {
          // Strictly reject malformed cards from storage
          const validSaved = saved.filter(t => t && t.id && typeof t.title === 'string' && t.title.trim())
          if (validSaved.length > 0) {
            setDbTopics(validSaved)
          }
        }
      })
      .catch(console.error)
  }, [])

  // Calculate curated sections via recommendation engine
  const sections = useMemo(() => {
    return getCuratedHomepageSections({
      allTopics: dbTopics,
      userInterests,
      readHistory,
      savedIds
    })
  }, [dbTopics, userInterests, readHistory, savedIds])

  const greeting = getDeterministicGreeting(user, userData)

  return (
    <div className="curated-explore-container">
      {/* ─── Hero Magazine Header ─── */}
      <header className="curated-hero-header">
        <div className="curated-kicker-row">
          <span className="curated-kicker">CURATED EDITION</span>
          <span className="curated-kicker-dot">•</span>
          <span className="curated-kicker-date">
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <h1 className="curated-greeting-title">
          {greeting}
        </h1>
        <p className="curated-greeting-desc">
          Today's selected rabbit holes. Deliberately chosen to deepen your curiosity without algorithmic noise.
        </p>
      </header>

      {/* ─── SECTION 1: "For you" (EXACTLY 5 CARDS + 6th "Explore More" TILE) ─── */}
      <section className="curated-section for-you-section" aria-label="For You">
        <div className="section-title-bar">
          <div className="section-heading-group">
            <h2 className="section-title">For you</h2>
            <p className="section-subtitle">Your primary personalized curation (5 topics)</p>
          </div>
        </div>

        <div className="curated-grid for-you-grid">
          {/* Strictly maximum 5 cards */}
          {sections.forYouTopics.slice(0, 5).map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              onClick={onOpenTopic}
            />
          ))}

          {/* 6th Card: "Explore more" — Dedicated Navigation Tile */}
          <article
            className="explore-more-tile"
            onClick={onNavigateExploreMore}
            role="button"
            tabIndex={0}
            aria-label="Explore more curated topics"
            onKeyDown={(e) => (e.key === 'Enter' ? onNavigateExploreMore() : null)}
          >
            <div className="explore-tile-graphic">
              <div className="explore-tile-radar" aria-hidden="true">
                <div className="radar-circle c1" />
                <div className="radar-circle c2" />
                <Compass size={28} className="radar-compass-icon" />
              </div>
            </div>

            <div className="explore-tile-content">
              <span className="explore-tile-tag">CURATED ARCHIVE</span>
              <h3 className="explore-tile-title">Explore more</h3>
              <p className="explore-tile-desc">
                Browse our finite collection of 15–20 hand-picked topics.
              </p>
              <div className="explore-tile-cta">
                <span>View collection</span>
                <ArrowRight size={15} />
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ─── SECTION 2: Top Interests (Zero duplicate with For You) ─── */}
      {sections.topInterestsTopics && sections.topInterestsTopics.length > 0 && (
        <section className="curated-section" aria-label="Top Interests">
          <div className="section-title-bar">
            <div className="section-heading-group">
              <div className="section-tag-row">
                <Zap size={14} className="accent-icon" />
                <span className="section-tag-text">YOUR PASSIONS</span>
              </div>
              <h2 className="section-title">Top Interests</h2>
              <p className="section-subtitle">
                Topics deeply aligned with {userInterests.slice(0, 3).join(', ') || 'your chosen subjects'}
              </p>
            </div>
          </div>

          <div className="curated-grid">
            {sections.topInterestsTopics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onClick={onOpenTopic}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── SECTION 3: Recently Explored (Dynamic reading & audio history) ─── */}
      {sections.recentlyExploredTopics && sections.recentlyExploredTopics.length > 0 && (
        <section className="curated-section" aria-label="Recently Explored">
          <div className="section-title-bar">
            <div className="section-heading-group">
              <div className="section-tag-row">
                <Clock size={14} className="accent-icon" />
                <span className="section-tag-text">READING HISTORY</span>
              </div>
              <h2 className="section-title">Recently Explored</h2>
              <p className="section-subtitle">Pick up where your curiosity left off</p>
            </div>
          </div>

          <div className="curated-grid">
            {sections.recentlyExploredTopics.map((topic) => (
              <div key={topic.id} className="history-card-wrapper">
                <TopicCard
                  topic={topic}
                  onClick={onOpenTopic}
                />
                {topic.resumeSession && (
                  <div className="history-resume-banner">
                    <span>In progress • {topic.resumeSession.cardsRead || 1} cards read</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── SECTION 4: Topics You Haven't Explored ─── */}
      {sections.unexploredTopics && sections.unexploredTopics.length > 0 && (
        <section className="curated-section" aria-label="Topics You Haven't Explored">
          <div className="section-title-bar">
            <div className="section-heading-group">
              <div className="section-tag-row">
                <Sparkles size={14} className="accent-icon" />
                <span className="section-tag-text">UNTOUCHED QUESTIONS</span>
              </div>
              <h2 className="section-title">Topics You Haven't Explored</h2>
              <p className="section-subtitle">Fresh territories adjacent to your interests</p>
            </div>
          </div>

          <div className="curated-grid">
            {sections.unexploredTopics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onClick={onOpenTopic}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── SECTION 5: Cross-Category Intersections ─── */}
      {sections.crossCategoryTopics && sections.crossCategoryTopics.length > 0 && (
        <section className="curated-section" aria-label="Cross-Category Discoveries">
          <div className="section-title-bar">
            <div className="section-heading-group">
              <div className="section-tag-row">
                <Layers size={14} className="accent-icon" />
                <span className="section-tag-text">INTERSECTIONS</span>
              </div>
              <h2 className="section-title">Cross-Category</h2>
              <p className="section-subtitle">
                Where two distinct disciplines collide to reveal unexpected truths
              </p>
            </div>
          </div>

          <div className="curated-grid">
            {sections.crossCategoryTopics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onClick={onOpenTopic}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── SECTION 6: Surprise Slot (EXACTLY ONE CARD) ─── */}
      {sections.surpriseTopic && (
        <section className="curated-section surprise-section" aria-label="Curated Surprise">
          <div className="section-title-bar">
            <div className="section-heading-group">
              <div className="section-tag-row">
                <Shuffle size={14} className="accent-icon surprise-icon" />
                <span className="section-tag-text">CONTROLLED SURPRISE</span>
              </div>
              <h2 className="section-title">Something outside your usual orbit</h2>
              <p className="section-subtitle">
                Intentionally selected to spark a new perspective outside your routine
              </p>
            </div>
          </div>

          <div className="surprise-card-container">
            <TopicCard
              topic={sections.surpriseTopic}
              onClick={onOpenTopic}
              wide={true}
            />
          </div>
        </section>
      )}

      {/* ─── Curated Bottom Note ─── */}
      <footer className="curated-magazine-footer">
        <div className="magazine-footer-line" />
        <p className="magazine-footer-text">
          Rabbit Hole Curated Digest • Distraction-free learning
        </p>
      </footer>
    </div>
  )
}

function getDeterministicGreeting(user, userData) {
  const hour = new Date().getHours()
  let timeOfDay = 'Good evening'
  if (hour >= 5 && hour < 12) {
    timeOfDay = 'Good morning'
  } else if (hour >= 12 && hour < 17) {
    timeOfDay = 'Good afternoon'
  } else {
    // 17:00 through 04:59 is always "Good evening" (strict Rabbit Hole identity rule: NO "Good night" state)
    timeOfDay = 'Good evening'
  }

  const rawName = user?.displayName || userData?.displayName || userData?.name
  let name = 'Guest'
  if (rawName && typeof rawName === 'string' && rawName.trim()) {
    name = rawName.trim().split(' ')[0]
  } else if (user?.email) {
    const prefix = user.email.split('@')[0]
    name = prefix.charAt(0).toUpperCase() + prefix.slice(1)
  }

  return `${timeOfDay}, ${name}`
}
