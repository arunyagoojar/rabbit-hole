import { useRef, useState, useEffect, useCallback } from 'react'
import { Loader, Plus, X, ChevronDown } from 'lucide-react'
import { useCachedImage } from '../hooks/useCachedImage'
import { TOPIC_GRADIENTS } from '../data/gradients'
import { generateRabbitHoleStep, generateTopicStarter } from '../services/aiService'
import { useAuth } from '../contexts/AuthContext'
import { saveTopics } from '../services/db'

/**
 * ReadingOverlay - branching reading experience with multi-page content.
 *
 * Flow:
 * 1. Hero page: image, title, short description, tags, arrow.
 * 2. Content cards: AI generates multiple pages per topic step.
 *    - Only the LAST page of each step shows the 3 follow-up prompts.
 *    - Earlier pages show a "keep reading" indicator.
 * 3. Every selected question generates the next multi-page step.
 */
export default function ReadingOverlay({ topic, onClose }) {
  const scrollRef = useRef(null)
  const [currentCard, setCurrentCard] = useState(0)
  const [showScrollHint, setShowScrollHint] = useState(true)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [cards, setCards] = useState(() => topic?.content || [])
  const [starterLoading, setStarterLoading] = useState(false)
  const [generatingPrompt, setGeneratingPrompt] = useState('')
  const [starterError, setStarterError] = useState('')
  const [generationError, setGenerationError] = useState('')

  const { userData } = useAuth()
  const latestHistorySession = getLatestHistorySession(userData?.readHistory, topic)
  
  const totalScreens = cards.length + 1
  const bgImage = useCachedImage(topic?.imageUrl, topic?.imageQuery || topic?.id)
  const primaryCategory = topic?.category || topic?.tags?.[0]
  const gradient = TOPIC_GRADIENTS[primaryCategory] || 'linear-gradient(135deg, #1a1a1a, #333)'
  const progressPct = totalScreens > 1 ? (currentCard / (totalScreens - 1)) : 0
  const cardsRead = Math.min(currentCard, cards.length)

  useEffect(() => {
    let cancelled = false
    const savedCards = Array.isArray(topic?.content) ? topic.content : []
    const historyCards = Array.isArray(latestHistorySession?.cards) ? latestHistorySession.cards : []

    // Build intro cards from pre-existing introBody (legacy single-body format)
    const apiIntroCards = topic?.introBody
      ? expandPagesToCards({
          pages: [topic.introBody],
          prompts: topic?.introPrompts?.length ? topic.introPrompts.slice(0, 3) : getFallbackPrompts()
        }, topic?.id || 'topic', null)
      : []

    const initialCards = savedCards.length > 0
      ? savedCards
      : historyCards.length > 0 ? historyCards : apiIntroCards

    setCards(initialCards)
    setShowScrollHint(true)
    setImgLoaded(false)
    setStarterLoading(false)
    setGeneratingPrompt('')
    setStarterError('')
    setGenerationError('')

    // Resume reading from the latest session in history
    let resumeIndex = 0;
    if (latestHistorySession) {
      resumeIndex = Math.min(latestHistorySession.cardsRead || 0, initialCards.length)
    }
    
    setCurrentCard(resumeIndex)
    if (resumeIndex > 0) {
      setTimeout(() => scrollToScreen(resumeIndex), 100)
    }

    if (savedCards.length > 0 || historyCards.length > 0 || apiIntroCards.length > 0) {
      return () => { cancelled = true }
    }

    setStarterLoading(true)
    generateTopicStarter(topic)
      .then(starter => {
        if (cancelled) return
        const pages = starter?.pages || (starter?.intro ? [starter.intro] : [])
        const prompts = starter?.prompts?.length ? starter.prompts.slice(0, 3) : getFallbackPrompts()
        const newCards = expandPagesToCards({ pages, prompts }, topic?.id || 'topic', null)
        setCards(newCards)
      })
      .catch(err => {
        if (cancelled) return
        console.error('Failed to generate topic starter:', err)
        setStarterError('Could not generate this rabbit hole. Check the API connection and try again.')
      })
      .finally(() => {
        if (!cancelled) setStarterLoading(false)
      })

    return () => { cancelled = true }
  }, [topic?.id])

  // Save generated content back to IndexedDB whenever cards update
  useEffect(() => {
    if (!topic || cards.length === 0) return
    // Only save if the cards actually changed compared to the topic's initial state
    const isDifferent = !topic.content || topic.content.length !== cards.length
    if (isDifferent) {
      saveTopics([{ ...topic, content: cards }]).catch(console.error)
    }
  }, [cards, topic])

  useEffect(() => {
    const t = setTimeout(() => setShowScrollHint(false), 3000)
    return () => clearTimeout(t)
  }, [topic?.id])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    const index = Math.round(el.scrollTop / el.clientHeight)
    setCurrentCard(Math.min(index, totalScreens - 1))
  }, [totalScreens])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const scrollToScreen = useCallback((screenIndex) => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      el.scrollTo({
        top: screenIndex * el.clientHeight,
        behavior: 'smooth'
      })
    })
  }, [])

  const handlePromptSelect = useCallback(async (prompt) => {
    if (!prompt || generatingPrompt) return

    const previousCards = cards
    setGeneratingPrompt(prompt)
    setGenerationError('')

    try {
      const step = await generateRabbitHoleStep(topic, prompt, previousCards)
      const pages = step?.pages || (step?.body ? [step.body] : [])
      const prompts = step?.prompts?.length ? step.prompts.slice(0, 3) : getFallbackPrompts()
      const newCards = expandPagesToCards({ pages, prompts }, Date.now(), prompt)

      setCards(prev => {
        const next = [...prev, ...newCards]
        // Scroll to the first new card
        setTimeout(() => scrollToScreen(prev.length + 1), 40)
        return next
      })
    } catch (err) {
      console.error('Failed to generate rabbit hole step:', err)
      setGenerationError('Could not generate the next card. Try again in a moment.')
    } finally {
      setGeneratingPrompt('')
    }
  }, [cards, generatingPrompt, scrollToScreen, topic])

  const retryStarter = useCallback(() => {
    setStarterError('')
    setStarterLoading(true)
    generateTopicStarter(topic)
      .then(starter => {
        const pages = starter?.pages || (starter?.intro ? [starter.intro] : [])
        const prompts = starter?.prompts?.slice(0, 3) || []
        const newCards = expandPagesToCards({ pages, prompts }, topic?.id || 'topic', null)
        setCards(newCards)
      })
      .catch(err => {
        console.error('Failed to regenerate topic starter:', err)
        setStarterError('Could not generate this rabbit hole. Check the API connection and try again.')
      })
      .finally(() => setStarterLoading(false))
  }, [topic])

  const closeWithProgress = useCallback(() => {
    onClose(buildClosePayload(topic, cards, cardsRead))
  }, [cards, cardsRead, onClose, topic])

  return (
    <div
      className="reading-overlay entering"
      ref={scrollRef}
      aria-label={`Reading: ${topic?.title}`}
    >
      <button
        className="reading-close"
        onClick={closeWithProgress}
        aria-label="Close reading view"
      >
        <X size={18} />
      </button>

      <div className="reading-progress" aria-hidden="true">
        <div className="progress-track">
          <div
            className="progress-dot"
            style={{ top: `${progressPct * 104}px` }}
          />
        </div>
      </div>

      <section className="reading-card hook-card" aria-label="Topic overview">
        <div
          className="hook-bg"
          style={{ background: gradient }}
          aria-hidden="true"
        />

        {bgImage && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `url(${bgImage})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.8s ease',
              zIndex: 0
            }}
            aria-hidden="true"
          />
        )}

        {bgImage && (
          <img
            src={bgImage}
            alt=""
            style={{ display: 'none' }}
            onLoad={() => setImgLoaded(true)}
          />
        )}

        <div
          className="hook-overlay"
          style={{ background: bgImage ? 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.72) 46%, rgba(0,0,0,0.28) 100%)' : undefined }}
          aria-hidden="true"
        />

        <div className="hook-content hero-only">
          <h1 className="hook-title">{topic?.title}</h1>
          <p className="hook-intro hero-description">
            {topic?.description || topic?.hook || 'A question that starts simple, then opens into a much deeper system.'}
          </p>
          {topic?.tags && (
            <div className="hook-tags hero-tags">
              {topic.tags.slice(0, 4).map(tag => (
                <span key={tag} className="card-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>

        <button
          className="scroll-hint hero-scroll-button"
          style={{
            opacity: showScrollHint ? 1 : 0.82,
            transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onClick={() => scrollToScreen(1)}
          aria-label="Scroll to introduction"
        >
          <div className="scroll-line" />
          <span className="scroll-hint-text">↓</span>
        </button>
      </section>

      {starterLoading && cards.length === 0 ? (
        <section className="reading-card content-card branch-card" aria-label="Generating introduction">
          <div className="branch-card-inner intro-card-inner">
            <div className="ai-loading-card">
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Generating the first thread...
              </p>
              <div className="skeleton-line full" />
              <div className="skeleton-line full" />
              <div className="skeleton-line medium" />
            </div>
          </div>
        </section>
      ) : starterError && cards.length === 0 ? (
        <section className="reading-card content-card branch-card" aria-label="Generation failed">
          <div className="branch-card-inner intro-card-inner">
            <div className="branch-error-state">
              <p>{starterError}</p>
              <button className="branch-retry-btn" onClick={retryStarter}>
                Retry
              </button>
            </div>
          </div>
        </section>
      ) : (
        cards.map((card, index) => (
          <BranchCard
            key={card.id || index}
            card={card}
            isIntro={card.isIntro}
            isContinuation={card.isContinuation}
            isLastOfGroup={card.isLastOfGroup}
            generatingPrompt={generatingPrompt}
            generationError={index === cards.length - 1 ? generationError : ''}
            onPromptSelect={handlePromptSelect}
            onContinue={() => scrollToScreen(index + 2)}
          />
        ))
      )}
    </div>
  )
}

function BranchCard({ card, isIntro, isContinuation, isLastOfGroup, generatingPrompt, generationError, onPromptSelect, onContinue }) {
  const paragraphs = splitParagraphs(card.body)

  return (
    <section
      className={`reading-card content-card branch-card${isIntro ? ' intro-branch-card' : ''}`}
      aria-label={card.heading || 'Content'}
    >
      <div className={`branch-card-inner${isIntro ? ' intro-card-inner' : ''}`}>
        <div className="branch-card-content-wrapper">
          {card.heading && !isContinuation && (
            <h2 className="branch-card-title">{card.heading}</h2>
          )}

          <div className="branch-card-copy">
            {paragraphs.map((para, index) => (
              <p key={index} className="card-body">
                {para}
              </p>
            ))}
          </div>
        </div>

        <div className="branch-card-actions">
          {/* Only show prompts on the last card of each content group */}
          {isLastOfGroup ? (
            <>
              <QuestionChoices
                prompts={card.prompts || getFallbackPrompts()}
                generatingPrompt={generatingPrompt}
                onPromptSelect={onPromptSelect}
              />
              {generationError && (
                <p className="branch-generation-error" role="alert">{generationError}</p>
              )}
            </>
          ) : (
            <button
              className="continue-reading-hint"
              onClick={onContinue}
              aria-label="Continue reading"
            >
              <span className="continue-reading-text">Keep reading</span>
              <ChevronDown size={16} className="continue-reading-icon" />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function QuestionChoices({ prompts, generatingPrompt, onPromptSelect }) {
  const [showCustom, setShowCustom] = useState(false)
  const [customText, setCustomText] = useState('')
  const isGenerating = Boolean(generatingPrompt)

  const submitCustom = () => {
    const value = customText.trim()
    if (value) {
      onPromptSelect(value)
      setCustomText('')
      setShowCustom(false)
    }
  }

  return (
    <div className="branch-choice-row">
      {prompts.slice(0, 3).map((prompt, index) => (
        <button
          key={prompt}
          className={`branch-choice${index === 0 ? ' primary' : ''}`}
          onClick={() => onPromptSelect(prompt)}
          disabled={isGenerating}
        >
          {generatingPrompt === prompt ? (
            <Loader size={14} className="prompts-spinner" />
          ) : prompt}
        </button>
      ))}

      {!showCustom ? (
        <button
          className="branch-choice branch-choice-plus"
          onClick={() => setShowCustom(true)}
          disabled={isGenerating}
          aria-label="Ask your own question"
        >
          <Plus size={15} />
        </button>
      ) : (
        <div className="branch-choice-input">
          <input
            value={customText}
            onChange={event => setCustomText(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') submitCustom()
            }}
            placeholder="Ask your own question"
            maxLength={120}
            autoFocus
          />
          <button onClick={submitCustom} disabled={!customText.trim() || isGenerating}>
            Go
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Expand an AI response with pages[] and prompts[] into individual card objects.
 * Only the last card in the group gets prompts.
 */
function expandPagesToCards({ pages, prompts }, idPrefix, heading) {
  if (!pages || pages.length === 0) {
    return [{
      id: `${idPrefix}-1`,
      card_number: 1,
      heading,
      body: '',
      pages: [],
      prompts: prompts || getFallbackPrompts(),
      isIntro: !heading,
      isContinuation: false,
      isLastOfGroup: true
    }]
  }

  return pages.map((pageBody, index) => ({
    id: `${idPrefix}-page-${index + 1}`,
    card_number: index + 1,
    heading: heading,
    body: pageBody,
    pages,
    prompts: index === pages.length - 1 ? (prompts || getFallbackPrompts()) : [],
    isIntro: !heading && index === 0,
    isContinuation: index > 0,
    isLastOfGroup: index === pages.length - 1
  }))
}

function splitParagraphs(body) {
  const text = typeof body === 'string' ? body.trim() : ''
  if (!text) return ['The thread could not be generated yet. Try another question or retry in a moment.']
  return text.split(/\n{2,}/).map(part => part.trim()).filter(Boolean)
}

function getLatestHistorySession(readHistory, topic) {
  if (!readHistory || !topic) return null

  const topicTitle = normalizeTitle(topic.title)

  return Object.values(readHistory)
    .filter(session => {
      if (!session || typeof session !== 'object') return false
      return session.topicId === topic.id || normalizeTitle(session.title) === topicTitle
    })
    .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0))[0] || null
}

function normalizeTitle(title = '') {
  return String(title).trim().toLowerCase()
}

function buildClosePayload(topic, cards, cardsRead) {
  return {
    cardsRead,
    totalCards: cards.length,
    selectedPrompt: cards[cards.length - 1]?.heading || null,
    cards,
    topicSnapshot: {
      id: topic?.id,
      title: topic?.title,
      description: topic?.description,
      category: topic?.category || topic?.tags?.[0],
      tags: topic?.tags || [],
      imageTags: topic?.imageTags || [],
      introBody: topic?.introBody,
      introPrompts: topic?.introPrompts || [],
      imageQuery: topic?.imageQuery,
      imageUrl: topic?.imageUrl
    }
  }
}

function getFallbackPrompts() {
  return [
    'What is really happening underneath?',
    'What would break first?',
    'Why does this matter every day?'
  ]
}
