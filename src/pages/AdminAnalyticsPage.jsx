import { useState, useEffect } from 'react'
import { 
  ShieldCheck, 
  BarChart3, 
  Headphones, 
  BookOpen, 
  Clock, 
  ArrowLeft, 
  RefreshCw, 
  Lock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'

const DEFAULT_ADMIN_KEY = 'rabbithole_admin_secret_2026'

/**
 * AdminAnalyticsPage
 * Hidden administrative inspection dashboard.
 * Inaccessible to normal users, not in any normal navigation.
 */
export default function AdminAnalyticsPage({ onBack }) {
  const [adminKey, setAdminKey] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      return params.get('admin') || localStorage.getItem('rh-admin-key') || ''
    }
    return ''
  })
  const [inputKey, setInputKey] = useState('')
  const [summaryData, setSummaryData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchSummary = async (keyToUse) => {
    const key = keyToUse || adminKey
    if (!key) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/v1/analytics/summary', {
        headers: {
          'x-admin-key': key
        }
      })

      if (!res.ok) {
        if (res.status === 403) throw new Error('Invalid admin credentials')
        throw new Error(`Server returned ${res.status}`)
      }

      const data = await res.json()
      setSummaryData(data.summary || data)
      localStorage.setItem('rh-admin-key', key)
    } catch (err) {
      console.error('Admin summary fetch error:', err)
      setError(err.message || 'Failed to authenticate admin access')
      setSummaryData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (adminKey) {
      fetchSummary(adminKey)
    }
  }, [adminKey])

  const handleKeySubmit = (e) => {
    e.preventDefault()
    const trimmed = inputKey.trim()
    if (!trimmed) return
    setAdminKey(trimmed)
    fetchSummary(trimmed)
  }

  return (
    <div className="admin-analytics-page">
      {/* Top Header */}
      <header className="admin-header">
        <button className="admin-back-btn" onClick={onBack}>
          <ArrowLeft size={18} />
          <span>Exit Admin</span>
        </button>

        <div className="admin-badge">
          <ShieldCheck size={16} className="admin-badge-icon" />
          <span>Restricted Admin Telemetry</span>
        </div>

        {summaryData && (
          <button 
            className="admin-refresh-btn" 
            onClick={() => fetchSummary(adminKey)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spinner' : ''} />
            <span>Refresh</span>
          </button>
        )}
      </header>

      {/* Auth Gate if no valid key */}
      {!summaryData && !loading && (
        <div className="admin-auth-card">
          <div className="admin-lock-icon-box">
            <Lock size={28} />
          </div>
          <h2>Admin Authentication</h2>
          <p className="admin-auth-sub">
            This dashboard is private and monitors aggregate topic engagement, reading vs audio telemetry, and learning sessions.
          </p>

          <form onSubmit={handleKeySubmit} className="admin-auth-form">
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Enter admin secret key..."
              className="admin-input"
              autoFocus
            />
            <button type="submit" className="admin-submit-btn">
              Authenticate
            </button>
          </form>

          {error && (
            <div className="admin-error-alert" role="alert">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="admin-quick-fill">
            <button 
              className="admin-quick-btn"
              onClick={() => {
                setInputKey(DEFAULT_ADMIN_KEY)
                setAdminKey(DEFAULT_ADMIN_KEY)
                fetchSummary(DEFAULT_ADMIN_KEY)
              }}
            >
              Use default development key
            </button>
          </div>
        </div>
      )}

      {/* Dashboard View */}
      {summaryData && (
        <main className="admin-dashboard-body">
          <div className="admin-title-row">
            <div>
              <h1 className="admin-title">Application Telemetry & Engagement</h1>
              <p className="admin-subtitle">
                Aggregate user behavior, topic completion rates, and mode consumption.
              </p>
            </div>
            <div className="admin-status-indicator">
              <span className="live-dot" />
              <span>D1 Database Connected</span>
            </div>
          </div>

          {/* Metric Cards Row */}
          <div className="admin-metrics-grid">
            <div className="admin-stat-card">
              <div className="stat-card-header">
                <BarChart3 size={18} className="stat-icon" />
                <span className="stat-label">Total Events Tracked</span>
              </div>
              <p className="stat-value">
                {summaryData.eventCounts?.reduce((sum, e) => sum + (e.count || 0), 0) || 0}
              </p>
              <span className="stat-sub">Across all user interactions</span>
            </div>

            <div className="admin-stat-card">
              <div className="stat-card-header">
                <BookOpen size={18} className="stat-icon" />
                <span className="stat-label">Reading Mode Opens</span>
              </div>
              <p className="stat-value">
                {summaryData.modeBreakdown?.find(m => m.consume_mode === 'read')?.count || 0}
              </p>
              <span className="stat-sub">Single-page continuous reads</span>
            </div>

            <div className="admin-stat-card">
              <div className="stat-card-header">
                <Headphones size={18} className="stat-icon" />
                <span className="stat-label">Audio-Only Sessions</span>
              </div>
              <p className="stat-value">
                {summaryData.modeBreakdown?.find(m => m.consume_mode === 'audio')?.count || 0}
              </p>
              <span className="stat-sub">Hands-free player sessions</span>
            </div>

            <div className="admin-stat-card">
              <div className="stat-card-header">
                <CheckCircle2 size={18} className="stat-icon" />
                <span className="stat-label">Rabbit Hole Branches</span>
              </div>
              <p className="stat-value">
                {summaryData.eventCounts?.find(e => e.event_name === 'selected_branch')?.count || 0}
              </p>
              <span className="stat-sub">Questions explored by readers</span>
            </div>
          </div>

          {/* Two-Column Insights */}
          <div className="admin-split-grid">
            {/* Top Topics Table */}
            <section className="admin-panel-card">
              <div className="panel-header">
                <h3 className="panel-title">Top 10 Explored Topics</h3>
                <span className="panel-badge">By unique opens</span>
              </div>
              
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Topic ID / Title</th>
                      <th>Total Opens</th>
                      <th>Avg Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summaryData.topTopics || []).map((t, idx) => (
                      <tr key={idx}>
                        <td className="topic-id-cell">{t.topic_id || 'Untitled'}</td>
                        <td className="opens-cell">{t.opens}</td>
                        <td className="duration-cell">
                          {t.avg_duration ? `${Math.round(t.avg_duration)}s` : '—'}
                        </td>
                      </tr>
                    ))}
                    {(!summaryData.topTopics || summaryData.topTopics.length === 0) && (
                      <tr>
                        <td colSpan="3" className="empty-cell">No topic sessions recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Mode Distribution & Events Breakdown */}
            <section className="admin-panel-card">
              <div className="panel-header">
                <h3 className="panel-title">Event Breakdown</h3>
                <span className="panel-badge">Event Types</span>
              </div>

              <div className="events-breakdown-list">
                {(summaryData.eventCounts || []).map((e, idx) => (
                  <div key={idx} className="event-breakdown-row">
                    <span className="event-name-pill">{e.event_name}</span>
                    <div className="event-bar-wrapper">
                      <div 
                        className="event-bar-fill" 
                        style={{ width: `${Math.min(100, (e.count / 20) * 100)}%` }} 
                      />
                    </div>
                    <span className="event-count-badge">{e.count}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Recent Event Stream */}
          <section className="admin-panel-card stream-panel">
            <div className="panel-header">
              <h3 className="panel-title">Real-Time Event Stream</h3>
              <span className="panel-badge">Last 50 Events</span>
            </div>

            <div className="admin-table-container">
              <table className="admin-table stream-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event</th>
                    <th>Topic</th>
                    <th>Mode</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {(summaryData.recentEvents || []).map((event) => (
                    <tr key={event.id}>
                      <td className="time-cell">
                        {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td>
                        <span className={`stream-tag ${event.event_name}`}>
                          {event.event_name}
                        </span>
                      </td>
                      <td className="stream-topic-cell">{event.topic_id || '—'}</td>
                      <td>
                        {event.consume_mode ? (
                          <span className={`mode-tag ${event.consume_mode}`}>
                            {event.consume_mode}
                          </span>
                        ) : '—'}
                      </td>
                      <td>{event.duration_seconds ? `${event.duration_seconds}s` : '—'}</td>
                    </tr>
                  ))}
                  {(!summaryData.recentEvents || summaryData.recentEvents.length === 0) && (
                    <tr>
                      <td colSpan="5" className="empty-cell">No recent events recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}
    </div>
  )
}
