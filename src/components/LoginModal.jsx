import { X, Mail, ArrowRight, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

function formatFirebaseError(err) {
  if (!err) return 'Authentication failed.'
  const code = err.code || ''
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain'

  switch (code) {
    case 'auth/unauthorized-domain':
      return `This domain (${currentHost}) is not authorized in Firebase Console. Add it in Firebase Console > Authentication > Settings > Authorized domains.`
    case 'auth/operation-not-allowed':
      return 'This sign-in provider is not enabled in Firebase Console (Authentication > Sign-in method).'
    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked by your browser. Please allow popups or use the redirect option below.'
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing.'
    case 'auth/cancelled-popup-request':
      return 'A sign-in request is already in progress.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password. If you do not have an account yet, switch to "Create Account".'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please switch to "Sign In".'
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection.'
    case 'auth/too-many-requests':
      return 'Temporarily disabled due to repeated failed attempts. Please try again later or reset password.'
    default:
      return err.message || 'Authentication failed. Please check your details.'
  }
}

export default function LoginModal({ isOpen, onClose }) {
  const {
    loginWithGoogle,
    loginWithGoogleRedirect,
    loginWithApple,
    loginWithEmail,
    signUpWithEmail,
    resetPassword
  } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [authMode, setAuthMode] = useState('social') // 'social' | 'email-signin' | 'email-signup' | 'forgot-password'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showRedirectOption, setShowRedirectOption] = useState(false)

  if (!isOpen) return null

  const handleGoogle = async () => {
    setLoading(true)
    setError(null)
    setSuccessMsg(null)
    setShowRedirectOption(false)
    try {
      await loginWithGoogle()
      onClose()
    } catch (err) {
      console.error('Google Sign-In failed:', err)
      setError(formatFirebaseError(err))
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        setShowRedirectOption(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleRedirect = async () => {
    setLoading(true)
    setError(null)
    try {
      await loginWithGoogleRedirect()
    } catch (err) {
      console.error('Google Redirect failed:', err)
      setError(formatFirebaseError(err))
      setLoading(false)
    }
  }

  const handleApple = async () => {
    setLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await loginWithApple()
      onClose()
    } catch (err) {
      console.error('Apple Sign-In failed:', err)
      setError(formatFirebaseError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    if (!email) {
      setError('Please provide your email address.')
      return
    }

    if (authMode === 'forgot-password') {
      setLoading(true)
      setError(null)
      setSuccessMsg(null)
      try {
        await resetPassword(email)
        setSuccessMsg(`Password reset email sent to ${email}. Please check your inbox.`)
      } catch (err) {
        console.error('Password reset failed:', err)
        setError(formatFirebaseError(err))
      } finally {
        setLoading(false)
      }
      return
    }

    if (!password) {
      setError('Please provide your password.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      if (authMode === 'email-signup') {
        await signUpWithEmail(email, password, displayName)
      } else {
        await loginWithEmail(email, password)
      }
      onClose()
    } catch (err) {
      console.error('Email authentication failed:', err)
      setError(formatFirebaseError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="login-modal-content page-enter" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '420px', width: '92%' }}
      >
        <button className="login-modal-close" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        <div className="login-modal-brand">
          <div className="login-modal-rabbit" aria-hidden="true">
            <Sparkles size={26} strokeWidth={1.8} />
          </div>
          <h2 className="login-modal-title">Down the rabbit hole</h2>
          <p className="login-modal-subtitle">
            Sign in to sync your learning streak, saved rabbit holes, and history across all your devices.
          </p>
        </div>

        {error && (
          <div className="login-modal-error" role="alert">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="login-modal-success" role="status">
            {successMsg}
          </div>
        )}

        {showRedirectOption && (
          <button
            className="login-auth-btn"
            onClick={handleGoogleRedirect}
            style={{ marginBottom: '14px', background: 'var(--accent)', color: '#fff', border: 'none' }}
          >
            <span>Continue with Google (Redirect)</span>
            <ArrowRight size={16} />
          </button>
        )}

        {authMode === 'social' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            {/* Google */}
            <button 
              className="login-auth-btn" 
              onClick={handleGoogle}
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

            {/* Apple */}
            <button 
              className="login-auth-btn" 
              onClick={handleApple}
              disabled={loading}
            >
              <svg className="apple-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.87-.9.04-2 .6-2.65 1.36-.58.67-1.09 1.74-.95 2.78 1.01.08 2.06-.52 2.68-1.27z" />
              </svg>
              <span>Continue with Apple</span>
            </button>

            {/* Email Switcher */}
            <button
              className="login-auth-btn"
              onClick={() => {
                setError(null)
                setSuccessMsg(null)
                setAuthMode('email-signin')
              }}
              disabled={loading}
            >
              <Mail size={18} />
              <span>Continue with Email</span>
            </button>
          </div>
        )}

        {authMode !== 'social' && (
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            {authMode !== 'forgot-password' && (
              <div className="login-tab-group" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'email-signin'}
                  className={`login-tab-btn ${authMode === 'email-signin' ? 'active' : ''}`}
                  onClick={() => {
                    setError(null)
                    setSuccessMsg(null)
                    setAuthMode('email-signin')
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'email-signup'}
                  className={`login-tab-btn ${authMode === 'email-signup' ? 'active' : ''}`}
                  onClick={() => {
                    setError(null)
                    setSuccessMsg(null)
                    setAuthMode('email-signup')
                  }}
                >
                  Create Account
                </button>
              </div>
            )}

            {authMode === 'forgot-password' && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 4px 0', textAlign: 'left' }}>
                Enter your email address and we will send you a link to reset your password.
              </p>
            )}

            {authMode === 'email-signup' && (
              <input
                type="text"
                placeholder="Your Name (Optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="login-modal-input"
              />
            )}

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="login-modal-input"
              autoFocus
            />

            {authMode !== 'forgot-password' && (
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="login-modal-input"
              />
            )}

            <button
              type="submit"
              className="login-auth-btn"
              style={{ background: 'var(--text-primary)', color: 'var(--bg)', fontWeight: '600', marginTop: '4px' }}
              disabled={loading}
            >
              {loading ? (
                <span className="spinner" />
              ) : (
                <>
                  <span>
                    {authMode === 'email-signup'
                      ? 'Create Account'
                      : authMode === 'forgot-password'
                      ? 'Send Reset Link'
                      : 'Sign In'}
                  </span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '13px' }}>
              {authMode === 'email-signin' ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setSuccessMsg(null)
                    setAuthMode('forgot-password')
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                >
                  Forgot password?
                </button>
              ) : authMode === 'forgot-password' ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setSuccessMsg(null)
                    setAuthMode('email-signin')
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                >
                  Back to Sign In
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setSuccessMsg(null)
                  setShowRedirectOption(false)
                  setAuthMode('social')
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
              >
                ← Back to options
              </button>
            </div>
          </form>
        )}

        <p className="login-modal-footer" style={{ marginTop: '20px' }}>
          Your learning statistics are kept completely private.
        </p>
      </div>
    </div>
  )
}

