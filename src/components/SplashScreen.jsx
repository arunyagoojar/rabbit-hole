import { useState, useEffect } from 'react'

/**
 * SplashScreen — first-time visit animation
 * Shows rabbit hole SVG draw animation, wordmark fade-in, tagline, then tap hint.
 * Auto-advances after 3.5s or on tap.
 */
export default function SplashScreen({ onComplete }) {
  const [exiting, setExiting] = useState(false)

  const handleAdvance = () => {
    if (exiting) return
    setExiting(true)
    setTimeout(onComplete, 500)
  }

  // Auto-advance after 3.5s
  useEffect(() => {
    const timer = setTimeout(handleAdvance, 3600)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className={`splash-screen${exiting ? ' exiting' : ''}`}
      onClick={handleAdvance}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? handleAdvance() : null}
      aria-label="Continue to onboarding"
    >
      <div className="splash-logo-wrap">
        {/* Rabbit Hole SVG Illustration */}
        <svg
          className="rabbit-hole-svg"
          viewBox="0 0 120 120"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Outer circle */}
          <circle
            className="outer-circle"
            cx="60"
            cy="60"
            r="52"
            strokeLinecap="round"
          />
          {/* Spiral path going inward — approximated with arcs */}
          <path
            className="spiral-path"
            d="
              M 60 60
              m 38 0
              a 38 38 0 1 0 -76 0
              a 38 38 0 0 0 74 -6
              a 30 30 0 1 0 -58 -2
              a 24 24 0 0 0 46 4
              a 18 18 0 1 0 -34 2
              a 12 12 0 0 0 22 -4
              a 6 6 0 1 0 -10 0
            "
          />
        </svg>

        <h1 className="splash-wordmark">rabbit hole</h1>
        <p className="splash-tagline">
          learn something new.<br />go as deep as you want.
        </p>
      </div>

      <span className="splash-tap-hint" aria-hidden="true">tap to continue</span>
    </div>
  )
}
