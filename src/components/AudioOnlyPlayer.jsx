import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  ChevronLeft, 
  Bookmark, 
  BookOpen, 
  MessageSquare, 
  Send,
  X,
  RotateCcw,
  Sparkles
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '../contexts/AuthContext'
import { analytics } from '../services/analyticsService'
import { ParticlesOrb } from '@/registry/orbe/particles-orb/particles-orb'
import { 
  fetchCanonicalTopic,
  expandCanonicalThread,
  buildAudioQueue,
  getOrPrefetchAudioBuffer,
  prefetchAudioAhead,
  generateSubtitleCues, 
  cleanSpokenText 
} from '../services/rabbitHoleEngine'

/**
 * Clean, human-facing states for Rabbit Hole Audio Experience.
 * Never exposes technical or provider details (Gemini, API, TTS).
 */
const HUMAN_AUDIO_STATES = {
  idle: 'Idle',
  connecting: 'Preparing audio',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  paused: 'Paused',
  finished: 'Finished',
  error: 'Something went wrong',
  disabled: 'Unavailable'
}

/**
 * AudioOnlyPlayer — Editorial Curiosity Listening Journey
 * 
 * Features:
 * - Single source of truth orb state machine ('idle'|'connecting'|'listening'|'thinking'|'speaking'|'error'|'disabled').
 * - Enlarged, responsive speaking orb (desktop large focal point ~360px, tablet medium ~275px, mobile scaled ~205px).
 * - Orb itself is the primary interactive play/pause/resume/replay control (no separate play buttons).
 * - Custom question flow: instantly transitions title to user's question, switches orb to Thinking,
 *   generates text, immediately starts TTS, and transitions into Speaking.
 * - Robust TTS prefetching without interrupting audible state.
 * - Text is never blocked by TTS failures.
 */
