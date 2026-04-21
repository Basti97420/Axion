import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function SubMenuItem({ item }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)

  function scheduleClose() {
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }
  function cancelClose() {
    clearTimeout(closeTimer.current)
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true) }}
      onMouseLeave={scheduleClose}
    >
      <button className="w-full text-left px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
        {item.icon && <span className="w-4 text-center">{item.icon}</span>}
        <span className="flex-1">{item.label}</span>
        <span className="text-gray-400 text-xs">▶</span>
      </button>
      {open && (
        <div
          className="absolute left-full top-0 ml-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-44 z-[9999]"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {item.submenu.map((sub, i) =>
            sub.divider ? (
              <div key={i} className="border-t border-gray-100 my-1" />
            ) : (
              <button
                key={i}
                onClick={sub.onClick}
                className={`w-full text-left px-4 py-1.5 text-sm flex items-center gap-2 ${
                  sub.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {sub.icon && <span className="w-4 text-center">{sub.icon}</span>}
                <span>{sub.label}</span>
                {sub.active && <span className="ml-auto text-primary-600">✓</span>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)

  // Klick außerhalb + Escape schließt das Menü
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Viewport-Korrektur: Menü soll nicht aus dem Bildschirm rausragen
  const menuW = 208 // w-52
  const menuH = items.length * 34
  const left = x + menuW > window.innerWidth  ? x - menuW : x
  const top  = y + menuH > window.innerHeight ? y - Math.min(menuH, 300) : y

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-52 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="border-t border-gray-100 my-1" />
        ) : item.submenu ? (
          <SubMenuItem key={i} item={item} />
        ) : (
          <button
            key={i}
            onClick={() => { item.onClick?.(); onClose() }}
            disabled={item.disabled}
            className={`w-full text-left px-4 py-1.5 text-sm flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              item.danger
                ? 'text-red-600 hover:bg-red-50'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {item.icon && <span className="w-4 text-center">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="text-xs text-gray-400">{item.badge}</span>
            )}
          </button>
        )
      )}
    </div>,
    document.body
  )
}
