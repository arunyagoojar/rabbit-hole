import { useMemo } from 'react'
import { Lock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  normalizeHistory,
  groupSessionsByTopic,
  TOPIC_BY_ID,
  DAY_MS,
  getDateKey
} from '../utils/readingHistory'

/**
 * TimelinePage — memory, identity, and curiosity map
 * Not analytics. This is who you are as an explorer.
 */
export default function TimelinePage() {
  const { userData } = useAuth()

  const historyList = useMemo(() => {
    return normalizeHistory(userData?.readHistory || {})
      .sort((a, b) => b.lastUpdated - a.lastUpdated)
  }, [userData?.readHistory])

  const hasCompletedRead = historyList.some(item => (item.cardsRead || 0) > 0)

  if (!hasCompletedRead) {
    return <LockedTimeline />
  }

  // ─── Compute stats ───
  const totalCardsRead = historyList.reduce((sum, item) => sum + (item.cardsRead || 0), 0)

  const deepestDiveItem = historyList.reduce((max, item) =>
    (item.cardsRead || 0) > (max.cardsRead || 0) ? item : max
  , { cardsRead: 0, title: 'None' })

  const uniqueTopicIds = new Set(historyList.map(item => item.topicId))
  const rabbitHolesStarted = uniqueTopicIds.size
  const streak = userData?.streak || 0

  // ─── Category data for radar ───
  const categoryCards = {}
  historyList.forEach(item => {
    const category = item.category || 'Uncategorized'
    categoryCards[category] = (categoryCards[category] || 0) + (item.cardsRead || 0)
  })

  const categories = Object.keys(categoryCards)
    .map(name => ({
      name,
      cards: categoryCards[name],
      pct: Math.round((categoryCards[name] / Math.max(totalCardsRead, 1)) * 100)
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8) // Cap radar at 8 axes for readability

  // ─── Identity ───
  const identity = computeIdentity(historyList, categories, totalCardsRead, streak)

  // ─── Activity ───
  const activity = buildSevenDayActivity(historyList)

  return (
    <div className="timeline-page page-enter">
      <IdentityCard identity={identity} />

      <div className="stat-strip" aria-label="Your exploration stats">
        <div className="stat-strip-item">
          <span className="stat-strip-number">{totalCardsRead}</span>
          <span className="stat-strip-label">Cards read</span>
        </div>
        <div className="stat-strip-item">
          <span className="stat-strip-number">{rabbitHolesStarted}</span>
          <span className="stat-strip-label">Rabbit holes</span>
        </div>
        <div className="stat-strip-item">
          <span className="stat-strip-number">{deepestDiveItem.cardsRead}</span>
          <span className="stat-strip-label">Deepest dive</span>
        </div>
        <div className="stat-strip-item">
          <span className="stat-strip-number">{streak}</span>
          <span className="stat-strip-label">Day streak</span>
        </div>
      </div>

      <CuriosityRadar categories={categories} />
      <ActivityGraph activity={activity} />
    </div>
  )
}

/* ── Locked State ── */
function LockedTimeline() {
  return (
    <div className="timeline-page page-enter">
      <div className="locked-overlay">
        <div className="locked-blur" style={{ opacity: 0.35, pointerEvents: 'none' }}>
          <section className="identity-card">
            <p className="identity-trait-label">You are a —</p>
            <h2 className="identity-title">Curious Rabbit</h2>
            <p className="identity-subtitle">Start exploring interesting ideas to discover your explorer identity.</p>
            <div className="identity-divider" />
          </section>
        </div>
        <div className="locked-message">
          <Lock size={24} className="lock-icon" aria-hidden="true" />
          <p className="locked-text">
            Complete your first rabbit hole to unlock your identity.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Identity Card (pattern-based) ── */
function IdentityCard({ identity }) {
  return (
    <section className="identity-card" aria-label="Your explorer identity">
      <IdentitySigil seed={identity.sigilSeed} />
      <p className="identity-trait-label">{identity.trait}</p>
      <h2 className="identity-title">{identity.name}</h2>
      <p className="identity-subtitle">{identity.description}</p>
      <div className="identity-divider" aria-hidden="true" />
    </section>
  )
}

/* ── Identity Sigil — generative geometric shape ── */
function IdentitySigil({ seed }) {
  // Generate a deterministic geometric pattern from the seed
  const points = useMemo(() => {
    let s = seed % 2147483647
    const next = () => { s = (s * 48271) % 2147483647; return s / 2147483647 }
    
    const numShapes = 3 + Math.floor(next() * 3)
    const shapes = []
    
    for (let i = 0; i < numShapes; i++) {
      const cx = 20 + next() * 40
      const cy = 20 + next() * 40
      const r = 8 + next() * 18
      const sides = 3 + Math.floor(next() * 5)
      const rotation = next() * 360
      
      const pts = []
      for (let j = 0; j < sides; j++) {
        const angle = (j / sides) * Math.PI * 2 + (rotation * Math.PI / 180)
        pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
      }
      shapes.push({ points: pts.join(' '), opacity: 0.3 + next() * 0.5 })
    }
    return shapes
  }, [seed])

  return (
    <svg className="identity-sigil" viewBox="0 0 80 80" aria-hidden="true">
      {points.map((shape, i) => (
        <polygon
          key={i}
          points={shape.points}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          opacity={shape.opacity}
        />
      ))}
    </svg>
  )
}

/* ── Curiosity Radar Chart ── */
function CuriosityRadar({ categories }) {
  if (categories.length < 3) {
    // Need at least 3 points for a meaningful radar
    return null
  }

  const size = 320
  const cx = size / 2
  const cy = size / 2
  const radius = 120
  const levels = 4
  const count = categories.length
  const maxPct = Math.max(...categories.map(c => c.pct), 1)

  // Compute grid levels (concentric polygons)
  const gridLevels = Array.from({ length: levels }, (_, i) => {
    const r = (radius / levels) * (i + 1)
    const pts = Array.from({ length: count }, (_, j) => {
      const angle = (j / count) * Math.PI * 2 - Math.PI / 2
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
    })
    return pts.join(' ')
  })

  // Compute data shape
  const dataPoints = categories.map((cat, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const r = (cat.pct / maxPct) * radius
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      labelX: cx + (radius + 24) * Math.cos(angle),
      labelY: cy + (radius + 24) * Math.sin(angle),
      name: truncateLabel(cat.name)
    }
  })

  const shapePoints = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

  // Axis lines
  const axes = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    return {
      x2: cx + radius * Math.cos(angle),
      y2: cy + radius * Math.sin(angle)
    }
  })

  return (
    <section className="curiosity-radar-section" aria-label="Curiosity map">
      <h3 className="section-heading">Curiosity map</h3>
      <div className="curiosity-radar-wrap">
        <svg className="curiosity-radar-svg" viewBox={`0 0 ${size} ${size}`}>
          {/* Grid levels */}
          {gridLevels.map((pts, i) => (
            <polygon key={i} className="radar-grid-line" points={pts} />
          ))}

          {/* Axis lines */}
          {axes.map((axis, i) => (
            <line key={i} className="radar-axis" x1={cx} y1={cy} x2={axis.x2} y2={axis.y2} />
          ))}

          {/* Data shape */}
          <polygon className="radar-shape" points={shapePoints} />

          {/* Data dots */}
          {dataPoints.map((p, i) => (
            <circle key={i} className="radar-dot" cx={p.x} cy={p.y} r="3.5" />
          ))}

          {/* Labels */}
          {dataPoints.map((p, i) => (
            <text key={i} className="radar-label" x={p.labelX} y={p.labelY}>
              {p.name}
            </text>
          ))}
        </svg>
      </div>
    </section>
  )
}

/* ── Activity Graph ── */
function ActivityGraph({ activity }) {
  const maxCards = Math.max(1, ...activity.map(day => day.cards))

  return (
    <section className="activity-section" aria-label="Reading activity over the last seven days">
      <div className="section-heading-row">
        <h3 className="section-heading">Recent activity</h3>
        <span className="section-kicker">Last 7 days</span>
      </div>
      <div className="activity-chart" role="list">
        {activity.map(day => {
          const pct = day.cards > 0 ? Math.max((day.cards / maxCards) * 100, 10) : 4

          return (
            <div
              key={day.date}
              className="activity-day"
              role="listitem"
              aria-label={`${day.label}: ${day.cards} cards read across ${day.sessions} sessions`}
            >
              <div className="activity-bar-shell">
                <div
                  className={`activity-bar${day.cards > 0 ? ' active' : ''}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <span className="activity-value">{day.cards}</span>
              <span className="activity-label">{day.label}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ── Helpers ── */

function truncateLabel(name) {
  if (name.length <= 10) return name
  // Shorten "Mythology & Folklore" → "Mythology"
  if (name.includes('&')) return name.split('&')[0].trim()
  return name.slice(0, 9) + '…'
}

function computeIdentity(historyList, categories, totalCards, streak) {
  if (historyList.length === 0) {
    return { name: 'Curious Rabbit', trait: 'you are a —', description: 'Begin your first rabbit hole.', sigilSeed: 1 }
  }

  // Compute exploration pattern signals
  const uniqueCategories = categories.length
  const avgCardsPerSession = historyList.length > 0 ? totalCards / historyList.length : 0
  const topCategoryPct = categories.length > 0 ? categories[0].pct : 0
  
  // Check time-of-day pattern
  const lateNightReads = historyList.filter(item => {
    const d = new Date(item.lastUpdated || Date.now())
    const hour = d.getHours()
    return hour >= 23 || hour < 5
  }).length
  const nightOwlRatio = lateNightReads / Math.max(historyList.length, 1)

  // Determine primary identity based on exploration pattern
  let name, trait, description

  if (nightOwlRatio > 0.5 && historyList.length >= 3) {
    name = 'Midnight Scholar'
    trait = 'the hours reveal you —'
    description = `You do your best thinking after dark. ${lateNightReads} of your sessions happened when the world was quiet.`
  } else if (uniqueCategories >= 6 && avgCardsPerSession >= 3) {
    name = 'Renaissance Mind'
    trait = 'your curiosity knows no walls —'
    description = `You've wandered through ${uniqueCategories} different worlds. Few people explore this broadly and still go deep.`
  } else if (avgCardsPerSession >= 6) {
    name = 'Deep Well'
    trait = 'you don\'t just look — you stay —'
    description = `You average ${avgCardsPerSession.toFixed(1)} cards per session. When you find something interesting, you follow it down.`
  } else if (topCategoryPct >= 60 && uniqueCategories <= 3) {
    name = 'Obsidian Focus'
    trait = 'you know what matters to you —'
    description = `${topCategoryPct}% of your exploration is in ${categories[0]?.name || 'one area'}. That's not narrow — it's conviction.`
  } else if (streak >= 5) {
    name = 'Ritual Keeper'
    trait = 'consistency shapes identity —'
    description = `${streak} days in a row. You've made curiosity a daily practice, not a passing mood.`
  } else if (uniqueCategories >= 4) {
    name = 'Drift Walker'
    trait = 'you follow the thread wherever it leads —'
    description = `You've touched ${uniqueCategories} categories across ${historyList.length} sessions. You read like someone following a scent.`
  } else if (historyList.length >= 5) {
    name = 'Seeker'
    trait = 'you keep coming back —'
    description = `${historyList.length} reading sessions so far. You've crossed the threshold from curiosity into commitment.`
  } else {
    name = 'Wanderer'
    trait = 'the journey begins —'
    description = `${totalCards} cards read across ${historyList.length} sessions. Every great explorer started with a first step.`
  }

  // Generate a unique sigil seed based on reading DNA
  const sigilSeed = (totalCards * 31 + uniqueCategories * 97 + streak * 53 + historyList.length * 17) % 2147483647 || 42

  return { name, trait, description, sigilSeed }
}

function buildSevenDayActivity(historyList) {
  const today = new Date()
  const dates = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today.getTime() - (6 - index) * DAY_MS)
    return getDateKey(day)
  })

  const grouped = dates.reduce((acc, date) => {
    acc[date] = { date, cards: 0, sessions: 0 }
    return acc
  }, {})

  historyList.forEach(item => {
    if (!grouped[item.date]) return
    grouped[item.date].cards += item.cardsRead || 0
    grouped[item.date].sessions += 1
  })

  return dates.map(date => ({
    ...grouped[date],
    label: formatDayLabel(date)
  }))
}

function formatDayLabel(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}
