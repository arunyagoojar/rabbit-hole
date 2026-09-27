import { useState, useMemo } from 'react'
import { ChevronLeft, Compass, Sparkles, Filter } from 'lucide-react'
import TopicCard from '../components/TopicCard'
import { TOPICS } from '../data/topics'

/**
 * ExploreMorePage
 * Dedicated finite discovery subpage showing 15-20 curated topics.
 * Strictly no infinite scroll. Clean, magazine-style layout.
 */
export default function ExploreMorePage({ 
  topics = [], 
  onBack, 
  onOpenTopic 
}) {
  const [activeCategory, setActiveCategory] = useState('All')

  // Finite curated selection of 16-18 topics
  const finitePool = useMemo(() => {
    const list = Array.isArray(topics) && topics.length > 0 ? topics : TOPICS.slice(10, 28)
    return list.slice(0, 18)
  }, [topics])

  // Extract distinct categories present in this pool
  const categories = useMemo(() => {
    const set = new Set(['All'])
    finitePool.forEach(t => {
      const cat = t.category || t.tags?.[0]
      if (cat) set.add(cat)
    })
    return Array.from(set)
  }, [finitePool])

  const filteredTopics = useMemo(() => {
    if (activeCategory === 'All') return finitePool
    return finitePool.filter(t => 
      t.category === activeCategory || (t.tags && t.tags.includes(activeCategory))
    )
  }, [activeCategory, finitePool])

  return (
    <div className="explore-more-page">
      {/* Top Header Bar */}
      <header className="explore-more-header">
        <button 
          className="explore-more-back-btn" 
          onClick={onBack}
          aria-label="Back to curated homepage"
        >
          <ChevronLeft size={20} />
          <span>Curated Home</span>
        </button>

        <div className="explore-more-badge">
          <Compass size={13} className="explore-badge-icon" />
          <span>Finite Discovery • {finitePool.length} Topics</span>
        </div>
      </header>

      {/* Hero Intro */}
      <section className="explore-more-hero">
        <h1 className="explore-more-title">Explore More</h1>
        <p className="explore-more-subtitle">
          A finite, hand-picked collection of rabbit holes designed to provoke wonder without infinite scroll overload.
        </p>

        {/* Category Pills */}
        <div className="explore-more-categories" role="tablist" aria-label="Topic filters">
          {categories.map(cat => (
            <button
              key={cat}
              className={`explore-cat-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
              role="tab"
              aria-selected={activeCategory === cat}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Grid of 15-20 Curated Cards */}
      <section className="explore-more-grid" aria-label="Curated topics grid">
        {filteredTopics.map((topic) => (
          <TopicCard
            key={topic.id}
            topic={topic}
            onClick={onOpenTopic}
          />
        ))}
      </section>

      {/* End of Collection Card */}
      <footer className="explore-more-footer">
        <div className="finite-end-pill">
          <Sparkles size={14} />
          <span>End of curated collection • Check back tomorrow for new rabbit holes</span>
        </div>
      </footer>
    </div>
  )
}
