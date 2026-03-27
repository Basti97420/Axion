import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigate, Link } from 'react-router-dom'
import Badge from '../common/Badge'
import Button from '../common/Button'
import Modal from '../common/Modal'
import IssueForm from './IssueForm'
import IcloudEventModal from '../calendar/IcloudEventModal'
import WorklogTimer from '../worklog/WorklogTimer'
import WorklogEntry from '../worklog/WorklogEntry'
import WorklogList from '../worklog/WorklogList'
import { STATUS_COLORS, STATUS_DOT, STATUS_LABELS, STATUSES } from '../../utils/statusColors'
import { PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_ICONS, PRIORITIES } from '../../utils/priorityUtils'
import { formatDate, formatDateTime } from '../../utils/dateUtils'
import { issuesApi } from '../../api/issuesApi'
import { worklogApi } from '../../api/worklogApi'
import { attachmentsApi } from '../../api/attachmentsApi'
import { useIssueStore } from '../../store/issueStore'
import { useAuthStore } from '../../store/authStore'
import DependenciesSection from './DependenciesSection'

function SubtasksBlock({ subtasks, projectId }) {
  const done = subtasks.filter((s) => s.status === 'done').length
  const pct = subtasks.length > 0 ? Math.round((done / subtasks.length) * 100) : 0
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700">
          Unteraufgaben ({done}/{subtasks.length})
        </h2>
        <span className="text-xs text-gray-400">{pct} % abgeschlossen</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="space-y-1">
        {subtasks.map((st) => (
          <Link
            key={st.id}
            to={`/projects/${projectId}/issues/${st.id}`}
            className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 group"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[st.status] || 'bg-gray-400'}`} />
            <span className={`text-sm flex-1 min-w-0 truncate group-hover:text-primary-600 ${st.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              #{st.id} {st.title}
            </span>
            <span className="text-xs text-gray-400 shrink-0">{PRIORITY_ICONS[st.priority]}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function IssueDetail({ issue, projectId }) {
  const navigate = useNavigate()
  const { upsertIssue, removeIssue } = useIssueStore()
  const user = useAuthStore((s) => s.user)
  const [activity, setActivity] = useState([])
  const [comments, setComments] = useState([])
  const [worklogs, setWorklogs] = useState([])
  const [attachments, setAttachments] = useState([])
  const [subtasks, setSubtasks] = useState([])
  const [parentIssue, setParentIssue] = useState(null)
  const allIssues = useIssueStore((s) => s.issues)
  const [newComment, setNewComment] = useState('')
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [tab, setTab] = useState('activity') // 'activity' | 'comments' | 'worklog' | 'attachments'
  const fileInputRef = useRef(null)
  const [editOpen, setEditOpen] = useState(false)
  const [icloudOpen, setIcloudOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [showPreview, setShowPreview] = useState({})

  useEffect(() => {
    issuesApi.getActivity(issue.id).then(({ data }) => setActivity(data)).catch(() => {})
    issuesApi.getComments(issue.id).then(({ data }) => setComments(data)).catch(() => {})
    worklogApi.getAll(issue.id).then(({ data }) => setWorklogs(data)).catch(() => {})
    attachmentsApi.getList(issue.id).then(({ data }) => setAttachments(data)).catch(() => {})
    if (issue.type === 'story') {
      issuesApi.getSubtasks(issue.id).then(({ data }) => setSubtasks(data)).catch(() => {})
    } else {
      setSubtasks([])
    }
    if (issue.type === 'subtask' && issue.parent_id) {
      const fromStore = allIssues.find((i) => i.id === issue.parent_id)
      if (fromStore) {
        setParentIssue(fromStore)
      } else {
        issuesApi.getOne(issue.parent_id).then(({ data }) => setParentIssue(data)).catch(() => {})
      }
    } else {
      setParentIssue(null)
    }
  }, [issue.id, issue.type, issue.parent_id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { data } = await attachmentsApi.upload(issue.id, file)
      setAttachments((prev) => [data, ...prev])
    } catch (err) {
      alert(err.response?.data?.error || 'Upload fehlgeschlagen')
    } finally {
      e.target.value = ''
    }
  }

  async function handleDeleteAttachment(attId) {
    await attachmentsApi.remove(attId)
    setAttachments((prev) => prev.filter((a) => a.id !== attId))
  }

  async function handleWorklogSave(data) {
    const { data: wl } = await worklogApi.create(issue.id, data)
    setWorklogs((prev) => [wl, ...prev])
    setShowManualEntry(false)
  }

  async function handleWorklogDelete(worklogId) {
    await worklogApi.remove(worklogId)
    setWorklogs((prev) => prev.filter((w) => w.id !== worklogId))
  }

  async function handleEdit(data) {
    setSaving(true)
    try {
      const { data: updated } = await issuesApi.update(issue.id, data)
      upsertIssue(updated)
      setEditOpen(false)
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(newStatus) {
    setStatusError('')
    try {
      const { data: updated } = await issuesApi.patchStatus(issue.id, newStatus)
      upsertIssue(updated)
    } catch (err) {
      const msg = err.response?.data?.error || 'Status konnte nicht geändert werden'
      setStatusError(msg)
      setTimeout(() => setStatusError(''), 6000)
    }
  }

  async function handlePriorityChange(newPriority) {
    try {
      const { data: updated } = await issuesApi.patchPriority(issue.id, newPriority)
      upsertIssue(updated)
    } catch {
      // silent – kein kritischer Fehler
    }
  }

  async function handleDelete() {
    if (!confirm(`Issue "${issue.title}" wirklich löschen?`)) return
    let deleteSubtasks = false
    const subtaskCount = issue.subtasks_count || 0
    if (issue.type === 'story' && subtaskCount > 0) {
      deleteSubtasks = confirm(`Diese Story hat ${subtaskCount} Unteraufgabe${subtaskCount !== 1 ? 'n' : ''}. Sollen diese ebenfalls gelöscht werden?`)
    }
    await issuesApi.remove(issue.id, deleteSubtasks)
    removeIssue(issue.id)
    navigate(`/projects/${projectId}`)
  }

  async function handleAddComment(e) {
    e.preventDefault()
    if (!newComment.trim()) return
    const { data } = await issuesApi.addComment(issue.id, newComment.trim())
    setComments((prev) => [...prev, data])
    setNewComment('')
  }

  async function handleDeleteComment(cid) {
    await issuesApi.deleteComment(issue.id, cid)
    setComments((prev) => prev.filter((c) => c.id !== cid))
  }

  const field = (label, value) => (
    <div>
      <dt className="text-xs font-medium text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-900">{value || '—'}</dd>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-mono mb-1">#{issue.id}</p>
            <h1 className="text-xl font-semibold text-gray-900">{issue.title}</h1>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="secondary" onClick={() => setIcloudOpen(true)}>📅 iCloud</Button>
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>Bearbeiten</Button>
            <Button size="sm" variant="danger" onClick={handleDelete}>Löschen</Button>
          </div>
        </div>

        {/* Status-Fehler */}
        {statusError && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {statusError}
          </div>
        )}

        {/* Status + Priorität */}
        <div className="flex flex-wrap gap-2 mb-5 items-center">
          {/* Status-Dropdown */}
          <div className="relative">
            <select
              value={issue.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className={`appearance-none text-xs font-medium px-2.5 py-1 rounded-full pr-6 cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-primary-400 ${STATUS_COLORS[issue.status]}`}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs opacity-60">▾</span>
          </div>
          <div className="relative">
            <select
              value={issue.priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className={`appearance-none text-xs font-medium px-2.5 py-1 rounded-full pr-6 cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-primary-400 ${PRIORITY_COLORS[issue.priority]}`}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_ICONS[p]} {PRIORITY_LABELS[p]}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs opacity-60">▾</span>
          </div>
          {issue.tags?.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: tag.color + '33', color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>

        {/* Felder */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-gray-50 rounded-xl p-4 mb-5 text-sm">
          {field('Typ', issue.type)}
          {field('Erstellt von', issue.creator_name)}
          {field('Zugewiesen an', issue.assignee_name)}
          {field('Fällig am', formatDate(issue.due_date))}
          {field('Startdatum', formatDate(issue.start_date))}
          {field('Schätzung', issue.estimated_hours ? `${issue.estimated_hours} h` : null)}
          {field('Erstellt', formatDateTime(issue.created_at))}
          {field('Geändert', formatDateTime(issue.updated_at))}
          {issue.milestone_name && field('Meilenstein', issue.milestone_name)}
        </dl>

        {/* Beschreibung */}
        {issue.description && (
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Beschreibung</h2>
            <div className="prose prose-sm max-w-none bg-gray-50 rounded-lg p-4 text-gray-800">
              <ReactMarkdown>{issue.description}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Übergeordnete Story (nur bei Unteraufgaben) */}
        {issue.type === 'subtask' && parentIssue && (
          <div className="mb-5 bg-blue-50 rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
            <span className="text-gray-500 shrink-0">Story:</span>
            <Link
              to={`/projects/${projectId}/issues/${parentIssue.id}`}
              className="font-medium text-primary-600 hover:text-primary-800 truncate"
            >
              #{parentIssue.id} {parentIssue.title}
            </Link>
          </div>
        )}

        {/* Abhängigkeiten */}
        <DependenciesSection issueId={issue.id} projectId={projectId} />

        {/* Unteraufgaben (nur bei Stories) */}
        {issue.type === 'story' && subtasks.length > 0 && (
          <SubtasksBlock subtasks={subtasks} projectId={projectId} />
        )}

        {/* Tabs: Aktivität / Kommentare / Zeiterfassung / Anhänge */}
        <div className="border-b border-gray-200 mb-4">
          <div className="flex gap-1">
            {[
              { key: 'activity',    label: `Aktivität (${activity.length})` },
              { key: 'comments',    label: `Kommentare (${comments.length})` },
              { key: 'worklog',     label: `Zeiterfassung (${worklogs.length})` },
              { key: 'attachments', label: `Anhänge (${attachments.length})` },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === key
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'activity' && (
          <ul className="space-y-2">
            {activity.length === 0 && <li className="text-sm text-gray-400">Keine Aktivität</li>}
            {activity.map((log) => {
              const canRevert = user?.is_admin
                && log.field_changed
                && log.old_value !== null && log.old_value !== undefined
                && ['updated', 'status_changed', 'field_changed', 'ki_update', 'reverted'].includes(log.action)
              return (
                <li key={log.id} className="flex gap-3 text-sm items-start">
                  <span className="text-gray-400 text-xs shrink-0 mt-0.5">{formatDateTime(log.timestamp)}</span>
                  <span className="text-gray-600 flex-1">
                    <span className="font-medium text-gray-800">{log.user_name || 'System'}</span>{' '}
                    {log.action === 'status_changed'
                      ? `hat Status geändert: ${log.old_value} → ${log.new_value}`
                      : log.action === 'commented'
                      ? 'hat kommentiert'
                      : log.action === 'reverted'
                      ? `hat ${log.field_changed} zurückgesetzt auf „${log.new_value}"`
                      : log.action === 'ki_update'
                      ? `🤖 hat ${log.field_changed} geändert: ${log.old_value} → ${log.new_value}`
                      : log.action === 'ki_comment'
                      ? '🤖 hat einen KI-Kommentar hinzugefügt'
                      : log.action === 'ki_create'
                      ? '🤖 hat dieses Issue erstellt'
                      : log.field_changed
                      ? `hat ${log.field_changed} geändert`
                      : log.action}
                  </span>
                  {canRevert && (
                    <button
                      onClick={async () => {
                        if (!window.confirm(`„${log.field_changed}" auf „${log.old_value}" zurücksetzen?`)) return
                        try {
                          const { data: updated } = await issuesApi.revertActivity(issue.id, log.id)
                          upsertIssue(updated)
                          const { data } = await issuesApi.getActivity(issue.id)
                          setActivity(data)
                        } catch (err) {
                          alert(err.response?.data?.error || 'Fehler beim Rückgängigmachen')
                        }
                      }}
                      title="Rückgängig machen"
                      className="text-gray-300 hover:text-orange-500 transition-colors px-1 shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7h10a5 5 0 0 1 0 10H3"/><polyline points="7 3 3 7 7 11"/>
                      </svg>
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {tab === 'comments' && (
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{c.author_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{formatDateTime(c.created_at)}</span>
                    {(c.author_id === user?.id) && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-xs text-gray-400 hover:text-red-600"
                      >
                        Löschen
                      </button>
                    )}
                  </div>
                </div>
                <div className="prose prose-sm max-w-none text-gray-800">
                  <ReactMarkdown>{c.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            <form onSubmit={handleAddComment} className="flex gap-2 mt-3">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Kommentar hinzufügen…"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Button type="submit" size="sm">Senden</Button>
            </form>
          </div>
        )}

      {tab === 'worklog' && (
          <div className="space-y-4">
            {/* Timer */}
            <WorklogTimer onStop={handleWorklogSave} />

            {/* Manuelle Eingabe */}
            {showManualEntry ? (
              <WorklogEntry
                issueId={issue.id}
                onSaved={handleWorklogSave}
                onCancel={() => setShowManualEntry(false)}
              />
            ) : (
              <button
                onClick={() => setShowManualEntry(true)}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                + Manuell eintragen
              </button>
            )}

            {/* Liste */}
            <WorklogList worklogs={worklogs} onDelete={handleWorklogDelete} />
          </div>
        )}

      {tab === 'attachments' && (
        <div className="space-y-3">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
            >
              + Datei hochladen
            </button>
          </div>
          {attachments.length === 0 && (
            <p className="text-sm text-gray-400">Keine Anhänge</p>
          )}
          {attachments.map((att) => {
            const isImage = att.mime_type?.startsWith('image/')
            const isPdf   = att.mime_type === 'application/pdf'
            const preview = attachmentsApi.previewUrl(att.id)
            return (
              <div key={att.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  {/* Icon / Thumbnail */}
                  {isImage ? (
                    <img
                      src={preview}
                      alt={att.original_name}
                      className="w-10 h-10 object-cover rounded shrink-0 cursor-pointer border border-gray-200"
                      onClick={() => window.open(preview, '_blank')}
                    />
                  ) : isPdf ? (
                    <div className="w-10 h-10 bg-red-50 border border-red-200 rounded flex items-center justify-center text-red-500 text-xs font-bold shrink-0">
                      PDF
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-lg shrink-0">
                      📄
                    </div>
                  )}

                  {/* Name + Metadaten */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium truncate">{att.original_name}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(att.size)} · {att.uploader_name}</p>
                  </div>

                  {/* Aktionen */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isPdf && (
                      <button
                        onClick={() => setShowPreview((p) => ({ ...p, [att.id]: !p[att.id] }))}
                        className="text-xs text-primary-600 hover:text-primary-800"
                      >
                        {showPreview[att.id] ? 'Einklappen' : 'Vorschau'}
                      </button>
                    )}
                    <button
                      onClick={() => attachmentsApi.download(att.id)}
                      className="text-xs text-primary-600 hover:text-primary-800"
                    >
                      ↓ Laden
                    </button>
                    {(att.uploader_id === user?.id || user?.is_admin) && (
                      <button
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="text-xs text-gray-400 hover:text-red-600"
                      >
                        Löschen
                      </button>
                    )}
                  </div>
                </div>

                {/* PDF-Vorschau */}
                {isPdf && showPreview[att.id] && (
                  <iframe
                    src={preview}
                    title={att.original_name}
                    className="w-full h-48 mt-2 rounded border border-gray-200"
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
      </div>

      {/* iCloud Modal */}
      <IcloudEventModal
        open={icloudOpen}
        onClose={() => setIcloudOpen(false)}
        issue={issue}
      />

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Issue bearbeiten" size="lg">
        <IssueForm
          initial={issue}
          projectId={projectId}
          onSubmit={handleEdit}
          onCancel={() => setEditOpen(false)}
          loading={saving}
        />
      </Modal>
    </div>
  )
}
