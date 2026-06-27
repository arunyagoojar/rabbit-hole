import { useState } from 'react'
import { INTERESTS } from '../data/interests'
import { useAuth } from '../contexts/AuthContext'

/**
 * OnboardingScreen
 * Handles two steps: "howItWorks" and "interests"
 */
export default function OnboardingScreen({ step, onNext }) {
  return (
    <div className="onboarding-screen">
      {step === 'howItWorks' && <HowItWorksStep onNext={onNext} />}
      {step === 'auth' && <AuthStep onNext={onNext} />}
      {step === 'interests' && <InterestsStep onNext={onNext} />}
    </div>
  )
}

function HowItWorksStep({ onNext }) {
  const items = [
    { icon: '🎯', text: 'Pick a topic that catches your eye' },
    { icon: '📖', text: 'Read through cards — each one goes deeper' },
    { icon: '🐇', text: 'Go as far down the rabbit hole as you want' },
  ]

  return (
    <div className="how-it-works">
      <div className="hiw-items">
        {items.map((item, i) => (
          <div key={i} className="hiw-item">
            <span className="hiw-icon" role="img" aria-hidden="true">{item.icon}</span>
            <p className="hiw-text">{item.text}</p>
          </div>
        ))}
      </div>
      <button className="cta-button" onClick={onNext}>
        Let's go
      </button>
    </div>
  )
}

function AuthStep({ onNext }) {
  const { loginWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await loginWithGoogle()
      onNext()
    } catch (err) {
      console.error(err)
      setError('Connection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-step page-enter">
      <div className="auth-brand">
        <span className="auth-rabbit" role="img" aria-label="Rabbit icon">🐇</span>
        <h2 className="auth-heading">
          Keep your learning<br />synchronized
        </h2>
        <p className="auth-sub">
          Connect your account to sync your streak, saved topics, and reading history across devices.
        </p>
      </div>

      <div className="auth-choices">
        {error && <p className="auth-error-msg" role="alert">{error}</p>}

        <button 
          className="login-auth-btn" 
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <span className="spinner" />
          ) : (
            <>
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 14.99.75 12 .75 7.28.75 3.25 3.47 1.24 7.42l3.8 2.95C5.92 7.37 8.73 5.04 12 5.04z" />
                <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.65 2.83c2.14-1.97 3.37-4.87 3.37-8.51z" />
                <path fill="#FBBC05" d="M5.04 14.77c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27L1.24 7.28C.45 8.87 0 10.64 0 12.5s.45 3.63 1.24 5.22l3.8-2.95z" />
                <path fill="#34A853" d="M12 23.25c3.24 0 5.97-1.08 7.96-2.91l-3.65-2.83c-1.01.68-2.31 1.09-4.31 1.09-3.27 0-6.08-2.33-7.07-5.46l-3.8 2.95c2.01 3.95 6.04 6.66 10.76 6.66z" />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <div className="auth-separator">
          <span>or</span>
        </div>

        <button 
          className="auth-guest-btn" 
          onClick={onNext}
          disabled={loading}
        >
          Continue as Guest
        </button>

        <div className="auth-guest-warning">
          <p>
            <strong>Note:</strong> Your data will only be stored on your device and you might lose it. For saving your data, we highly recommend using Google authentication.
          </p>
        </div>
      </div>
    </div>
  )
}

function InterestsStep({ onNext }) {
  const { updateInterests, userData, isOnboarded } = useAuth()
  const [selected, setSelected] = useState(userData?.interests || [])

  const toggle = (interest) => {
    setSelected(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    )
  }

  const handleDone = async () => {
    try {
      await updateInterests(selected)
      onNext()
    } catch (err) {
      console.error('Failed to save interests:', err)
      onNext() // Proceed even if write fails
    }
  }

  return (
    <div className="interest-screen page-enter-slide">
      <h2 className="interest-heading">
        What worlds do you want<br />to explore?
      </h2>
      <p className="interest-sub">
        Pick as many as you like. You can change this anytime.
      </p>

      <div className="interest-pills" role="group" aria-label="Select your interests">
        {INTERESTS.map(interest => (
          <button
            key={interest.id}
            className={`interest-pill${selected.includes(interest.name) ? ' selected' : ''}`}
            onClick={() => toggle(interest.name)}
            aria-pressed={selected.includes(interest.name)}
            title={interest.description}
          >
            {interest.name}
          </button>
        ))}
      </div>

      <div className={`done-button-wrap${selected.length > 0 || isOnboarded ? ' visible' : ''}`} style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        {isOnboarded && (
          <button
            className="cta-button"
            onClick={onNext}
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
        )}
        <button
          className="cta-button"
          onClick={handleDone}
          disabled={selected.length === 0}
          aria-disabled={selected.length === 0}
        >
          Done →
        </button>
      </div>
    </div>
  )
}
