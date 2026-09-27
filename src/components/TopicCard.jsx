import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useCachedImage } from '../hooks/useCachedImage'

/**
 * TopicCard — Minimalist Architectural & Photographic Editorial Card
 * 
 * Features:
 * - Strict topic validation: never renders undefined or blank cards.
 * - Relevant photography from Pexels / cached storage.
 * - Subtle immersive zoom (1.04x) with sharp center and softened vignette edges.
 * - Editorial typography and metadata.
 */
export default function TopicCard({ topic, onClick, wide }) {
  const { userData, toggleSaveTopic } = useAuth()
  const [imgLoaded, setImgLoaded] = useState(false)

  // Validation: Malformed topics without title or id must never reach UI
  if (!topic || !topic.id || !topic.title || typeof topic.title !== 'string' || !topic.title.trim()) {
    console.warn('TopicCard: rejected malformed topic:', topic)
    return null
  }

  const categoryName = topic.category || (topic.tags && topic.tags[0]) || 'General'
  const isSaved = (userData?.savedIds || []).includes(topic.id)
  const photoUrl = useCachedImage(topic)

  const handleBookmark = (e) => {
    e.stopPropagation()
    toggleSaveTopic(topic.id)
  }

  return (
    <article
      className={`arch-topic-card${wide ? ' wide' : ''}`}
      onClick={() => onClick(topic)}
      role="button"
      tabIndex={0}
      aria-label={`Read about ${topic.title}`}
      onKeyDown={(e) => (e.key === 'Enter' ? onClick(topic) : null)}
    >
      {/* Top Visual Area: Pexels Photography with Subtle Zoom & Soft Edges */}
      <div className="arch-card-visual">
        <div className="card-photo-container" aria-hidden="true">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              className={`card-photo-img ${imgLoaded ? 'loaded' : ''}`}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
            />
          ) : (
            <div className="card-photo-fallback-pattern" />
          )}
          {/* Subtle perimeter softness vignette — center remains 100% sharp */}
          <div className="card-photo-vignette" />
        </div>
        
        {/* Floating Bookmark Button on Top-Right */}
        <button
          className={`arch-card-bookmark${isSaved ? ' saved' : ''}`}
          onClick={handleBookmark}
          aria-label={isSaved ? `Remove bookmark for ${topic.title}` : `Bookmark ${topic.title}`}
          title={isSaved ? 'Saved to bookmarks' : 'Save topic'}
        >
          <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Bottom Content Area: High-Contrast Editorial Typography & Metadata */}
      <div className="arch-card-content">
        <h3 className="arch-card-title">{topic.title}</h3>

        {(topic.description || topic.blurb || topic.hook) && (
          <p className="arch-card-desc">{topic.description || topic.blurb || topic.hook}</p>
        )}

        <div className="arch-card-footer">
          <span className="arch-card-tag">{categoryName}</span>
          {topic.readingTime && (
            <span className="arch-card-time">{topic.readingTime}</span>
          )}
        </div>
      </div>
    </article>
  )
}
