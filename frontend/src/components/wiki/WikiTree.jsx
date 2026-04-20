import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { wikiApi } from '../../api/wikiApi'
import ContextMenu from '../common/ContextMenu'
import KnowledgeGraph from './KnowledgeGraph'

function TreeNode({ page, level = 0, onDeleted, onNewChild }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState([])
  const [menu, setMenu] = useState(null)

  async function toggle() {
    if (!open && page.has_children && children.length === 0) {
      const { data } = await wikiApi.getChildren(page.slug)
      setChildren(data)
    }
    setOpen((v) => !v)
  }

  function handleContextMenu(e) {
    e.preventDefault()
    e.stopPropagation()
    setMenu({
      x: e.clientX, y: e.clientY,
      items: [
        {
          icon: '✏️', label: 'Umbenennen',
          onClick: () => navigate(`/knowledge/${page.slug}?edit=1`),
        },
        {
          icon: '➕', label: 'Unterseite erstellen',
          onClick: () => onNewChild?.(page.slug),
        },
        { divider: true },
        {
          icon: '🗑', label: 'Löschen', danger: true,
          onClick: async () => {
            if (!confirm(`Knowledge-Seite „${page.title}" wirklich löschen?`)) return
            try {
              await wikiApi.deletePage(page.slug)
              onDeleted?.(page.slug)
            } catch (err) {
              alert(err.response?.data?.error || 'Löschen fehlgeschlagen')
            }
          },
        },
      ],
    })
  }

  const indent = level * 12

  return (
    <div>
      <div
        className="flex items-center gap-1 group"
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {page.has_children ? (
          <button
            onClick={toggle}
            className="w-4 h-4 text-gray-400 hover:text-gray-600 shrink-0"
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <NavLink
          to={`/knowledge/${page.slug}`}
          onContextMenu={handleContextMenu}
          className={({ isActive }) =>
            `flex-1 text-sm py-1 pr-2 rounded truncate transition-colors ${
              isActive
                ? 'text-primary-700 font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`
          }
        >
          {page.title}
        </NavLink>
      </div>
      {open && children.map((child) => (
        <TreeNode
          key={child.slug}
          page={child}
          level={level + 1}
          onDeleted={(slug) => setChildren((c) => c.filter((p) => p.slug !== slug))}
          onNewChild={onNewChild}
        />
      ))}
      {menu && (
        <ContextMenu
          x={menu.x} y={menu.y}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}

export default function WikiTree({ onNewPage }) {
  const navigate = useNavigate()
  const { slug: currentSlug } = useParams()
  const [pages, setPages] = useState([])
  const [showGraph, setShowGraph] = useState(false)

  useEffect(() => {
    wikiApi.listPages({ parent_id: null })
      .then(({ data }) => setPages(data))
      .catch(() => {})
  }, [])

  function handleNewChild(parentSlug) {
    navigate(`/knowledge/new?parent=${parentSlug}`)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Knowledge</span>
        <div className="flex items-center gap-1.5">
          {/* Graph-Ansicht */}
          <button
            onClick={() => setShowGraph(true)}
            title="Graph-Ansicht"
            className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded hover:bg-gray-100"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="2" strokeWidth="2"/>
              <circle cx="19" cy="5" r="2" strokeWidth="2"/>
              <circle cx="19" cy="19" r="2" strokeWidth="2"/>
              <line x1="7" y1="11" x2="17" y2="6" strokeWidth="1.5"/>
              <line x1="7" y1="13" x2="17" y2="18" strokeWidth="1.5"/>
            </svg>
          </button>
          <button
            onClick={onNewPage}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            + Neu
          </button>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {pages.length === 0 ? (
          <p className="text-xs text-gray-400 px-4 py-2">Noch keine Seiten.</p>
        ) : (
          pages.map((page) => (
            <TreeNode
              key={page.slug}
              page={page}
              level={0}
              onDeleted={(slug) => setPages((p) => p.filter((x) => x.slug !== slug))}
              onNewChild={handleNewChild}
            />
          ))
        )}
      </nav>

      {showGraph && (
        <KnowledgeGraph
          currentSlug={currentSlug}
          onClose={() => setShowGraph(false)}
        />
      )}
    </div>
  )
}
