import { useState, useEffect } from 'react'
import { X, Key, ExternalLink, Eye, EyeOff, CheckCircle2, AlertCircle, Sparkles, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function ApiKeyModal({ isOpen, onClose }) {
  const { user, geminiApiKey, updateGeminiApiKey } = useAuth()
  const [inputKey, setInputKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setInputKey(geminiApiKey || '')
      setTestResult(null)
      setShowKey(false)
    }
  }, [isOpen, geminiApiKey])

  if (!isOpen) return null

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

  const handleSave = async (e) => {
    if (e) e.preventDefault()
    setSaving(true)
    try {
      await updateGeminiApiKey(inputKey.trim())
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setInputKey('')
    setTestResult(null)
    await updateGeminiApiKey('')
  }

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div 
        className="login-modal-card page-enter" 
        style={{ maxWidth: '480px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-modal-title"
      >
        <button 
          className="login-modal-close" 
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        <div className="login-modal-brand" style={{ marginBottom: '20px' }}>
          <div className="login-modal-rabbit" aria-hidden="true" style={{ width: '46px', height: '46px' }}>
            <Key size={22} strokeWidth={1.8} />
          </div>
          <h2 id="api-modal-title" className="login-modal-heading" style={{ fontSize: '24px' }}>
            Google AI Studio Key
          </h2>
          <p className="login-modal-sub" style={{ fontSize: '13px' }}>
            Connect your personal key for instant AI response generation and ultra-fast neural speech (TTS).
          </p>

          <div className="api-key-account-badge" style={{ marginTop: '12px' }}>
            <span className={`status-dot ${user ? 'active' : 'guest'}`} />
            <span>{user ? `Aligned with ${user.email || user.displayName || 'your account'}` : 'Saved locally on this device'}</span>
          </div>
        </div>

        {/* Minimal 3-Step Guide */}
        <div className="api-steps-container">
          <div className="api-step-row">
            <span className="api-step-num">1</span>
            <div className="api-step-content">
              <p className="api-step-title">Get your free API key</p>
              <p className="api-step-desc">Open Google AI Studio with your Google account (100% free, no credit card).</p>
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

          <div className="api-step-row">
            <span className="api-step-num">2</span>
            <div className="api-step-content">
              <p className="api-step-title">Create & copy key</p>
              <p className="api-step-desc">Click <strong>Create API key</strong>, select or create a project, and copy the key string.</p>
            </div>
          </div>

          <div className="api-step-row">
            <span className="api-step-num">3</span>
            <div className="api-step-content">
              <p className="api-step-title">Paste your key</p>
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
                {geminiApiKey && (
                  <button
                    type="button"
                    className="api-key-remove-btn"
                    onClick={handleClear}
                    title="Remove saved key"
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                )}
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

        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
          <button
            type="button"
            className="login-auth-btn"
            style={{ 
              background: 'transparent', 
              border: '1px solid var(--border)', 
              color: 'var(--text-secondary)',
              flex: 1 
            }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="login-auth-btn"
            style={{ 
              background: 'var(--text-primary)', 
              color: 'var(--bg)', 
              fontWeight: '600',
              flex: 2 
            }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <span className="spinner-sm" /> : 'Save Key'}
          </button>
        </div>
      </div>
    </div>
  )
}
