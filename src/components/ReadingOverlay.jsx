import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  ChevronLeft, 
  Bookmark, 
  Headphones, 
  Volume2, 
  Pause, 
  RotateCcw,
  Plus,
  Send
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '../contexts/AuthContext'
import { analytics } from '../services/analyticsService'
import { 
  fetchCanonicalTopic,
  expandCanonicalThread,
  buildAudioQueue,
  getOrPrefetchAudioBuffer,
  prefetchAudioAhead,
  cleanSpokenText 
} from '../services/rabbitHoleEngine'

/**
 * ReadingOverlay — Editorial Continuous Single-Page Reading Experience
 * 
 * Features:
 * - Clean editorial flow without inline or thread-level audio buttons.
 * - Single floating reading utility in bottom-right:
 *   [ + / - / Read Aloud ]
 * - + / - controls overall reading scale (font, line-height, measure, paragraph spacing).
 * - Persisted reading scale preference in localStorage.
 * - Context-aware Read Aloud: "Read aloud" -> "Pause" -> "Resume" -> "Read again".
 * - Read Aloud naturally includes rabbit-hole questions at the end of the journey.
 * - Seamless audio continuity: when Read Aloud is active, selecting a curiosity question
 *   automatically continues narration into the newly generated thread.
 * - Immediate visible thinking feedback upon question selection without blocking text.
 */
