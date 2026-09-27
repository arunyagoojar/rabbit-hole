import { useState } from 'react'
import { BookOpen, Headphones, X, Sparkles, ArrowRight } from 'lucide-react'

/**
 * ConsumeModeModal
 * Prompts the user to choose how they want to consume the topic:
 * - "Reading Mode" (single-page continuous scroll with curiosity branches)
 * - "Audio Only" (hands-free player with live transcript & interactive Q&A)
 */
export default function ConsumeModeModal({ topic, isOpen, onClose, onSelectMode }) {
  if (!isOpen || !topic) return null

  const category = topic.category || topic.tags?.[0] || 'Discovery'

  const handleSelect = (mode) => {
    if (mode === 'audio' && typeof window !== 'undefined') {
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext
        if (AudioCtxClass) {
          window.__rhAudioCtx = window.__rhAudioCtx || new AudioCtxClass()
          if (window.__rhAudioCtx.state === 'suspended') {
            window.__rhAudioCtx.resume().catch(() => {})
          }
        }
      } catch {}
    }
    onSelectMode(mode, topic)
  }

  return (
    <div className="consume-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="mode-modal-title">
      <div className="consume-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="consume-modal-close" onClick={onClose} aria-label="Close dialog">
          <X size={18} />
        </button>

        <div className="consume-modal-header">
          <div className="consume-modal-badge">
            <span className="badge-dot" />
            <span className="badge-text">{category}</span>
          </div>
          <h2 id="mode-modal-title" className="consume-modal-title">
            {topic.title}
          </h2>
          <p className="consume-modal-subtitle">
            Choose your preferred way to experience this rabbit hole:
          </p>
        </div>

        <div className="consume-options-grid">
          {/* Option 1: Reading Mode */}
          <button
            className="consume-option-card read-card"
            onClick={() => handleSelect('read')}
            autoFocus
          >
            <div className="consume-card-header">
              <div className="consume-icon-box">
                <BookOpen size={22} className="consume-icon" />
              </div>
              <span className="consume-pill">Visual & Deep</span>
            </div>
            <div className="consume-card-body">
              <h3 className="consume-option-name">Reading Mode</h3>
              <p className="consume-option-desc">
                Continuous single-page editorial scroll with inline curiosity branches and paragraph-by-paragraph voice narration.
              </p>
            </div>
            <div className="consume-card-footer">
              <span className="consume-action-label">Start reading</span>
              <ArrowRight size={16} className="consume-arrow" />
            </div>
          </button>

          {/* Option 2: Listening Mode */}
          <button
            className="consume-option-card audio-card"
            onClick={() => handleSelect('audio')}
          >
            <div className="consume-card-header">
              <div className="consume-icon-box">
                <Headphones size={22} className="consume-icon" />
              </div>
              <span className="consume-pill audio-pill">Hands-free</span>
            </div>
            <div className="consume-card-body">
              <h3 className="consume-option-name">Listening Mode</h3>
              <p className="consume-option-desc">
                Immerse in spoken narration, follow key passages, and explore questions hands-free.
              </p>
            </div>
            <div className="consume-card-footer">
              <span className="consume-action-label">Start listening</span>
              <ArrowRight size={16} className="consume-arrow" />
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
