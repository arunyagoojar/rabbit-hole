import { useState, useRef, useEffect } from 'react'
import { Sun, Moon, User, LogOut, Flame, Sparkles, Edit2, SlidersHorizontal, LogIn } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

/**
 * TopBar — sticky header with wordmark, topics customization, theme toggle, and profile/settings menu
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
    setDropdownOpen(prev => !prev)
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
            aria-label={user ? 'Open profile menu' : 'Open settings & profile menu'}
            aria-haspopup="true"
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

          {dropdownOpen && (
            <div className="profile-dropdown page-enter" role="menu">
              <div className="profile-dropdown-header">
                <p className="profile-name">{user ? (user.displayName || 'Explorer') : 'Guest Explorer'}</p>
                <p className="profile-email">{user ? user.email : 'Local device session'}</p>
              </div>

              <div className="profile-dropdown-divider" aria-hidden="true" />

              <div className="profile-dropdown-section">
                <div className="profile-stat-row">
                  <span className="stat-row-label">
                    <Flame size={15} className="stat-icon-flame" />
                    Streak
                  </span>
                  <span className="stat-row-val">{userData?.streak || 1} {userData?.streak === 1 ? 'day' : 'days'}</span>
                </div>
              </div>

              <div className="profile-dropdown-divider" aria-hidden="true" />

              <div className="profile-dropdown-section">
                <div className="profile-interests-row">
                  <span className="stat-row-label">Interests</span>
                  <button 
                    className="profile-edit-interests-btn"
                    onClick={() => {
                      onOpenInterests()
                      setDropdownOpen(false)
                    }}
                    aria-label="Edit interests"
                  >
                    <Edit2 size={12} />
                    <span>Edit interests</span>
                  </button>
                </div>
              </div>

              <div className="profile-dropdown-divider" aria-hidden="true" />

              {user ? (
                <button 
                  className="profile-signout-btn" 
                  onClick={handleSignOut}
                  role="menuitem"
                >
                  <LogOut size={14} />
                  <span>Sign out</span>
                </button>
              ) : (
                <button 
                  className="profile-signout-btn profile-signin-btn" 
                  onClick={() => {
                    setDropdownOpen(false)
                    onOpenLogin()
                  }}
                  role="menuitem"
                >
                  <LogIn size={14} />
                  <span>Sign in / Create account</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
