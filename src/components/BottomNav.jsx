import { Compass, BookOpen, BarChart2 } from 'lucide-react'

const TABS = [
  { id: 'explore', label: 'Explore', Icon: Compass },
  { id: 'saved', label: 'My Reads', Icon: BookOpen },
  { id: 'timeline', label: 'Timeline', Icon: BarChart2 },
]

/**
 * BottomNav — three-tab navigation bar
 * Hides when reading overlay is active
 */
export default function BottomNav({ activeTab, onTabChange, hidden }) {
  return (
    <nav
      className={`bottom-nav${hidden ? ' hidden' : ''}`}
      aria-label="Main navigation"
    >
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`nav-tab${activeTab === id ? ' active' : ''}`}
          onClick={() => onTabChange(id)}
          aria-label={label}
          aria-current={activeTab === id ? 'page' : undefined}
        >
          <Icon size={20} strokeWidth={activeTab === id ? 2 : 1.5} />
          <span className="nav-tab-label">{label}</span>
          <span className="nav-dot" aria-hidden="true" />
        </button>
      ))}
    </nav>
  )
}
