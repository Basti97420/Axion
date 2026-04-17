import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/authApi'
import { searchApi } from '../../api/searchApi'
import { wikiApi } from '../../api/wikiApi'
import { useAiStore } from '../../store/aiStore'
import PasswordModal from './PasswordModal'
import { STATUS_COLORS, STATUS_LABELS } from '../../utils/statusColors'
import { APP_VERSION } from '../../utils/version'

export default function Navbar({ onToggleSidebar }) {
  const user = useAuthStore((s) => s.user)
  const clearUser = useAuthStore((s) => s.clearUser)
  const navigate = useNavigate()
  const toggleAi = useAiStore((s) => s.toggle)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const inputRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!showMenu) return
    function onOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showMenu])

  async function handleSearch(e) {
    const q = e.target.value
    setQuery(q)
    if (q.length < 2) { setResults(null); return }
    try {
      const [issueRes, wikiRes] = await Promise.allSettled([
        searchApi.search(q),
        wikiApi.search(q),
      ])
      setResults({
        issues: issueRes.status === 'fulfilled' ? issueRes.value.data.issues : [],
        comments: issueRes.status === 'fulfilled' ? issueRes.value.data.comments : [],
        wiki: wikiRes.status === 'fulfilled' ? wikiRes.value.data : [],
      })
    } catch { setResults(null) }
  }

  async function handleLogout() {
    await authApi.logout().catch(() => {})
    clearUser()
    navigate('/login')
  }

  // Initials für Avatar
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 z-40 shrink-0">
      {/* Hamburger */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
        title="Sidebar ein-/ausblenden"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Logo */}
      <span className="font-bold text-primary-600 text-lg tracking-tight select-none shrink-0">Axion</span>
      <span className="text-xs text-gray-400 select-none font-mono shrink-0">v{APP_VERSION}</span>

      {/* Globale Suche */}
      <div className="relative flex-1 max-w-md">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleSearch}
          onBlur={() => setTimeout(() => setResults(null), 200)}
          placeholder="Suchen…  ⌘K"
          className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <svg className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        {results && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
            {results.issues.length === 0 && results.comments.length === 0 && results.wiki.length === 0 ? (
              <p className="text-sm text-gray-400 px-4 py-3">Keine Ergebnisse</p>
            ) : (
              <>
                {results.issues.length > 0 && (
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Issues</span>
                  </div>
                )}
                {results.issues.map((issue) => (
                  <button
                    key={issue.id}
                    onMouseDown={() => navigate(`/projects/${issue.project_id}/issues/${issue.id}`)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"
                  >
                    <span className="font-medium flex-1 truncate">{issue.title}</span>
                    <span className="text-xs text-gray-400 shrink-0">#{issue.id}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[issue.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[issue.status] || issue.status}
                    </span>
                  </button>
                ))}
                {results.comments.length > 0 && (
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Kommentare</span>
                  </div>
                )}
                {results.comments.map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={() => navigate(`/projects/${c.project_id}/issues/${c.issue_id}`)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-600"
                  >
                    <span className="truncate">{c.content}</span>
                    <span className="ml-2 text-xs text-gray-400">Kommentar</span>
                  </button>
                ))}
                {results.wiki.length > 0 && (
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Wiki</span>
                  </div>
                )}
                {results.wiki.map((page) => (
                  <button
                    key={page.slug}
                    onMouseDown={() => navigate(`/wiki/${page.slug}`)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                  >
                    <span className="font-medium">📄 {page.title}</span>
                    {page.snippet && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{page.snippet}</p>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Rechte Seite */}
      <div className="ml-auto flex items-center gap-2">

        {/* KI-Button */}
        <button
          onClick={toggleAi}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          title="KI-Assistent öffnen"
        >
          <span>🤖</span>
          <span className="hidden sm:inline">KI</span>
        </button>

        {/* Trennlinie */}
        <div className="w-px h-5 bg-gray-200" />

        {/* Benutzer-Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {/* Avatar */}
            <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
              {initials}
            </span>
            <span className="text-sm text-gray-700 font-medium hidden sm:inline max-w-[120px] truncate">
              {user?.name}
            </span>
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1.5">
              {/* Benutzerinfo */}
              <div className="px-4 py-2 border-b border-gray-100 mb-1">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                {user?.is_admin && (
                  <p className="text-xs text-primary-600 font-medium mt-0.5">Administrator</p>
                )}
              </div>

              <Link
                to="/settings"
                onClick={() => setShowMenu(false)}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <span className="text-base">⚙️</span> Einstellungen
              </Link>

              <a
                href="/api/backup"
                onClick={() => setShowMenu(false)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <span className="text-base">💾</span> Backup herunterladen
              </a>

              {user?.is_admin && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <Link
                    to="/admin/users"
                    onClick={() => setShowMenu(false)}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <span className="text-base">👥</span> Benutzerverwaltung
                  </Link>
                </>
              )}

              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <span className="text-base">↩</span> Abmelden
              </button>
            </div>
          )}
        </div>
      </div>

      <PasswordModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </header>
  )
}
