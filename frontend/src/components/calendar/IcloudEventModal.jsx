import { useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { calendarApi } from '../../api/calendarApi'

export default function IcloudEventModal({ open, onClose, issue }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(issue?.due_date || today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [note, setNote] = useState(
    issue ? `Projekt: ${issue.project_id} | Priorität: ${issue.priority} | #${issue.id}` : ''
  )
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await calendarApi.createEvent({
        title: issue?.title || 'Termin',
        start: `${date}T${startTime}:00`,
        end:   `${date}T${endTime}:00`,
        description: note,
      })
      setDone(true)
      setTimeout(() => { onClose(); setDone(false) }, 1200)
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Erstellen')
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <Modal open={open} onClose={onClose} title="In iCloud-Kalender eintragen">
      {done ? (
        <div className="text-center py-6">
          <p className="text-green-600 font-medium text-lg">✓ Termin erstellt!</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Von</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={fieldClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bis</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={fieldClass} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} placeholder="Optionale Beschreibung" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" loading={saving}>Termin erstellen</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
