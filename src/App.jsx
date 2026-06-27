import { useState, useEffect, useCallback } from 'react'
import SplashScreen from './components/SplashScreen'
import OnboardingScreen from './components/OnboardingScreen'
import TopBar from './components/TopBar'
import BottomNav from './components/BottomNav'
import ExplorePage from './pages/ExplorePage'
import SavedPage from './pages/SavedPage'
import TimelinePage from './pages/TimelinePage'
import ReadingOverlay from './components/ReadingOverlay'
import LoginModal from './components/LoginModal'
import { AuthProvider, useAuth } from './contexts/AuthContext'

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

  // ─── Login Modal ───
  const [loginModalOpen, setLoginModalOpen] = useState(false)

  // ─── Onboarding ───
  // Initialize onboarding step based on whether the user has completed it before.
  // Once set to 'done', it should NEVER go back to 'splash'.
  const [onboardingStep, setOnboardingStep] = useState(() => {
    // Check localStorage directly for immediate answer (no async wait)
    const alreadyOnboarded = localStorage.getItem('rh-onboarded') === '1'
    return alreadyOnboarded ? 'done' : 'splash'
  })

  // When loading finishes, update onboarding step if data says we're onboarded
  // but NEVER reset back to 'splash' once we've moved past it
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
    setOnboardingStep('interests')
  }, [])

  const handleInterestsDone = useCallback(() => {
    markOnboarded()
    setOnboardingStep('done')
  }, [markOnboarded])

  // ─── Navigation ───
  const [activeTab, setActiveTab] = useState('explore')

  // ─── Reading Overlay ───
  const [readingTopic, setReadingTopic] = useState(null)

  const openReading = useCallback((topic) => {
    setReadingTopic(topic)
  }, [])

  const closeReading = useCallback((closePayload, legacyTotalCards) => {
    if (readingTopic) {
      const payload = typeof closePayload === 'object' && closePayload !== null
        ? closePayload
        : { cardsRead: closePayload, totalCards: legacyTotalCards }
      const normalizedTotal = Number.isFinite(payload.totalCards)
        ? payload.totalCards
        : readingTopic.content?.length || 0
      const normalizedCardsRead = Number.isFinite(payload.cardsRead) ? payload.cardsRead : normalizedTotal
      const generatedCards = Array.isArray(payload.cards) ? payload.cards : []
      const exploredCardsRead = normalizedCardsRead > 0
        ? normalizedCardsRead
        : generatedCards.length > 0 ? 1 : 0

      // Log reading history & update streak
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
  const showReading = !!readingTopic

  return (
    <div className="app-shell">
      {/* Onboarding Screens (overlay) */}
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
      {onboardingStep === 'interests' && (
        <OnboardingScreen
          step="interests"
          onNext={handleInterestsDone}
        />
      )}

      {/* Main App */}
      {!showOnboarding && (
        <>
          <TopBar 
            theme={theme} 
            onToggleTheme={toggleTheme} 
            onOpenLogin={() => setLoginModalOpen(true)}
            onOpenInterests={() => setOnboardingStep('interests')}
          />

          <main className="page-content">
            {activeTab === 'explore' && (
              <ExplorePage
                onOpenTopic={openReading}
              />
            )}
            {activeTab === 'saved' && (
              <SavedPage
                onOpenTopic={openReading}
              />
            )}
            {activeTab === 'timeline' && (
              <TimelinePage />
            )}
          </main>

          <BottomNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            hidden={showReading}
          />

          {/* Reading Overlay */}
          {showReading && (
            <ReadingOverlay
              topic={readingTopic}
              onClose={closeReading}
            />
          )}

          {/* Auth Modal */}
          <LoginModal
            isOpen={loginModalOpen}
            onClose={() => setLoginModalOpen(false)}
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
