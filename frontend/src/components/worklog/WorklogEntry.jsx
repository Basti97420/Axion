import { useState } from 'react'
import Button from '../common/Button'

// Hilfsfunktion: "2h 30m", "90m", "1.5" → Minuten
function parseInput(raw) {
  const s = raw.trim().toLowerCase()

  // Format "Xh Ym" oder "Xh" oder "Ym"
  const hm = s.match(/^(?:(\d+(?:\.\d+)?)h)?\s*(?:(\d+)m)?$/)
  if (hm && (hm[1] || hm[2])) {
    return Math.round((parseFloat(hm[1] || 0) * 60) + parseInt(hm[2] || 0))
  }

  // Dezimalzahl → Stunden
  const dec = parseFloat(s)
  if (!isNaN(dec) && dec > 0) return Math.round(dec * 60)

  return null
}

export default function WorklogEntry({ issueId, onSaved, onCancel }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [durationRaw, setDurationRaw] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const minutes = parseInput(durationRaw)
    if (!minutes || minutes <= 0) {
      setError('Ungültige Dauer. Beispiele: 1.5, 1h 30m, 90m')
      return
    }
    setError('')
    setSaving(true)
    try {
      await onSaved({ date, duration_min: minutes, description })
      setDurationRaw('')
      setDescription('')
      setDate(today)
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = 'w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-gray-50 rounded-lg p-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Datum</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Dauer</label>
          <input
            value={durationRaw}
            onChange={(e) => { setDurationRaw(e.target.value); setError('') }}
            placeholder="z.B. 1.5 oder 1h 30m"
            className={fieldClass}
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Beschreibung</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Was wurde gemacht? (optional)"
          className={fieldClass}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Abbrechen</Button>}
        <Button type="submit" size="sm" loading={saving}>Buchen</Button>
      </div>
    </form>
  )
}
