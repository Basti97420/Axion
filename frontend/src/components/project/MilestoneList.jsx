import { useEffect, useState } from 'react'
import { milestonesApi } from '../../api/milestonesApi'
import { issuesApi } from '../../api/issuesApi'
import { useIssueStore } from '../../store/issueStore'
import { formatDate } from '../../utils/dateUtils'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { useToastStore } from '../../store/toastStore'

function MilestoneForm({ onSubmit, onCancel, loading, initial = {} }) {
  const [name, setName] = useState(initial.name || '')
  const [description, setDescription] = useState(initial.description || '')
  const [dueDate, setDueDate] = useState(initial.due_date || '')

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ name, description, due_date: dueDate || null })
  }

  const fc = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  const lc = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className={lc}>Name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={fc} required placeholder="Meilenstein-Bezeichnung" />
      </div>
      <div>
        <label className={lc}>Fällig am</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fc} />
      </div>
      <div>
        <label className={lc}>Beschreibung</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${fc} resize-none`} placeholder="Optional…" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" loading={loading}>{initial.id ? 'Speichern' : 'Erstellen'}</Button>
      </div>
    </form>
  )
}

function ProgressBar({ value }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div
        className="bg-primary-500 h-1.5 rounded-full transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

export default function MilestoneList({ projectId }) {
  const { showToast, showConfirm } = useToastStore()
  const [milestones, setMilestones] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dragOverId, setDragOverId] = useState(null)
  const upsertIssue = useIssueStore((s) => s.upsertIssue)

  useEffect(() => {
    milestonesApi.getAll(projectId)
      .then(({ data }) => setMilestones(data))
      .catch(() => {})
  }, [projectId])

  function handleDragOver(e, milestoneId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(milestoneId)
  }

  async function handleDrop(e, milestoneId) {
    e.preventDefault()
    setDragOverId(null)
    const issueId = parseInt(e.dataTransfer.getData('issueId'))
    if (!issueId) return
    try {
      const { data: updated } = await issuesApi.update(issueId, { milestone_id: milestoneId })
      upsertIssue(updated)
      // Stats neu laden
      const { data } = await milestonesApi.getAll(projectId)
      setMilestones(data)
    } catch { /* ignore */ }
  }

  async function handleCreate(data) {
    setSaving(true)
    try {
      const { data: m } = await milestonesApi.create(projectId, data)
      setMilestones((prev) => [...prev, m])
      setShowCreate(false)
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(data) {
    setSaving(true)
    try {
      const { data: m } = await milestonesApi.update(editTarget.id, data)
      setMilestones((prev) => prev.map((x) => x.id === m.id ? m : x))
      setEditTarget(null)
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!await showConfirm('Meilenstein löschen? Issues werden nicht gelöscht.')) return
    await milestonesApi.remove(id).catch(() => {})
    setMilestones((prev) => prev.filter((m) => m.id !== id))
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-gray-700">Meilensteine</h2>
        <Button size="sm" onClick={() => setShowCreate(true)}>+ Neu</Button>
      </div>
      {milestones.length > 0 && (
        <p className="text-xs text-gray-400 mb-4">↕ Issue aus der Liste auf einen Meilenstein ziehen</p>
      )}

      {milestones.length === 0 ? (
        <p className="text-sm text-gray-400">Noch keine Meilensteine.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {milestones.map((m) => (
            <div
              key={m.id}
              className={`border rounded-xl p-4 bg-white transition-colors ${
                dragOverId === m.id
                  ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200'
                  : 'border-gray-200'
              }`}
              onDragOver={(e) => handleDragOver(e, m.id)}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => handleDrop(e, m.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{m.name}</p>
                  {m.due_date && (
                    <p className="text-xs text-gray-400 mt-0.5">Fällig: {formatDate(m.due_date)}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditTarget(m)} className="text-xs text-gray-400 hover:text-primary-600">✏</button>
                  <button onClick={() => handleDelete(m.id)} className="text-xs text-gray-400 hover:text-red-600">✕</button>
                </div>
              </div>

              {m.description && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{m.description}</p>
              )}

              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{m.done_issues} / {m.total_issues} Issues</span>
                  <span>{m.progress}%</span>
                </div>
                <ProgressBar value={m.progress} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Meilenstein anlegen">
        <MilestoneForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} loading={saving} />
      </Modal>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Meilenstein bearbeiten">
        <MilestoneForm
          initial={editTarget || {}}
          onSubmit={handleUpdate}
          onCancel={() => setEditTarget(null)}
          loading={saving}
        />
      </Modal>
    </div>
  )
}
