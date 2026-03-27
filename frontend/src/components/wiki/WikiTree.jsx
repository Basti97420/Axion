import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { wikiApi } from '../../api/wikiApi'

function TreeNode({ page, level = 0 }) {
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState([])

  async function toggle() {
    if (!open && page.has_children && children.length === 0) {
      const { data } = await wikiApi.getChildren(page.slug)
      setChildren(data)
    }
    setOpen((v) => !v)
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
          to={`/wiki/${page.slug}`}
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
        <TreeNode key={child.slug} page={child} level={level + 1} />
      ))}
    </div>
  )
}

export default function WikiTree({ onNewPage }) {
  const [pages, setPages] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    wikiApi.listPages({ parent_id: null })
      .then(({ data }) => setPages(data))
      .catch(() => {})
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Wiki</span>
        <button
          onClick={onNewPage}
          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
        >
          + Neu
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {pages.length === 0 ? (
          <p className="text-xs text-gray-400 px-4 py-2">Noch keine Seiten.</p>
        ) : (
          pages.map((page) => (
            <TreeNode key={page.slug} page={page} level={0} />
          ))
        )}
      </nav>
    </div>
  )
}
