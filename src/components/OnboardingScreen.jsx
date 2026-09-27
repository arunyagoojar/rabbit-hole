import { useState } from 'react'
import { Target, Layers, Sparkles, Key, ExternalLink, Eye, EyeOff, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { INTERESTS } from '../data/interests'
import { useAuth } from '../contexts/AuthContext'

/**
 * OnboardingScreen
 * Handles steps: "howItWorks", "auth", "apiKey", and "interests"
 */
export default function OnboardingScreen({ step, onNext }) {
  return (
    <div className="onboarding-screen">
      {step === 'howItWorks' && <HowItWorksStep onNext={onNext} />}
      {step === 'auth' && <AuthStep onNext={onNext} />}
      {step === 'apiKey' && <ApiKeyStep onNext={onNext} />}
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

function ApiKeyStep({ onNext }) {
  const { user, geminiApiKey, updateGeminiApiKey } = useAuth()
  const [inputKey, setInputKey] = useState(geminiApiKey || '')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleTestKey = async () => {
    const key = inputKey.trim()
    if (!key) {
      setTestResult({ valid: false, message: 'Please enter a Google AI Studio API key.' })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`)
      if (res.ok) {
        setTestResult({
          valid: true,
          message: 'Key successfully verified with Google AI! Ready for real-time text & voice narration.'
        })
      } else {
        const errorData = await res.json().catch(() => null)
        const reason = errorData?.error?.message || `HTTP ${res.status}`
        setTestResult({
          valid: false,
          message: `Google API rejected this key: ${reason}`
        })
      }
    } catch (err) {
      setTestResult({
        valid: false,
        message: `Connection failed: ${err?.message || 'Check your internet connection'}`
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSaveAndContinue = async () => {
    setSaving(true)
    try {
      if (inputKey.trim()) {
        await updateGeminiApiKey(inputKey.trim())
      }
      onNext()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="api-key-step page-enter">
      <div className="auth-brand" style={{ marginBottom: '24px' }}>
        <div className="auth-rabbit" aria-hidden="true">
          <Key size={24} strokeWidth={1.8} />
        </div>
        <h2 className="auth-heading">
          Connect your Google AI Key
        </h2>
        <p className="auth-sub">
          Power instant deep curiosity cards and ultra-fast neural voice narration (TTS) directly through your personal key.
        </p>

        <div className="api-key-account-badge" style={{ marginTop: '14px' }}>
          <span className={`status-dot ${user ? 'active' : 'guest'}`} />
          <span>{user ? `Aligned with ${user.email || user.displayName || 'your account'}` : 'Saved locally on this device'}</span>
        </div>
      </div>

      <div className="api-steps-container">
        {/* Step 1 */}
        <div className="api-step-row">
          <span className="api-step-num">1</span>
          <div className="api-step-content">
            <p className="api-step-title">Get your free API key</p>
            <p className="api-step-desc">Open Google AI Studio with your Google account (100% free, no credit card required).</p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="api-key-external-link"
            >
              <span>Open Google AI Studio</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Step 2 */}
        <div className="api-step-row">
          <span className="api-step-num">2</span>
          <div className="api-step-content">
            <p className="api-step-title">Create & copy the key</p>
            <p className="api-step-desc">Click <strong>Create API key</strong>, choose or create a project, and copy the key string.</p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="api-step-row">
          <span className="api-step-num">3</span>
          <div className="api-step-content">
            <p className="api-step-title">Paste your key below</p>
            <div className="api-key-input-wrap">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="AIzaSy..."
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value)
                  setTestResult(null)
                }}
                className="api-key-input"
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="button"
                className="api-key-icon-btn"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Hide key' : 'Show key'}
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {inputKey && (
                <button
                  type="button"
                  className="api-key-icon-btn"
                  onClick={() => {
                    setInputKey('')
                    setTestResult(null)
                  }}
                  title="Clear text"
                  aria-label="Clear text"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                className="api-key-test-btn"
                onClick={handleTestKey}
                disabled={testing || !inputKey.trim()}
              >
                {testing ? <span className="spinner-sm" /> : 'Test Key'}
              </button>
            </div>

            {testResult && (
              <div className={`api-key-feedback ${testResult.valid ? 'success' : 'error'}`}>
                {testResult.valid ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '24px' }}>
        <button
          className="cta-button"
          onClick={handleSaveAndContinue}
          disabled={saving}
        >
          {saving ? <span className="spinner" /> : (inputKey.trim() ? 'Save & Continue' : 'Continue')}
        </button>

        <button
          type="button"
          className="api-key-skip-btn"
          onClick={onNext}
          disabled={saving}
        >
          Skip for now (use default key)
        </button>

        <p className="api-key-disclaimer">
          Your key is saved privately with your account. You can change or remove it anytime in settings.
        </p>
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
