import { useState, useRef, useEffect } from 'react'
import { Sun, Moon, User, LogOut, Flame, Sparkles, Edit2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

/**
 * TopBar — sticky header with wordmark, theme toggle, and auth profile menu
 */
export default function TopBar({ theme, onToggleTheme, onOpenLogin, onOpenInterests }) {
  const { user, userData, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const handleProfileClick = () => {
    if (!user) {
      onOpenLogin()
    } else {
      setDropdownOpen(prev => !prev)
    }
  }

  const handleSignOut = () => {
    setDropdownOpen(false)
    logout()
  }

  return (
    <header className="top-bar">
      <span className="wordmark" aria-label="Rabbit Hole">rabbit hole</span>
      
      <div className="top-bar-actions">
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="profile-menu-container" ref={dropdownRef}>
          <button
            className={`profile-trigger-btn${user ? ' authenticated' : ''}`}
            onClick={handleProfileClick}
            aria-label={user ? 'Open profile menu' : 'Sign in'}
            aria-haspopup={user ? 'true' : 'false'}
            aria-expanded={dropdownOpen}
          >
            {user ? (
              user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'Profile'} 
                  className="profile-avatar-img"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="profile-avatar-placeholder">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                </span>
              )
            ) : (
              <User size={18} />
            )}
          </button>

          {user && dropdownOpen && (
            <div className="profile-dropdown page-enter" role="menu">
              <div className="profile-dropdown-header">
                <p className="profile-name">{user.displayName || 'Explorer'}</p>
                <p className="profile-email">{user.email}</p>
              </div>

              <div className="profile-dropdown-divider" aria-hidden="true" />

              <div className="profile-dropdown-stats">
                <div className="profile-stat-row">
                  <span className="stat-row-label">
                    <Flame size={16} className="stat-icon-flame" />
                    Streak
                  </span>
                  <span className="stat-row-val">{userData?.streak || 0} days</span>
                </div>
                <div className="profile-stat-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="stat-row-label">
                    <Sparkles size={16} className="stat-icon-spark" />
                    Interests
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="stat-row-val">{userData?.interests?.length || 0}</span>
                    <button 
                      onClick={() => {
                        onOpenInterests()
                        setDropdownOpen(false)
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'inherit',
                        opacity: 0.6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px'
                      }}
                      aria-label="Edit Interests"
                      title="Edit Interests"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="profile-dropdown-divider" aria-hidden="true" />

              <button 
                className="profile-signout-btn" 
                onClick={handleSignOut}
                role="menuitem"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
