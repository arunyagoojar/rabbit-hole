import { X, Mail, ArrowRight, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

export default function LoginModal({ isOpen, onClose }) {
  const { loginWithGoogle, loginWithApple, loginWithEmail, signUpWithEmail } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [authMode, setAuthMode] = useState('social') // 'social' | 'email-signin' | 'email-signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  if (!isOpen) return null

  const handleGoogle = async () => {
    setLoading(true)
    setError(null)
    try {
      await loginWithGoogle()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Google Sign-In was cancelled or failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleApple = async () => {
    setLoading(true)
    setError(null)
    try {
      await loginWithApple()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Apple Sign-In configuration is pending in Firebase Console.')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please fill in both email and password.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      if (authMode === 'email-signup') {
        await signUpWithEmail(email, password, displayName)
      } else {
        await loginWithEmail(email, password)
      }
      onClose()
    } catch (err) {
      console.error(err)
      const msg = err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
        ? 'Invalid email or password.'
        : err.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists. Try signing in.'
        : err.message || 'Authentication failed. Please check your credentials.'
      setError(msg)
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

        {error && <p className="login-modal-error" role="alert">{error}</p>}

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
              onClick={() => setAuthMode('email-signin')}
              disabled={loading}
            >
              <Mail size={18} />
              <span>Continue with Email</span>
            </button>
          </div>
        )}

        {authMode !== 'social' && (
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            {authMode === 'email-signup' && (
              <input
                type="text"
                placeholder="Your Name (Optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
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
            )}

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
              {loading ? (
                <span className="spinner" />
              ) : (
                <>
                  <span>{authMode === 'email-signup' ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '13px' }}>
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'email-signup' ? 'email-signin' : 'email-signup')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
              >
                {authMode === 'email-signup' ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('social')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
              >
                ← Back
              </button>
            </div>
          </form>
        )}

        <p className="login-modal-footer">
          Your learning statistics are kept completely private.
        </p>
      </div>
    </div>
  )
}
