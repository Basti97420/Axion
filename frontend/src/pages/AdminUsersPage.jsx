import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { adminApi } from '../api/adminApi'
import Modal from '../components/common/Modal'
import { useToastStore } from '../store/toastStore'

function UserForm({ initial, onSubmit, onCancel, loading }) {
  const [name, setName] = useState(initial?.name || '')
  const [password, setPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(initial?.is_admin || false)
  const isEdit = !!initial?.id

  function handleSubmit(e) {
    e.preventDefault()
    const data = { name, is_admin: isAdmin }
    if (password) data.password = password
    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Benutzername</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Passwort{isEdit ? ' (leer lassen = nicht ändern)' : ''}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={!isEdit}
          minLength={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={isAdmin}
          onChange={(e) => setIsAdmin(e.target.checked)}
          className="rounded border-gray-300"
        />
        Administrator
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Speichern…' : isEdit ? 'Speichern' : 'Erstellen'}
        </button>
      </div>
    </form>
  )
}

export default function AdminUsersPage() {
  const currentUser = useAuthStore((s) => s.user)
  const { showToast, showConfirm } = useToastStore()
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(null) // null | 'create' | user object
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    try {
      const { data } = await adminApi.getUsers()
      setUsers(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Laden')
    }
  }

  async function handleCreate(data) {
    setLoading(true)
    try {
      await adminApi.createUser(data)
      await loadUsers()
      setModal(null)
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler beim Erstellen', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleEdit(data) {
    setLoading(true)
    try {
      await adminApi.updateUser(modal.id, data)
      await loadUsers()
      setModal(null)
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler beim Speichern', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(user) {
    if (!await showConfirm(`Benutzer "${user.name}" wirklich löschen?`)) return
    try {
      await adminApi.deleteUser(user.id)
      await loadUsers()
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler beim Löschen', 'error')
    }
  }

  if (!currentUser?.is_admin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 rounded-lg p-4 text-sm">
          Keine Berechtigung. Nur Administratoren können Benutzer verwalten.
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 rounded-lg p-4 text-sm">{error}</div>
      </div>
    )
  }

  const isEdit = modal && modal !== 'create'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Benutzerverwaltung</h1>
        <button
          onClick={() => setModal('create')}
          className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          + Neuer Benutzer
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rolle</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Erstellt am</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Letzter Login</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3">
                  {u.is_admin ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      Admin
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">Benutzer</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('de-DE') : '–'}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {u.last_login ? new Date(u.last_login).toLocaleDateString('de-DE') : '–'}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => setModal(u)}
                    className="text-gray-400 hover:text-primary-600 mr-3"
                    title="Bearbeiten"
                  >
                    Bearbeiten
                  </button>
                  {u.id !== currentUser.id && (
                    <button
                      onClick={() => handleDelete(u)}
                      className="text-gray-400 hover:text-red-600"
                      title="Löschen"
                    >
                      Löschen
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={isEdit ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
        size="sm"
      >
        <UserForm
          initial={isEdit ? modal : {}}
          onSubmit={isEdit ? handleEdit : handleCreate}
          onCancel={() => setModal(null)}
          loading={loading}
        />
      </Modal>
    </div>
  )
}
