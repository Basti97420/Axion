import { useState, useRef } from 'react'
import { projectsApi } from '../../api/projectsApi'
import { useProjectStore } from '../../store/projectStore'

const COLOR_PRESETS = [
  { bg: 'bg-slate-100 text-slate-700',   dot: 'bg-slate-400',   name: 'Grau' },
  { bg: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500',    name: 'Blau' },
  { bg: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400',  name: 'Orange' },
  { bg: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500',  name: 'Gelb' },
  { bg: 'bg-green-100 text-green-700',   dot: 'bg-green-500',   name: 'Grün' },
  { bg: 'bg-red-100 text-red-600',       dot: 'bg-red-400',     name: 'Rot' },
  { bg: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500',  name: 'Lila' },
  { bg: 'bg-pink-100 text-pink-700',     dot: 'bg-pink-500',    name: 'Pink' },
  { bg: 'bg-cyan-100 text-cyan-700',     dot: 'bg-cyan-500',    name: 'Cyan' },
  { bg: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500',  name: 'Indigo' },
]

export default function StatusManager({ projectId, onClose }) {
  const statuses = useProjectStore((s) => s.currentProjectStatuses)
  const setStatuses = useProjectStore((s) => s.setCurrentProjectStatuses)

  const [label, setLabel] = useState('')
  const [selectedColor, setSelectedColor] = useState(0)
  const [isClosed, setIsClosed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteErrors, setDeleteErrors] = useState({})

  // Drag-to-reorder state
  const dragIndex = useRef(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  async function handleCreate(e) {
    e.preventDefault()
    if (!label.trim()) return
    setSaving(true)
    setError('')
    try {
      const preset = COLOR_PRESETS[selectedColor]
      const { data } = await projectsApi.createStatus(projectId, {
        label: label.trim(),
        color: preset.bg,
        dot_color: preset.dot,
        is_closed: isClosed,
      })
      setStatuses([...statuses, data])
      setLabel('')
      setSelectedColor(0)
      setIsClosed(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Anlegen')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(statusId) {
    setDeleteErrors((prev) => ({ ...prev, [statusId]: '' }))
    try {
      await projectsApi.deleteStatus(projectId, statusId)
      setStatuses(statuses.filter((s) => s.id !== statusId))
    } catch (err) {
      setDeleteErrors((prev) => ({
        ...prev,
        [statusId]: err.response?.data?.error || 'Löschen fehlgeschlagen',
      }))
    }
  }

  function handleDragStart(i) {
    dragIndex.current = i
  }

  function handleDragOver(e, i) {
    e.preventDefault()
    setDragOverIndex(i)
  }

  async function handleDrop(i) {
    const from = dragIndex.current
    if (from === null || from === i) { setDragOverIndex(null); return }

    // Lokale Neuordnung
    const newOrder = [...statuses]
    const [moved] = newOrder.splice(from, 1)
    newOrder.splice(i, 0, moved)
    setStatuses(newOrder)
    setDragOverIndex(null)
    dragIndex.current = null

    // Backend: Positionen für alle betroffenen Einträge aktualisieren
    await Promise.all(
      newOrder.map((s, idx) =>
        projectsApi.updateStatus(projectId, s.id, { position: idx }).catch(() => {})
      )
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Kanban-Spalten verwalten</h2>
            <p className="text-xs text-gray-400 mt-0.5">Reihenfolge per Drag & Drop ändern</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Status-Liste */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-1.5">
          {statuses.map((s, i) => (
            <div key={s.id}>
              <div
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => setDragOverIndex(null)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                  dragOverIndex === i
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                {/* Drag Handle */}
                <span className="text-gray-300 cursor-grab active:cursor-grabbing select-none text-lg leading-none">
                  ⠿
                </span>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot_color}`} />
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.color}`}>
                  {s.label}
                </span>
                {s.is_closed && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    Abgeschlossen
                  </span>
                )}
                <button
                  onClick={() => s.key !== 'open' && handleDelete(s.id)}
                  disabled={s.key === 'open'}
                  className={`ml-auto transition-colors ${s.key === 'open' ? 'text-gray-200 cursor-not-allowed' : 'text-gray-300 hover:text-red-500'}`}
                  title={s.key === 'open' ? 'Systemreserviert — wird für neue Issues benötigt' : 'Löschen'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              {deleteErrors[s.id] && (
                <p className="text-xs text-red-600 mt-1 px-2">{deleteErrors[s.id]}</p>
              )}
            </div>
          ))}
        </div>

        {/* Neuen Status anlegen */}
        <form onSubmit={handleCreate} className="px-6 py-4 border-t border-gray-100 space-y-3">
          <p className="text-sm font-medium text-gray-700">Neuen Status anlegen</p>

          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="z.B. QA-Prüfung, Warten auf Kunde …"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          {/* Farbauswahl */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Farbe</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedColor(idx)}
                  title={preset.name}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    selectedColor === idx ? 'border-gray-700 scale-110' : 'border-transparent hover:scale-105'
                  } ${preset.dot}`}
                />
              ))}
            </div>
            {/* Vorschau */}
            <span className={`inline-flex items-center gap-1 mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${COLOR_PRESETS[selectedColor].bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${COLOR_PRESETS[selectedColor].dot}`} />
              {label || 'Vorschau'}
            </span>
          </div>

          {/* Abgeschlossen-Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isClosed}
              onChange={(e) => setIsClosed(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
            />
            <span className="text-sm text-gray-600">Als „Abgeschlossen" markieren</span>
            <span className="text-xs text-gray-400">(Issues nach 2 Tagen ausblenden)</span>
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving || !label.trim()}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Wird angelegt …' : 'Status anlegen'}
          </button>
        </form>
      </div>
    </div>
  )
}