export default function AudioOnlyPlayer({ 
  topic, 
  onClose, 
  onSwitchToRead 
}) {
  const { userData, toggleSaveTopic, completeTopic } = useAuth()
  const isSaved = (userData?.savedIds || []).includes(topic?.id)

  // Canonical Content & Audio Queue State
  const [canonical, setCanonical] = useState(null)
  const [audioQueue, setAudioQueue] = useState([])
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0)

  // Contextual Title Transition (Requirement 8, 30, 31)
  const [activeTitle, setActiveTitle] = useState(topic.title)
  const [isAnsweringQuestion, setIsAnsweringQuestion] = useState(false)

  // Playback & UI State
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSubtitle, setCurrentSubtitle] = useState('')
  const [audioState, setAudioState] = useState('connecting') // idle, connecting, listening, thinking, speaking, paused, finished, error
  const [playbackError, setPlaybackError] = useState(null)
  
  // Enlarged Responsive Orb Sizing (20–30% larger visual footprint)
  const [orbSize, setOrbSize] = useState(() => {
    if (typeof window === 'undefined') return 300
    if (window.innerWidth >= 1024) return 360
    if (window.innerWidth >= 640) return 275
    return 205
  })

  // Ask Something Drawer State
  const [isAsking, setIsAsking] = useState(false)
  const [userQuestion, setUserQuestion] = useState('')
  const wasPlayingBeforeAskRef = useRef(false)

  // Audio References
  const audioCtxRef = useRef(null)
  const activeSourceRef = useRef(null)
  const activeUtteranceRef = useRef(null)
  const isSpeechSynthesisRef = useRef(false)
  const analyserRef = useRef(null)
  const rafLevelRef = useRef(null)
  const levelRef = useRef(-1)
  const isPlayingRef = useRef(false)
  const subtitleTimerRef = useRef(null)
  const currentChunkStartTimeRef = useRef(0)
  const pausedOffsetRef = useRef(0)
  const currentCuesRef = useRef([])
  const hasAutoplayedRef = useRef(false)

  // Responsive orb sizing (+20-30% increase)
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      if (w >= 1024) setOrbSize(360)
      else if (w >= 640) setOrbSize(275)
      else setOrbSize(205)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Track session start
  useEffect(() => {
    analytics.startTopicSession(topic.id, 'audio')
    return () => {
      analytics.endTopicSession()
    }
  }, [topic?.id])

  // AudioContext getter with reuse
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

  // Stop active audio
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
    if (subtitleTimerRef.current) {
      clearInterval(subtitleTimerRef.current)
      subtitleTimerRef.current = null
    }
    if (rafLevelRef.current) {
      cancelAnimationFrame(rafLevelRef.current)
      rafLevelRef.current = null
    }
    analyserRef.current = null
    levelRef.current = -1
    isPlayingRef.current = false
    setIsPlaying(false)
  }, [])

  useEffect(() => {
    return () => stopAudio()
  }, [stopAudio, topic?.id])

  // Initialize Canonical Content and Build Audio Queue
  useEffect(() => {
    let cancelled = false
    setAudioState('connecting')

    fetchCanonicalTopic(topic)
      .then(canonicalData => {
        if (cancelled) return
        setCanonical(canonicalData)
        const queue = buildAudioQueue(canonicalData)
        setAudioQueue(queue)
      })
      .catch(err => {
        if (cancelled) return
        console.warn('Audio starter notice:', err?.message)
        setPlaybackError("Audio couldn't be loaded right now.")
        setAudioState('error')
      })

    return () => { cancelled = true }
  }, [topic])

  // Play a specific queue item with seamless streaming transition to next
  const playQueueItem = useCallback(async (index, startOffsetSec = 0, explicitQueue = null) => {
    const queue = explicitQueue || audioQueue
    if (!queue || queue.length === 0) return

    if (index >= queue.length) {
      stopAudio()
      setAudioState('finished')
      setCurrentQueueIndex(0)
      pausedOffsetRef.current = 0
      completeTopic(topic.id, topic.title, canonical?.category, queue.length, queue.length)
      return
    }

    const item = queue[index]
    const ctx = getAudioContext()
    if (!ctx) return

    const wasAlreadyPlaying = isPlayingRef.current
    stopAudio()
    setCurrentQueueIndex(index)
    setIsPlaying(true)
    isPlayingRef.current = true

    // Maintain speaking state if continuously transitioning between chunks so the orb never flickers to thinking
    if (!wasAlreadyPlaying) {
      setAudioState('connecting')
    }
    setPlaybackError(null)

    // Eagerly prefetch Section N+1 and Section N+2 in background (Requirement 11)
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

          setAudioState('speaking')
          setIsPlaying(true)
          isPlayingRef.current = true
          isSpeechSynthesisRef.current = true

          // Subtitle phrase cues
          const words = cleanText.split(/\s+/).filter(Boolean)
          const estDurationSec = Math.max(3, words.length / 2.6)
          const cues = generateSubtitleCues(item.text, estDurationSec)
          currentCuesRef.current = cues
          if (cues[0]) setCurrentSubtitle(cues[0].text)

          const startTime = Date.now()
          subtitleTimerRef.current = setInterval(() => {
            if (!isPlayingRef.current) return
            const elapsedSec = (Date.now() - startTime) / 1000
            const activeCue = currentCuesRef.current.find(
              c => elapsedSec >= c.start && elapsedSec <= c.end
            )
            if (activeCue && activeCue.text !== currentSubtitle) {
              setCurrentSubtitle(activeCue.text)
            }
          }, 90)

          const animateSpeechLevel = () => {
            if (!isPlayingRef.current) {
              levelRef.current = -1
              return
            }
            levelRef.current = 0.35 + Math.sin(Date.now() / 140) * 0.22 + Math.random() * 0.12
            rafLevelRef.current = requestAnimationFrame(animateSpeechLevel)
          }
          rafLevelRef.current = requestAnimationFrame(animateSpeechLevel)

          utterance.onend = () => {
            if (subtitleTimerRef.current) {
              clearInterval(subtitleTimerRef.current)
              subtitleTimerRef.current = null
            }
            if (rafLevelRef.current) {
              cancelAnimationFrame(rafLevelRef.current)
              rafLevelRef.current = null
            }
            levelRef.current = -1
            isSpeechSynthesisRef.current = false

            if (isPlayingRef.current) {
              setTimeout(() => {
                if (isPlayingRef.current) {
                  playQueueItem(index + 1, 0, queue)
                }
              }, 500)
            }
          }

          utterance.onerror = (e) => {
            console.warn('SpeechSynthesis error:', e)
            if (isPlayingRef.current) {
              setPlaybackError("Something went wrong")
              setAudioState('error')
              stopAudio()
            }
          }

          activeUtteranceRef.current = utterance
          window.speechSynthesis.speak(utterance)
          return
        }

        if (isPlayingRef.current) {
          setPlaybackError("Something went wrong")
          setAudioState('error')
          stopAudio()
        }
        return
      }

      setAudioState('speaking')

      const source = ctx.createBufferSource()
      source.buffer = buffer

      // Analyser for natural audio-reactive particle animation
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      analyser.connect(ctx.destination)
      analyserRef.current = analyser
      activeSourceRef.current = source

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateLevel = () => {
        if (!isPlayingRef.current || !analyserRef.current) {
          levelRef.current = -1
          return
        }
        analyserRef.current.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
        const avg = sum / dataArray.length
        levelRef.current = Math.min(1, avg / 128)
        rafLevelRef.current = requestAnimationFrame(updateLevel)
      }
      rafLevelRef.current = requestAnimationFrame(updateLevel)

      const startCtxTime = ctx.currentTime - startOffsetSec
      currentChunkStartTimeRef.current = startCtxTime
      source.start(0, startOffsetSec)

      // Subtitle phrase cues
      const cues = generateSubtitleCues(item.text, buffer.duration)
      currentCuesRef.current = cues

      const initialCue = cues.find(c => startOffsetSec >= c.start && startOffsetSec <= c.end) || cues[0]
      if (initialCue) {
        setCurrentSubtitle(initialCue.text)
      }

      subtitleTimerRef.current = setInterval(() => {
        if (!isPlayingRef.current || !audioCtxRef.current) return
        const currentPlaybackSec = audioCtxRef.current.currentTime - currentChunkStartTimeRef.current
        const activeCue = currentCuesRef.current.find(
          c => currentPlaybackSec >= c.start && currentPlaybackSec <= c.end
        )
        if (activeCue && activeCue.text !== currentSubtitle) {
          setCurrentSubtitle(activeCue.text)
        }
      }, 90)

      source.onended = () => {
        if (subtitleTimerRef.current) {
          clearInterval(subtitleTimerRef.current)
          subtitleTimerRef.current = null
        }
        if (rafLevelRef.current) {
          cancelAnimationFrame(rafLevelRef.current)
          rafLevelRef.current = null
        }
        levelRef.current = -1

        // Natural ~0.5s pause between sections without stutter (Requirement 11)
        if (isPlayingRef.current) {
          setTimeout(() => {
            if (isPlayingRef.current) {
              playQueueItem(index + 1, 0, queue)
            }
          }, 500)
        }
      }
    } catch (err) {
      console.warn('Playback error:', err?.message)
      setPlaybackError("Audio playback failed.")
      setAudioState('error')
      stopAudio()
    }
  }, [audioQueue, canonical?.category, completeTopic, currentSubtitle, getAudioContext, stopAudio, topic.id, topic.title])

  // Instant startup: auto-play queue item 0 when audioQueue is ready
  useEffect(() => {
    if (!hasAutoplayedRef.current && audioQueue.length > 0) {
      hasAutoplayedRef.current = true
      playQueueItem(0, 0)
    }
  }, [audioQueue, playQueueItem])

  // Interactive Orb Play / Pause / Resume / Replay (Requirement 11)
  const handleToggleOrbPlay = () => {
    if (audioState === 'thinking') {
      // Non-interruptible during content generation
      return
    }

    if (isPlaying) {
      if (isSpeechSynthesisRef.current && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.pause()
      } else {
        const ctx = audioCtxRef.current
        if (ctx && currentChunkStartTimeRef.current > 0) {
          pausedOffsetRef.current = Math.max(0, ctx.currentTime - currentChunkStartTimeRef.current)
        }
      }
      stopAudio()
      setAudioState('paused')
    } else {
      if (playbackError) {
        setPlaybackError(null)
      }
      if (isSpeechSynthesisRef.current && typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
        setIsPlaying(true)
        isPlayingRef.current = true
        setAudioState('speaking')
        return
      }
      const targetIdx = audioState === 'finished' ? 0 : currentQueueIndex
      const offset = audioState === 'finished' ? 0 : pausedOffsetRef.current
      playQueueItem(targetIdx, offset)
    }
  }

  // Open "Ask something" dialog (Requirement 18)
  const handleOpenAsk = () => {
    wasPlayingBeforeAskRef.current = isPlayingRef.current
    if (isPlayingRef.current) {
      const ctx = audioCtxRef.current
      if (ctx && currentChunkStartTimeRef.current > 0) {
        pausedOffsetRef.current = Math.max(0, ctx.currentTime - currentChunkStartTimeRef.current)
      }
      stopAudio()
      setAudioState('paused')
    }
    setIsAsking(true)
  }

  // Cancel "Ask something" dialog without submitting (Requirement 18)
  const handleCancelAsk = () => {
    setIsAsking(false)
    setUserQuestion('')
    if (wasPlayingBeforeAskRef.current) {
      playQueueItem(currentQueueIndex, pausedOffsetRef.current)
    } else {
      setAudioState('paused')
    }
  }

  // Submit question (predefined or custom) — Immediate Transition (Requirement 8, 30, 31)
  const handleQuestionSubmit = async (questionText) => {
    const q = (questionText || userQuestion).trim()
    if (!q || !canonical) return

    // 1. Instantly close ask drawer
    setIsAsking(false)
    setUserQuestion('')

    // 2. Question becomes the active primary title
    setActiveTitle(q)
    setIsAnsweringQuestion(true)

    // 3. Speaking orb immediately changes to THINKING
    setAudioState('thinking')
    setCurrentSubtitle('...')
    setPlaybackError(null)

    analytics.track('selected_branch', {
      topicId: topic.id,
      consumeMode: 'audio',
      metadata: { question: q }
    })

    try {
      // 4. Begin generating answer immediately
      const { updatedCanonical, newThread } = await expandCanonicalThread(canonical, q)
      setCanonical(updatedCanonical)

      // 5. Build updated audio queue
      const newQueue = buildAudioQueue(updatedCanonical)
      setAudioQueue(newQueue)

      // 6. Locate newly added thread in queue
      const targetIdx = newQueue.findIndex(item => item.threadId === newThread.id)
      const playIdx = targetIdx !== -1 ? targetIdx : newQueue.length - 1

      // 7. Show generated prose immediately in subtitle quote
      const firstPara = newThread.paragraphs[0] || '...'
      setCurrentSubtitle(firstPara)

      // 8. Eagerly send to TTS and begin playback as soon as playable
      pausedOffsetRef.current = 0
      playQueueItem(playIdx, 0, newQueue)
    } catch (err) {
      console.warn('Question answer notice:', err?.message)
      setPlaybackError("Couldn't explore this question right now.")
      setAudioState('error')
    }
  }

  // Map internal state to single source of truth orb visual state (Requirement 1)
  const getOrbVisualState = () => {
    if (audioState === 'thinking') return 'thinking'
    if (audioState === 'listening') return 'listening'
    if (audioState === 'speaking') return 'speaking'
    if (audioState === 'connecting') return 'connecting'
    if (audioState === 'error') return 'error'
    if (audioState === 'disabled') return 'disabled'
    return 'idle'
  }

  return (
    <div 
      className="audio-player-overlay" 
      role="dialog" 
      aria-modal="true" 
      aria-label={`Listening: ${activeTitle}`}
    >
      {/* ─── Top Header Bar (Clean Minimal Layout) ─── */}
      <header className="audio-player-header">
        <button 
          className="audio-icon-btn" 
          onClick={onClose} 
          aria-label="Back to curated collection"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="audio-header-actions">
          <button 
            className="audio-switch-read-btn" 
            onClick={() => {
              stopAudio()
              onSwitchToRead(topic)
            }}
            title="Switch to reading mode"
            aria-label="Switch to reading mode"
          >
            <BookOpen size={15} />
            <span>Read</span>
          </button>

          <button 
            className={`audio-icon-btn bookmark-btn ${isSaved ? 'saved' : ''}`}
            onClick={() => toggleSaveTopic(topic.id)}
            aria-label={isSaved ? "Remove bookmark" : "Save topic"}
          >
            <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />
          </button>
        </div>
      </header>

      {/* ─── Main Content Canvas: Title -> Blob -> State -> Quote -> Ask ─── */}
      <main className="audio-player-body">
        <div className="audio-content-stage">
          {/* Chapter / Context Label */}
          <div className="audio-chapter-label">
            <span className="chapter-line" />
            <span className="chapter-text">
              {isAnsweringQuestion ? 'CURIOUS INQUIRY' : 'RABBIT HOLE AUDIO JOURNEY'}
            </span>
            <span className="chapter-line" />
          </div>

          {/* Title — Subtly transitions to user question when asked (Requirement 8, 30, 31) */}
          <div className="audio-title-wrapper">
            <AnimatePresence mode="wait">
              <motion.h1 
                key={activeTitle}
                className="audio-topic-title"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeTitle}
              </motion.h1>
            </AnimatePresence>

            {isAnsweringQuestion && (
              <span className="audio-original-topic-hint">
                from: {topic.title}
              </span>
            )}
          </div>

          {/* Primary Interactive Speaking Orb (Requirement 10, 11) */}
          <div 
            className="audio-narrator-stage interactive-orb-stage" 
            onClick={handleToggleOrbPlay}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleToggleOrbPlay()
              }
            }}
            aria-label={isPlaying ? "Click orb to pause" : "Click orb to play"}
            title={isPlaying ? "Click orb to pause" : "Click orb to play"}
          >
            <ParticlesOrb
              state={getOrbVisualState()}
              size={orbSize}
              speed={1}
              colorFrom="#E89A45"
              colorTo="#D96B32"
              levelRef={levelRef}
              label="Narrator orb"
            />
          </div>

          {/* Human-Facing Audio State Label Directly Underneath Orb (Requirement 11) */}
          <div className="audio-state-row">
            <span 
              className="audio-state-pill clickable-pill"
              onClick={handleToggleOrbPlay}
            >
              <span className={`audio-pulse-dot ${isPlaying ? 'active' : ''}`} />
              <span>{HUMAN_AUDIO_STATES[audioState] || 'Idle'}</span>
            </span>
          </div>

          {/* Quoted Narration / Subtitle with Elegant Editorial Transitions */}
          <div className="audio-subtitles-container" aria-live="polite">
            <AnimatePresence mode="wait">
              {playbackError ? (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="audio-friendly-error"
                >
                  <p>{playbackError}</p>
                  <button 
                    className="audio-friendly-retry-btn"
                    onClick={handleToggleOrbPlay}
                  >
                    Try again
                  </button>
                </motion.div>
              ) : currentSubtitle && (isPlaying || audioState === 'speaking' || audioState === 'thinking') ? (
                <motion.p 
                  key={currentSubtitle}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="audio-quote-subtitle"
                >
                  {audioState === 'thinking' ? '...' : `“${currentSubtitle}”`}
                </motion.p>
              ) : (
                <motion.p 
                  key="cue"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  exit={{ opacity: 0 }}
                  className="audio-quote-placeholder"
                >
                  {isPlaying ? '...' : '“Click orb to begin this audio journey”'}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Ask Something Action Button */}
          <div className="audio-ask-section">
            <button 
              className="audio-ask-trigger-btn"
              onClick={handleOpenAsk}
              disabled={audioState === 'thinking'}
              aria-label="Ask a question about this topic"
            >
              <MessageSquare size={16} />
              <span>Ask something</span>
            </button>
          </div>
        </div>
      </main>

      {/* ─── Ask Something Curiosity Drawer (Requirement 8) ─── */}
      <AnimatePresence>
        {isAsking && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="audio-ask-overlay"
            role="dialog"
            aria-label="Ask a curiosity question"
          >
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="audio-ask-card"
            >
              <div className="audio-ask-card-header">
                <div className="audio-ask-badge">
                  <Sparkles size={13} />
                  <span>Curiosity Question</span>
                </div>
                <button 
                  className="audio-ask-close-btn" 
                  onClick={handleCancelAsk}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="audio-ask-interactive-layer">
                <p className="audio-ask-subtitle">
                  Choose a direction or type your own question:
                </p>

                <div className="audio-suggested-prompts-list">
                  {(canonical?.prompts || [
                    'What is really happening underneath?',
                    'What happens when the sensors disagree?',
                    'Why is this so difficult in real life?'
                  ]).map((prompt, i) => (
                    <button
                      key={i}
                      className="audio-suggested-prompt-btn"
                      onClick={() => handleQuestionSubmit(prompt)}
                    >
                      <span className="prompt-num">0{i + 1}</span>
                      <span className="prompt-text">{prompt}</span>
                    </button>
                  ))}
                </div>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleQuestionSubmit(userQuestion)
                  }} 
                  className="audio-custom-ask-form"
                >
                  <input
                    type="text"
                    value={userQuestion}
                    onChange={(e) => setUserQuestion(e.target.value)}
                    placeholder="Ask something specific..."
                    className="audio-custom-ask-input"
                    maxLength={140}
                    autoFocus
                  />
                  <button 
                    type="submit" 
                    className="audio-custom-ask-submit"
                    disabled={!userQuestion.trim()}
                    aria-label="Submit question"
                  >
                    <Send size={15} />
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
