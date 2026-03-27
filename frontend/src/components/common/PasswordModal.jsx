import { useState } from 'react'
import Modal from './Modal'
import { authApi } from '../../api/authApi'

export default function PasswordModal({ open, onClose }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', repeat_password: '' })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  function reset() {
    setForm({ current_password: '', new_password: '', repeat_password: '' })
    setError(null)
    setSuccess(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (form.new_password !== form.repeat_password) {
      setError('Die neuen Passwörter stimmen nicht überein.')
      return
    }
    if (form.new_password.length < 4) {
      setError('Neues Passwort muss mindestens 4 Zeichen haben.')
      return
    }

    setSaving(true)
    try {
      await authApi.changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      })
      setSuccess(true)
      setTimeout(() => { handleClose() }, 1500)
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Passwort ändern" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Aktuelles Passwort</label>
          <input
            type="password"
            value={form.current_password}
            onChange={(e) => setForm((f) => ({ ...f, current_password: e.target.value }))}
            required
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Neues Passwort</label>
          <input
            type="password"
            value={form.new_password}
            onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Wiederholen</label>
          <input
            type="password"
            value={form.repeat_password}
            onChange={(e) => setForm((f) => ({ ...f, repeat_password: e.target.value }))}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Abbrechen
          </button>
          {error && <span className="text-sm text-red-600">⚠ {error}</span>}
          {success && <span className="text-sm text-green-600">✓ Passwort geändert</span>}
        </div>
      </form>
    </Modal>
  )
}
