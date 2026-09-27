import { useState, useEffect, useCallback } from 'react'
import SplashScreen from './components/SplashScreen'
import OnboardingScreen from './components/OnboardingScreen'
import TopBar from './components/TopBar'
import BottomNav from './components/BottomNav'
import ExplorePage from './pages/ExplorePage'
import SavedPage from './pages/SavedPage'
import TimelinePage from './pages/TimelinePage'
import ReadingOverlay from './components/ReadingOverlay'
import AudioOnlyPlayer from './components/AudioOnlyPlayer'
import ConsumeModeModal from './components/ConsumeModeModal'
import ExploreMorePage from './pages/ExploreMorePage'
import AdminAnalyticsPage from './pages/AdminAnalyticsPage'
import LoginModal from './components/LoginModal'
import ApiKeyModal from './components/ApiKeyModal'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { analytics } from './services/analyticsService'

/**
 * AppContent — handles the main page shell, utilizing the AuthContext state
 */
function AppContent() {
  const { 
    userData, 
    loading, 
    isOnboarded,
    toggleTheme: syncTheme,
    markOnboarded,
    completeTopic
  } = useAuth()

  // ─── Theme ───
  const theme = userData?.theme || 'dark'

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light')
  }, [theme])

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    syncTheme(next)
  }, [theme, syncTheme])

  // ─── Modals ───
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false)

  // ─── Onboarding ───
  const [onboardingStep, setOnboardingStep] = useState(() => {
    const alreadyOnboarded = localStorage.getItem('rh-onboarded') === '1'
    return alreadyOnboarded ? 'done' : 'splash'
  })

  useEffect(() => {
    if (!loading && isOnboarded) {
      setOnboardingStep('done')
    }
  }, [loading, isOnboarded])

  const handleSplashComplete = useCallback(() => {
    setOnboardingStep('howItWorks')
  }, [])

  const handleHowItWorksDone = useCallback(() => {
    setOnboardingStep('auth')
  }, [])

  const handleAuthDone = useCallback(() => {
    setOnboardingStep('apiKey')
  }, [])

  const handleApiKeyDone = useCallback(() => {
    setOnboardingStep('interests')
  }, [])

  const handleInterestsDone = useCallback(() => {
    markOnboarded()
    setOnboardingStep('done')
  }, [markOnboarded])

  // ─── Navigation & Views ───
  const [activeTab, setActiveTab] = useState('explore')
  const [isExploreMoreOpen, setIsExploreMoreOpen] = useState(false)
  const [showAdmin, setShowAdmin] = useState(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search || ''
      const pathname = window.location.pathname || ''
      return search.includes('admin=') || pathname.includes('/admin')
    }
    return false
  })

  // ─── Topic Consumption Selection ───
  const [modeModalTopic, setModeModalTopic] = useState(null)
  const [readingTopic, setReadingTopic] = useState(null)
  const [audioTopic, setAudioTopic] = useState(null)

  // Triggered whenever a title or topic card is clicked
  const handleOpenTopic = useCallback((topic) => {
    setModeModalTopic(topic)
  }, [])

  const handleSelectConsumeMode = useCallback((mode, topic) => {
    setModeModalTopic(null)
    analytics.startTopicSession(topic.id, mode)

    if (mode === 'audio') {
      setReadingTopic(null)
      setAudioTopic(topic)
    } else {
      setAudioTopic(null)
      setReadingTopic(topic)
    }
  }, [])

  const closeReading = useCallback((closePayload, legacyTotalCards) => {
    if (readingTopic) {
      const payload = typeof closePayload === 'object' && closePayload !== null
        ? closePayload
        : { cardsRead: closePayload, totalCards: legacyTotalCards }
      const normalizedTotal = Number.isFinite(payload.totalCards)
        ? payload.totalCards
        : readingTopic.content?.length || 1
      const normalizedCardsRead = Number.isFinite(payload.cardsRead) ? payload.cardsRead : normalizedTotal
      const generatedCards = Array.isArray(payload.cards) ? payload.cards : []
      const exploredCardsRead = normalizedCardsRead > 0
        ? normalizedCardsRead
        : generatedCards.length > 0 ? 1 : 1

      if (exploredCardsRead > 0) {
        completeTopic(
          readingTopic.id,
          readingTopic.title,
          readingTopic.category || readingTopic.tags?.[0],
          exploredCardsRead,
          normalizedTotal,
          {
            selectedPrompt: payload.selectedPrompt,
            cards: generatedCards,
            topicSnapshot: payload.topicSnapshot || readingTopic
          }
        )
      }
    }
    setReadingTopic(null)
  }, [readingTopic, completeTopic])

  const closeAudio = useCallback(() => {
    setAudioTopic(null)
  }, [])

  // ─── Render ───
  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-spinner">
          <div className="spinner-orbit">
            <div className="spinner-dot" />
          </div>
          <span className="loading-wordmark">rabbit hole</span>
        </div>
      </div>
    )
  }

  const showOnboarding = onboardingStep !== 'done'
  const isImmersiveOpen = Boolean(readingTopic || audioTopic || isExploreMoreOpen || showAdmin)

  return (
    <div className="app-shell">
      {/* Onboarding Screens */}
      {onboardingStep === 'splash' && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}
      {onboardingStep === 'howItWorks' && (
        <OnboardingScreen
          step="howItWorks"
          onNext={handleHowItWorksDone}
        />
      )}
      {onboardingStep === 'auth' && (
        <OnboardingScreen
          step="auth"
          onNext={handleAuthDone}
        />
      )}
      {onboardingStep === 'apiKey' && (
        <OnboardingScreen
          step="apiKey"
          onNext={handleApiKeyDone}
        />
      )}
      {onboardingStep === 'interests' && (
        <OnboardingScreen
          step="interests"
          onNext={handleInterestsDone}
        />
      )}

      {/* Main App */}
      {!showOnboarding && (
        <>
          {/* Top Bar (Hidden when in immersive reader / audio / explore-more / admin) */}
          {!isImmersiveOpen && (
            <TopBar 
              theme={theme} 
              onToggleTheme={toggleTheme} 
              onOpenLogin={() => setLoginModalOpen(true)}
              onOpenApiKey={() => setApiKeyModalOpen(true)}
              onOpenInterests={() => setOnboardingStep('interests')}
            />
          )}

          <main className="page-content">
            {/* Hidden Admin Analytics View */}
            {showAdmin ? (
              <AdminAnalyticsPage onBack={() => setShowAdmin(false)} />
            ) : isExploreMoreOpen ? (
              /* Dedicated Finite Explore More Subpage */
              <ExploreMorePage
                onBack={() => setIsExploreMoreOpen(false)}
                onOpenTopic={handleOpenTopic}
              />
            ) : (
              /* Standard Tabs */
              <>
                {activeTab === 'explore' && (
                  <ExplorePage
                    onOpenTopic={handleOpenTopic}
                    onNavigateExploreMore={() => setIsExploreMoreOpen(true)}
                  />
                )}
                {activeTab === 'saved' && (
                  <SavedPage
                    onOpenTopic={handleOpenTopic}
                  />
                )}
                {activeTab === 'timeline' && (
                  <TimelinePage />
                )}
              </>
            )}
          </main>

          {/* Bottom Navigation */}
          <BottomNav
            activeTab={activeTab}
            onTabChange={(tab) => {
              setIsExploreMoreOpen(false)
              setShowAdmin(false)
              setActiveTab(tab)
            }}
            hidden={isImmersiveOpen}
          />

          {/* Prompt: How to consume topic? (Reading vs Audio) */}
          <ConsumeModeModal
            topic={modeModalTopic}
            isOpen={Boolean(modeModalTopic)}
            onClose={() => setModeModalTopic(null)}
            onSelectMode={handleSelectConsumeMode}
          />

          {/* Mode 1: Continuous Single-Page Reading Experience */}
          {readingTopic && (
            <ReadingOverlay
              topic={readingTopic}
              onClose={closeReading}
              onSwitchToAudio={(topic) => {
                setReadingTopic(null)
                setAudioTopic(topic)
              }}
            />
          )}

          {/* Mode 2: Audio-Only Player */}
          {audioTopic && (
            <AudioOnlyPlayer
              topic={audioTopic}
              onClose={closeAudio}
              onSwitchToRead={(topic) => {
                setAudioTopic(null)
                setReadingTopic(topic)
              }}
            />
          )}

          {/* Auth Modal */}
          <LoginModal
            isOpen={loginModalOpen}
            onClose={() => setLoginModalOpen(false)}
          />

          {/* Google AI API Key Modal */}
          <ApiKeyModal
            isOpen={apiKeyModalOpen}
            onClose={() => setApiKeyModalOpen(false)}
          />
        </>
      )}
    </div>
  )
}

/**
 * App — root component wrapped in AuthProvider
 */
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