export default function ReadingOverlay({ 
  topic, 
  onClose, 
  onSwitchToAudio 
}) {
  const containerRef = useRef(null)
  const [canonical, setCanonical] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [generatingPrompt, setGeneratingPrompt] = useState('')
  const [customQuestion, setCustomQuestion] = useState('')
  const [isAskingCustom, setIsAskingCustom] = useState(false)

  // Reading scale preference (0 to 6, default 0)
  const [readingScale, setReadingScale] = useState(() => {
    try {
      const saved = localStorage.getItem('rh_reading_scale')
      if (saved !== null) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 6) return parsed
      }
    } catch {}
    return 0
  })

  // Explicit audio playback state
  const [playbackState, setPlaybackState] = useState({
    activeUnitId: null,
    isPlaying: false,
    isPaused: false,
    isFinished: false,
    isPreparing: false
  })

  const audioCtxRef = useRef(null)
  const activeSourceRef = useRef(null)
  const activeUtteranceRef = useRef(null)
  const isSpeechSynthesisRef = useRef(false)
  const currentUnitIndexRef = useRef(0)
  const isPlayingRef = useRef(false)
  const playbackQueueRef = useRef([])
  const pausedOffsetRef = useRef(0)
  const currentChunkStartTimeRef = useRef(0)

  // Reading scroll progress
  const [scrollProgress, setScrollProgress] = useState(0)

  const { userData, toggleSaveTopic, completeTopic } = useAuth()
  const isSaved = (userData?.savedIds || []).includes(topic?.id)

  // Track session start
  useEffect(() => {
    analytics.startTopicSession(topic.id, 'read')
    return () => {
      analytics.endTopicSession()
    }
  }, [topic?.id])

  // Get or initialize AudioContext
  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (window.__rhAudioCtx && window.__rhAudioCtx.state !== 'closed') {
      audioCtxRef.current = window.__rhAudioCtx
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {})
      }
      return audioCtxRef.current
    }
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext
    if (!AudioCtxClass) return null
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioCtxClass()
      window.__rhAudioCtx = audioCtxRef.current
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {})
    }
    return audioCtxRef.current
  }, [])

  // Stop active narration
  const stopAudio = useCallback(() => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop()
        activeSourceRef.current.disconnect()
      } catch {}
      activeSourceRef.current = null
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    activeUtteranceRef.current = null
    isSpeechSynthesisRef.current = false
    isPlayingRef.current = false
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      isPreparing: false
    }))
  }, [])

  // Pause narration while preserving playback position
  const pauseAudio = useCallback(() => {
    if (isSpeechSynthesisRef.current && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause()
    } else {
      const ctx = audioCtxRef.current
      if (ctx && currentChunkStartTimeRef.current > 0) {
        pausedOffsetRef.current = Math.max(0, ctx.currentTime - currentChunkStartTimeRef.current)
      }
      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.stop()
          activeSourceRef.current.disconnect()
        } catch {}
        activeSourceRef.current = null
      }
    }
    isPlayingRef.current = false
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: true,
      isPreparing: false
    }))
  }, [])

  useEffect(() => {
    return () => stopAudio()
  }, [stopAudio, topic?.id])

  // Fetch or initialize canonical topic content
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')

    fetchCanonicalTopic(topic)
      .then(canonicalData => {
        if (cancelled) return
        setCanonical(canonicalData)
      })
      .catch(err => {
        if (cancelled) return
        console.warn('Canonical load notice:', err?.message)
        setLoadError("The exploration couldn't be loaded right now. Please tap retry.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [topic])

  // Play an audio buffer for a queue unit with paragraph-level highlighting
  const playQueueItem = useCallback(async (queue, index, startOffsetSec = 0) => {
    if (!queue || index >= queue.length || !isPlayingRef.current) {
      stopAudio()
      if (index >= (queue?.length || 0)) {
        setPlaybackState(prev => ({ ...prev, isFinished: true }))
      }
      return
    }

    const item = queue[index]
    currentUnitIndexRef.current = index
    const ctx = getAudioContext()
    if (!ctx) return

    setPlaybackState({
      activeUnitId: item.unitId || item.sectionId,
      isPlaying: true,
      isPaused: false,
      isFinished: false,
      isPreparing: true
    })

    // Eagerly prefetch next items in background
    prefetchAudioAhead(queue, index, topic.id, ctx)

    try {
      const buffer = await getOrPrefetchAudioBuffer(item, topic.id, ctx)
      if (!buffer) {
        // Fallback to browser SpeechSynthesis when cloud TTS quota is exhausted
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel()
          const cleanText = cleanSpokenText(item.text)
          const utterance = new SpeechSynthesisUtterance(cleanText)
          utterance.rate = 1.0
          utterance.pitch = 1.0

          const voices = window.speechSynthesis.getVoices()
          const enVoice = voices.find(v => v.lang && v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Daniel') || v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Karen') || v.name.includes('Alex'))) || voices.find(v => v.lang && v.lang.startsWith('en'))
          if (enVoice) utterance.voice = enVoice

          setPlaybackState(prev => ({ ...prev, isPreparing: false }))
          isSpeechSynthesisRef.current = true

          // Scroll active section into view
          if (containerRef.current && (item.unitId || item.sectionId)) {
            const targetId = item.unitId || item.sectionId
            const activeEl = containerRef.current.querySelector(`[data-section-id="${targetId}"]`)
            if (activeEl) {
              activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
          }

          utterance.onend = () => {
            isSpeechSynthesisRef.current = false
            if (isPlayingRef.current) {
              setTimeout(() => {
                if (isPlayingRef.current) {
                  playQueueItem(queue, index + 1, 0)
                }
              }, 350)
            }
          }

          utterance.onerror = (e) => {
            console.warn('SpeechSynthesis error:', e)
            if (isPlayingRef.current) {
              stopAudio()
            }
          }

          activeUtteranceRef.current = utterance
          window.speechSynthesis.speak(utterance)
          return
        }

        stopAudio()
        return
      }

      setPlaybackState(prev => ({ ...prev, isPreparing: false }))

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      activeSourceRef.current = source

      const startCtxTime = ctx.currentTime - startOffsetSec
      currentChunkStartTimeRef.current = startCtxTime
      source.start(0, startOffsetSec)

      // Smoothly scroll active section into view if outside viewport
      if (containerRef.current && (item.unitId || item.sectionId)) {
        const targetId = item.unitId || item.sectionId
        const activeEl = containerRef.current.querySelector(`[data-section-id="${targetId}"]`)
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }

      source.onended = () => {
        activeSourceRef.current = null
        pausedOffsetRef.current = 0
        if (isPlayingRef.current) {
          // Natural 0.35s pause between sections
          setTimeout(() => {
            if (isPlayingRef.current) {
              playQueueItem(queue, index + 1, 0)
            }
          }, 350)
        }
      }
    } catch (err) {
      console.warn('Narration playback notice:', err?.message)
      setTimeout(() => {
        if (isPlayingRef.current) {
          playQueueItem(queue, index + 1, 0)
        }
      }, 500)
    }
  }, [getAudioContext, stopAudio, topic?.id])

  // Handle scale changes with persistence (0 to 6 range)
  const handleScaleUp = () => {
    setReadingScale(prev => {
      const next = Math.min(prev + 1, 6)
      try { localStorage.setItem('rh_reading_scale', String(next)) } catch {}
      return next
    })
  }

  const handleScaleDown = () => {
    setReadingScale(prev => {
      const next = Math.max(prev - 1, 0)
      try { localStorage.setItem('rh_reading_scale', String(next)) } catch {}
      return next
    })
  }

  // Unified Global Read Aloud Toggle (Requirement 1, 3, 4, 5)
  const handleToggleGlobalReadAloud = () => {
    if (playbackState.isPlaying) {
      pauseAudio()
      return
    }

    if (playbackState.isPaused) {
      if (isSpeechSynthesisRef.current && typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
        isPlayingRef.current = true
        setPlaybackState(prev => ({ ...prev, isPlaying: true, isPaused: false }))
        return
      }
      isPlayingRef.current = true
      setPlaybackState(prev => ({ ...prev, isPlaying: true, isPaused: false }))
      playQueueItem(playbackQueueRef.current, currentUnitIndexRef.current, pausedOffsetRef.current)
      return
    }

    if (!canonical) return

    stopAudio()
    const queue = buildAudioQueue(canonical).map(item => ({
      ...item,
      unitId: item.sectionId || item.id
    }))

    if (queue.length === 0) return

    playbackQueueRef.current = queue
    isPlayingRef.current = true
    playQueueItem(queue, 0, 0)
  }

  // Label for the unified Read Aloud floating button
  const getReadAloudLabel = () => {
    if (playbackState.isPlaying) return 'Pause'
    if (playbackState.isPaused) return 'Resume'
    if (playbackState.isFinished) return 'Read again'
    return 'Read aloud'
  }

  // Explore a rabbit-hole question (unified thread expansion & continuous narration)
  const handleBranchSelect = useCallback(async (promptText) => {
    const q = (promptText || customQuestion).trim()
    if (!q || generatingPrompt || !canonical) return

    // 1. Immediately transition into thinking state (Requirement 6)
    setGeneratingPrompt(q)
    setIsAskingCustom(false)
    setCustomQuestion('')

    const wasActive = isPlayingRef.current || playbackState.isPlaying

    analytics.track('selected_branch', {
      topicId: topic.id,
      consumeMode: 'read',
      metadata: { prompt: q }
    })

    try {
      // 2. Generate new thread content (Requirement 6)
      const { updatedCanonical, newThread } = await expandCanonicalThread(canonical, q)
      
      // 3. Immediately display generated text (Requirement 6, 14)
      setCanonical(updatedCanonical)

      // 4. Immediately trigger TTS in background (Requirement 6, 7, 12)
      const threadUnit = {
        id: `queue-${newThread.id}`,
        sectionId: newThread.id,
        unitId: newThread.id,
        threadId: newThread.id,
        label: newThread.heading || newThread.question,
        text: newThread.paragraphs.join('\n\n')
      }

      const ctx = getAudioContext()
      if (ctx) {
        getOrPrefetchAudioBuffer(threadUnit, topic.id, ctx).catch(() => {})
      }

      // Smoothly scroll to the newly opened thread
      setTimeout(() => {
        if (containerRef.current) {
          const target = containerRef.current.querySelector(`#${newThread.id}`)
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }
      }, 150)

      // 5. If Read Aloud was active, seamlessly continue into the new thread (Requirement 4, 7)
      if (wasActive && isPlayingRef.current) {
        const updatedQueue = buildAudioQueue(updatedCanonical).map(item => ({
          ...item,
          unitId: item.sectionId || item.id
        }))
        playbackQueueRef.current = updatedQueue

        const newThreadIdx = updatedQueue.findIndex(item => item.threadId === newThread.id)
        if (newThreadIdx !== -1 && currentUnitIndexRef.current >= updatedQueue.length - 2) {
          playQueueItem(updatedQueue, newThreadIdx, 0)
        }
      }

      completeTopic(topic.id, topic.title, canonical.category, updatedCanonical.sections.length + updatedCanonical.threads.length, 10, {
        selectedPrompt: q
      })
    } catch (err) {
      console.warn('Branch expansion error:', err?.message)
    } finally {
      setGeneratingPrompt('')
    }
  }, [canonical, completeTopic, customQuestion, generatingPrompt, getAudioContext, playQueueItem, playbackState.isPlaying, topic.id, topic.title])

  // Track scroll progress
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const totalHeight = el.scrollHeight - el.clientHeight
    if (totalHeight <= 0) {
      setScrollProgress(0)
      return
    }
    const currentScroll = el.scrollTop
    setScrollProgress(Math.min(Math.max(currentScroll / totalHeight, 0), 1))
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const handleClose = () => {
    stopAudio()
    onClose({
      cardsRead: (canonical?.sections?.length || 1) + (canonical?.threads?.length || 0),
      totalCards: 5,
      topicSnapshot: topic
    })
  }

  return (
    <div 
      className="reader-overlay"
      role="document" 
      aria-label={`Reading: ${topic.title}`}
    >
      {/* ─── Top Reader Navigation Bar (Clean Minimal Layout) ─── */}
      <header className="reader-top-bar">
        <button 
          className="reader-icon-btn reader-back-btn" 
          onClick={handleClose} 
          aria-label="Back to explore"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="reader-bar-actions">
          {onSwitchToAudio && (
            <button 
              className="reader-nav-action-btn audio-btn" 
              onClick={() => {
                stopAudio()
                onSwitchToAudio(topic)
              }}
              title="Listen in Audio Mode"
              aria-label="Listen in Audio Mode"
            >
              <Headphones size={14} />
              <span>Audio</span>
            </button>
          )}

          <button 
            className={`reader-nav-action-btn bookmark-btn ${isSaved ? 'saved' : ''}`}
            onClick={() => toggleSaveTopic(topic.id)}
            aria-label={isSaved ? "Remove bookmark" : "Save topic"}
            title={isSaved ? "Saved" : "Save topic"}
          >
            <Bookmark size={14} fill={isSaved ? "currentColor" : "none"} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </header>

      {/* ─── Isolated Reading Content Layer with Edge Fades ─── */}
      <div className="reader-content-viewport">
        <div className="reader-edge-fade reader-edge-fade-top" aria-hidden="true" />

        <div className="reader-scroll-container" ref={containerRef}>
          <main className="reader-content-canvas" data-reading-scale={readingScale}>
            {/* Editorial Title Section */}
            <section className="reader-header-section">
              <div className="reader-chapter-label">
                <span className="chapter-line" />
                <span className="chapter-text">RABBIT HOLE EXPLORATION</span>
                <span className="chapter-line" />
              </div>

              <h1 className="reader-primary-title">
                {topic.title}
              </h1>

              {/* The Narrative Hook */}
              {canonical?.hook && (
                <p 
                  className={`reader-editorial-hook ${playbackState.activeUnitId === 'hook' && playbackState.isPlaying ? 'speaking-active' : ''}`}
                  data-section-id="hook"
                >
                  {canonical.hook}
                </p>
              )}

              <div className="reader-divider" />
            </section>

            {/* ─── Loading State ─── */}
            {loading && !canonical && (
              <div className="reader-skeleton-block">
                <div className="skeleton-line full" />
                <div className="skeleton-line full" />
                <div className="skeleton-line medium" />
                <p className="reader-loading-caption">
                  Opening curiosity exploration...
                </p>
              </div>
            )}

            {loadError && !canonical && (
              <div className="reader-error-card">
                <p>{loadError}</p>
                <button 
                  className="reader-retry-btn"
                  onClick={() => window.location.reload()}
                >
                  <RotateCcw size={14} />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {/* ─── Canonical Sections (The Explanatory Journey) ─── */}
            {canonical?.sections?.map((section, secIdx) => {
              const isHookDuplicate = secIdx === 0 && section.paragraphs.length === 1 && section.paragraphs[0] === canonical.hook
              if (isHookDuplicate) return null

              const isSectionSpeaking = playbackState.isPlaying && playbackState.activeUnitId === section.id

              return (
                <motion.article 
                  key={section.id} 
                  id={section.id} 
                  data-section-id={section.id}
                  className="reader-section-block"
                  initial={secIdx > 0 ? { opacity: 0, y: 18 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  {section.heading && (
                    <h2 className="reader-section-heading">
                      {section.heading}
                    </h2>
                  )}

                  <div className="reader-paragraphs-stream">
                    {section.paragraphs.map((paraText, pIdx) => {
                      if (paraText === canonical.hook) return null
                      return (
                        <p 
                          key={pIdx} 
                          className={`reader-body-paragraph ${isSectionSpeaking ? 'speaking-active' : ''}`}
                        >
                          {paraText}
                        </p>
                      )
                    })}
                  </div>
                </motion.article>
              )
            })}

            {/* ─── Explored Rabbit-Hole Threads (User-Opened Depths) ─── */}
            {canonical?.threads?.map((thread, tIdx) => {
              const isThreadSpeaking = playbackState.isPlaying && playbackState.activeUnitId === thread.id

              return (
                <motion.article 
                  key={thread.id} 
                  id={thread.id} 
                  data-section-id={thread.id}
                  className="reader-section-block reader-thread-block"
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="reader-thread-header-row">
                    <div className="reader-branch-heading-box">
                      <div className="branch-sparkle-pill">
                        <span>Curiosity Thread 0{tIdx + 1}</span>
                      </div>
                      <h2 className="reader-branch-heading">
                        {thread.heading || thread.question}
                      </h2>
                    </div>
                  </div>

                  <div className="reader-paragraphs-stream">
                    {thread.paragraphs.map((paraText, pIdx) => (
                      <p 
                        key={pIdx} 
                        className={`reader-body-paragraph ${isThreadSpeaking ? 'speaking-active' : ''}`}
                      >
                        {paraText}
                      </p>
                    ))}
                  </div>
                </motion.article>
              )
            })}

            {/* ─── Immediate Thinking State when Opening a Deeper Layer (Requirement 6) ─── */}
            <AnimatePresence>
              {generatingPrompt && (
                <motion.div 
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="reader-thinking-station"
                  role="status"
                >
                  <div className="organic-thinking-wave">
                    <span className="thinking-dot" />
                    <span className="thinking-dot" />
                    <span className="thinking-dot" />
                  </div>
                  <p className="reader-thinking-caption">
                    Opening deeper layer: “{generatingPrompt}”
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── WHERE TO GO NEXT (Curiosity Questions Station) ─── */}
            <section 
              className="reader-questions-station" 
              data-section-id="questions-station"
              aria-label="Where to go next"
            >
              <div className="station-anchor-indicator">
                <span className="station-line" />
                <span className="station-label">WHERE TO GO NEXT</span>
                <span className="station-line" />
              </div>

              <div className="station-questions-list">
                {(canonical?.prompts || [
                  'What is really happening underneath?',
                  'What happens when the sensors disagree?',
                  'Why is this so difficult in real life?'
                ]).map((promptText, i) => (
                  <button
                    key={i}
                    className="station-question-card"
                    onClick={() => handleBranchSelect(promptText)}
                    disabled={Boolean(generatingPrompt)}
                  >
                    <span className="station-question-num">0{i + 1}</span>
                    <span className="station-question-text">{promptText}</span>
                    <span className="station-question-arrow">→</span>
                  </button>
                ))}

                {/* Custom Question Form */}
                {!isAskingCustom ? (
                  <button 
                    className="station-custom-trigger-btn"
                    onClick={() => setIsAskingCustom(true)}
                    disabled={Boolean(generatingPrompt)}
                  >
                    <Plus size={14} />
                    <span>Ask your own curiosity question</span>
                  </button>
                ) : (
                  <form 
                    className="station-custom-form"
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleBranchSelect(customQuestion)
                    }}
                  >
                    <input 
                      type="text"
                      className="station-custom-input"
                      value={customQuestion}
                      onChange={(e) => setCustomQuestion(e.target.value)}
                      placeholder="Ask something specific about this topic..."
                      maxLength={140}
                      autoFocus
                    />
                    <button 
                      type="submit" 
                      className="station-custom-submit"
                      disabled={!customQuestion.trim() || Boolean(generatingPrompt)}
                    >
                      <Send size={14} />
                      <span>Ask</span>
                    </button>
                    <button 
                      type="button" 
                      className="station-custom-cancel"
                      onClick={() => {
                        setIsAskingCustom(false)
                        setCustomQuestion('')
                      }}
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            </section>
          </main>
        </div>

        <div className="reader-edge-fade reader-edge-fade-bottom" aria-hidden="true" />
      </div>

      {/* ─── Single Unified Floating Reading Utility Group (Requirement 1, 2, 3) ─── */}
      <div 
        className="reading-floating-utility" 
        role="region" 
        aria-label="Reading scale and narration utility"
      >
        <div className="reading-scale-group" aria-label="Reading scale adjustment">
          <button 
            className="reading-scale-btn scale-down" 
            onClick={handleScaleDown} 
            disabled={readingScale <= 0}
            aria-label="Decrease reading scale"
            title="Decrease reading scale"
          >
            −
          </button>
          <div className="reading-scale-vertical-divider" />
          <button 
            className="reading-scale-btn scale-up" 
            onClick={handleScaleUp} 
            disabled={readingScale >= 6}
            aria-label="Increase reading scale"
            title="Increase reading scale"
          >
            +
          </button>
        </div>

        <div className="reading-utility-divider" />

        <button 
          className={`reading-aloud-toggle-btn ${playbackState.isPlaying ? 'active' : ''}`}
          onClick={handleToggleGlobalReadAloud}
          aria-label={getReadAloudLabel()}
          title={getReadAloudLabel()}
        >
          {playbackState.isPlaying ? (
            <Pause size={14} />
          ) : (
            <Volume2 size={14} />
          )}
          <span>{getReadAloudLabel()}</span>
        </button>
      </div>

      {/* Progress line */}
      <div 
        className="reader-progress-line" 
        style={{ width: `${scrollProgress * 100}%` }}
        role="progressbar"
        aria-valuenow={Math.round(scrollProgress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  )
}
