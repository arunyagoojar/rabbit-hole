import { X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

export default function LoginModal({ isOpen, onClose }) {
  const { loginWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await loginWithGoogle()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Failed to connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="login-modal-content page-enter" 
        onClick={(e) => e.stopPropagation()}
      >
        <button className="login-modal-close" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        <div className="login-modal-brand">
          <span className="login-modal-rabbit" role="img" aria-label="Rabbit icon">🐇</span>
          <h2 className="login-modal-title">Down the rabbit hole</h2>
          <p className="login-modal-subtitle">
            Sign in with Google to sync your reading history, preserve your streak, and save interesting topics.
          </p>
        </div>

        {error && <p className="login-modal-error" role="alert">{error}</p>}

        <button 
          className="login-auth-btn" 
          onClick={handleLogin}
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

        <p className="login-modal-footer">
          Your learning statistics are kept completely private.
        </p>
      </div>
    </div>
  )
}
