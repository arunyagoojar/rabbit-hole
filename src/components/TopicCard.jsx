import { useState } from 'react'
import { useCachedImage } from '../hooks/useCachedImage'
import { TOPIC_GRADIENTS } from '../data/gradients'

/**
 * TopicCard — used in both Explore and Saved pages
 *
 * Props:
 *   topic       — topic object
 *   onClick     — fn(topic) — opens reading overlay
 *   wide        — boolean — full-width card (16:9)
 */
export default function TopicCard({ topic, onClick, wide }) {
  const categoryName = topic.category || (topic.tags && topic.tags[0]) || 'Science'
  const gradient = TOPIC_GRADIENTS[categoryName] || 'linear-gradient(135deg, #1a1a1a, #333)'

  // Use the pre-fetched static image URL with caching
  const bgImage = useCachedImage(topic.imageUrl, topic.imageQuery || topic.id);
  const [imgLoaded, setImgLoaded] = useState(false)

  return (
    <article
      className={`topic-card${wide ? ' wide' : ''}`}
      onClick={() => onClick(topic)}
      role="button"
      tabIndex={0}
      aria-label={`Read about ${topic.title}`}
      onKeyDown={(e) => e.key === 'Enter' ? onClick(topic) : null}
    >
      {/* Background gradient — acts as loading placeholder and fallback */}
      <div
        className="card-gradient-bg"
        style={{ background: gradient }}
        aria-hidden="true"
      />

      {/* Image layer — fades in once loaded */}
      {bgImage && (
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundImage: `url(${bgImage})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 0.6s ease'
          }}
          aria-hidden="true"
        />
      )}

      {/* Hidden img to detect load completion */}
      {bgImage && (
        <img 
          src={bgImage} 
          alt="" 
          style={{ display: 'none' }} 
          onLoad={() => setImgLoaded(true)} 
        />
      )}

      {/* Dark overlay for text legibility */}
      <div 
        className="card-overlay" 
        style={{ 
          background: bgImage 
            ? 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.4) 100%)' 
            : undefined 
        }} 
        aria-hidden="true" 
      />

      {/* Content */}
      <div className="card-content">
        <h3 className="card-title">{topic.title}</h3>
        {(topic.description || topic.hook) && (
          <p className="card-desc">{topic.description || topic.hook}</p>
        )}
        <div className="card-tags" style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', overflow: 'hidden', marginTop: 'auto', paddingTop: '12px' }}>
          {(topic.tags || [categoryName]).slice(0, 2).map(tag => (
            <span key={tag} className="card-tag" style={{ whiteSpace: 'nowrap' }}>{tag}</span>
          ))}
        </div>
      </div>
    </article>
  )
}
