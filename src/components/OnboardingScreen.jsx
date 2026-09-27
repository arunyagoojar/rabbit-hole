import { useState } from 'react'
import { Target, Layers, Sparkles } from 'lucide-react'
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
    { Icon: Target, text: 'Pick a topic that catches your eye' },
    { Icon: Layers, text: 'Read through cards — each one goes deeper' },
    { Icon: Sparkles, text: 'Go as far down the rabbit hole as you want' },
  ]

  return (
    <div className="how-it-works">
      <div className="hiw-items">
        {items.map((item, i) => (
          <div key={i} className="hiw-item">
            <span className="hiw-icon" aria-hidden="true">
              <item.Icon size={24} strokeWidth={1.8} />
            </span>
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
  const { loginWithGoogle, loginWithApple, loginWithEmail, signUpWithEmail } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showEmail, setShowEmail] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await loginWithGoogle()
      onNext()
    } catch (err) {
      console.error(err)
      setError('Google Sign-In failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAppleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await loginWithApple()
      onNext()
    } catch (err) {
      console.error(err)
      setError('Apple Sign-In configuration is pending in Firebase Console.')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password)
      } else {
        await loginWithEmail(email, password)
      }
      onNext()
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Email authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-step page-enter">
      <div className="auth-brand">
        <div className="auth-rabbit" aria-hidden="true">
          <Sparkles size={26} strokeWidth={1.8} />
        </div>
        <h2 className="auth-heading">
          Keep your learning<br />synchronized
        </h2>
        <p className="auth-sub">
          Connect your account to sync your streak, saved topics, and reading history across devices.
        </p>
      </div>

      <div className="auth-choices">
        {error && <p className="auth-error-msg" role="alert">{error}</p>}

        {!showEmail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
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

            <button 
              className="login-auth-btn" 
              onClick={handleAppleLogin}
              disabled={loading}
            >
              <svg className="apple-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.87-.9.04-2 .6-2.65 1.36-.58.67-1.09 1.74-.95 2.78 1.01.08 2.06-.52 2.68-1.27z" />
              </svg>
              <span>Continue with Apple</span>
            </button>

            <button 
              className="login-auth-btn" 
              onClick={() => setShowEmail(true)}
              disabled={loading}
            >
              <span>Continue with Email</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
            <button
              type="submit"
              className="login-auth-btn"
              style={{ background: 'var(--text-primary)', color: 'var(--bg)', fontWeight: '600' }}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
              >
                {isSignUp ? 'Already have an account? Sign In' : "Need an account? Sign Up"}
              </button>
              <button
                type="button"
                onClick={() => setShowEmail(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
              >
                ← Back
              </button>
            </div>
          </form>
        )}

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
            <strong>Note:</strong> Your data will only be stored locally on this device. Sign in to sync your progress.
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
