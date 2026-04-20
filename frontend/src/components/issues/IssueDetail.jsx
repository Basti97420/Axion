import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigate, Link } from 'react-router-dom'
import Badge from '../common/Badge'
import Button from '../common/Button'
import Modal from '../common/Modal'
import ContextMenu from '../common/ContextMenu'
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
import { useToastStore } from '../../store/toastStore'

const ACTION_DOT = {
  status_changed: 'bg-blue-400',
  commented:      'bg-green-400',
  reverted:       'bg-orange-400',
  ki_update:      'bg-purple-400',
  ki_comment:     'bg-purple-400',
  ki_create:      'bg-purple-400',
}

function SubtasksBlock({ subtasks, projectId }) {
  const done = subtasks.filter((s) => s.status === 'done').length
  const pct = subtasks.length > 0 ? Math.round((done / subtasks.length) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Unteraufgaben ({done}/{subtasks.length})
        </h2>
        <span className="text-xs text-gray-400">{pct} %</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1 mb-3">
        <div className="bg-primary-500 h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="space-y-0.5">
        {subtasks.map((st) => (
          <Link
            key={st.id}
            to={`/projects/${projectId}/issues/${st.id}`}
            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 group"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[st.status] || 'bg-gray-300'}`} />
            <span className={`text-sm flex-1 min-w-0 truncate group-hover:text-primary-600 ${st.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
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

function MetaItem({ label, value }) {
  if (!value) return null
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-700 font-medium">{value}</span>
    </span>
  )
}

export default function IssueDetail({ issue, projectId }) {
  const navigate = useNavigate()
  const { upsertIssue, removeIssue } = useIssueStore()
  const user = useAuthStore((s) => s.user)
  const { showToast, showConfirm } = useToastStore()
  const [activity, setActivity] = useState([])
  const [comments, setComments] = useState([])
  const [worklogs, setWorklogs] = useState([])
  const [attachments, setAttachments] = useState([])
  const [subtasks, setSubtasks] = useState([])
  const [parentIssue, setParentIssue] = useState(null)
  const allIssues = useIssueStore((s) => s.issues)
  const [newComment, setNewComment] = useState('')
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [tab, setTab] = useState('activity')
  const fileInputRef = useRef(null)
  const menuRef = useRef(null)
  const [editOpen, setEditOpen] = useState(false)
  const [icloudOpen, setIcloudOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [showPreview, setShowPreview] = useState({})
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState([]) // [{name, done, error}]
  const [attMenu, setAttMenu] = useState(null) // Rechtsklick auf Anhang

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

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
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    e.target.value = ''
    const slots = files.map((f) => ({ name: f.name, done: false, error: false }))
    setUploadingFiles(slots)
    await Promise.all(files.map(async (file, i) => {
      try {
        const { data } = await attachmentsApi.upload(issue.id, file)
        setAttachments((prev) => [data, ...prev])
        setUploadingFiles((prev) => prev.map((s, j) => j === i ? { ...s, done: true } : s))
      } catch {
        setUploadingFiles((prev) => prev.map((s, j) => j === i ? { ...s, error: true } : s))
      }
    }))
    setTimeout(() => setUploadingFiles([]), 2000)
  }

  async function handleDeleteAttachment(attId) {
    await attachmentsApi.remove(attId)
    setAttachments((prev) => prev.filter((a) => a.id !== attId))
  }

  function handleDragOver(e) {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      setIsDraggingFile(true)
    }
  }
  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDraggingFile(false)
  }
  async function handleDrop(e) {
    e.preventDefault()
    setIsDraggingFile(false)
    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return
    const slots = files.map((f) => ({ name: f.name, done: false, error: false }))
    setUploadingFiles(slots)
    await Promise.all(files.map(async (file, i) => {
      try {
        const { data } = await attachmentsApi.upload(issue.id, file)
        setAttachments((prev) => [data, ...prev])
        setUploadingFiles((prev) => prev.map((s, j) => j === i ? { ...s, done: true } : s))
      } catch {
        setUploadingFiles((prev) => prev.map((s, j) => j === i ? { ...s, error: true } : s))
      }
    }))
    setTimeout(() => setUploadingFiles([]), 2000)
  }

  function openAttMenu(e, att) {
    e.preventDefault()
    const preview = attachmentsApi.previewUrl(att.id)
    setAttMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { icon: '⬇', label: 'Herunterladen', onClick: () => attachmentsApi.download(att.id) },
        { icon: '👁', label: 'Vorschau öffnen', onClick: () => window.open(preview, '_blank') },
        { icon: '🔗', label: 'URL kopieren', onClick: () => navigator.clipboard.writeText(preview) },
        { divider: true },
        ...(att.uploader_id === user?.id || user?.is_admin ? [{
          icon: '🗑', label: 'Löschen', danger: true,
          onClick: () => handleDeleteAttachment(att.id),
        }] : []),
      ],
    })
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
      showToast(err.response?.data?.error || 'Fehler', 'error')
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
      // silent
    }
  }

  async function handleDelete() {
    if (!await showConfirm(`Issue "${issue.title}" wirklich löschen?`)) return
    let deleteSubtasks = false
    const subtaskCount = issue.subtasks_count || 0
    if (issue.type === 'story' && subtaskCount > 0) {
      deleteSubtasks = await showConfirm(`Diese Story hat ${subtaskCount} Unteraufgabe${subtaskCount !== 1 ? 'n' : ''}. Sollen diese ebenfalls gelöscht werden?`)
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

  const tabs = [
    { key: 'activity',    label: 'Aktivität',    count: activity.length },
    { key: 'comments',    label: 'Kommentare',   count: comments.length },
    { key: 'worklog',     label: 'Zeiterfassung', count: worklogs.length },
    { key: 'attachments', label: 'Anhänge',      count: attachments.length },
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                #{issue.id}
              </span>
              <span className="text-xs text-gray-400 capitalize">{issue.type}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-snug">{issue.title}</h1>
          </div>

          {/* Kebab-Menü */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Aktionen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5"/>
                <circle cx="12" cy="12" r="1.5"/>
                <circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                <button
                  onClick={() => { setIcloudOpen(true); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  📅 iCloud
                </button>
                <button
                  onClick={() => { setEditOpen(true); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  ✎ Bearbeiten
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { setMenuOpen(false); handleDelete() }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  🗑 Löschen
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status-Fehler */}
        {statusError && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {statusError}
          </div>
        )}

        {/* ── Status + Priorität + Tags ── */}
        <div className="flex flex-wrap gap-2 items-center mb-1">
          <div className="relative">
            <select
              value={issue.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className={`appearance-none text-xs font-semibold px-2.5 py-1 rounded-full pr-6 cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-primary-400 ${STATUS_COLORS[issue.status]}`}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs opacity-50">▾</span>
          </div>
          <div className="relative">
            <select
              value={issue.priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className={`appearance-none text-xs font-semibold px-2.5 py-1 rounded-full pr-6 cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-primary-400 ${PRIORITY_COLORS[issue.priority]}`}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_ICONS[p]} {PRIORITY_LABELS[p]}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs opacity-50">▾</span>
          </div>
          {issue.tags?.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: tag.color + '22', color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>

        {/* ── Sektionen mit Trennlinien ── */}
        <div className="divide-y divide-gray-200">

          {/* Metadaten */}
          <div className="py-3">
            <div className="bg-slate-50 rounded-xl px-4 py-3 flex flex-wrap gap-x-5 gap-y-2">
              <MetaItem label="Erstellt von" value={issue.creator_name} />
              <MetaItem label="Zugewiesen" value={issue.assignee_name} />
              <MetaItem label="Fällig" value={formatDate(issue.due_date)} />
              <MetaItem label="Start" value={formatDate(issue.start_date)} />
              <MetaItem label="Schätzung" value={issue.estimated_hours ? `${issue.estimated_hours} h` : null} />
              <MetaItem label="Meilenstein" value={issue.milestone_name} />
              <MetaItem label="Erstellt" value={formatDateTime(issue.created_at)} />
              <MetaItem label="Geändert" value={formatDateTime(issue.updated_at)} />
            </div>
          </div>

          {/* Beschreibung */}
          {issue.description && (
            <div className="py-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Beschreibung</h2>
              <div className="prose prose-sm max-w-none text-gray-800">
                <ReactMarkdown>{issue.description}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Übergeordnete Story */}
          {issue.type === 'subtask' && parentIssue && (
            <div className="py-4">
              <div className="flex items-center gap-2 text-sm pl-3 py-1.5 border-l-2 border-primary-300 bg-primary-50/50 rounded-r-lg">
                <span className="text-gray-400">Story</span>
                <Link
                  to={`/projects/${projectId}/issues/${parentIssue.id}`}
                  className="font-medium text-primary-600 hover:text-primary-800 truncate"
                >
                  #{parentIssue.id} {parentIssue.title}
                </Link>
              </div>
            </div>
          )}

          {/* Abhängigkeiten */}
          <div className="py-4">
            <DependenciesSection issueId={issue.id} projectId={projectId} />
          </div>

          {/* Unteraufgaben */}
          {issue.type === 'story' && subtasks.length > 0 && (
            <div className="py-4">
              <SubtasksBlock subtasks={subtasks} projectId={projectId} />
            </div>
          )}

          {/* ── Tabs ── */}
          <div className="pt-6">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-full w-fit mb-5">
              {tabs.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    tab === key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-1.5 text-xs ${tab === key ? 'text-gray-500' : 'text-gray-400'}`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Aktivität */}
            {tab === 'activity' && (
              <ul className="space-y-1">
                {activity.length === 0 && (
                  <li className="text-sm text-gray-400 py-2">Keine Aktivität</li>
                )}
                {activity.map((log) => {
                  const canRevert = user?.is_admin
                    && log.field_changed
                    && log.old_value !== null && log.old_value !== undefined
                    && ['updated', 'status_changed', 'field_changed', 'ki_update', 'reverted'].includes(log.action)
                  return (
                    <li key={log.id} className="flex gap-3 text-sm items-start py-1.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ACTION_DOT[log.action] || 'bg-gray-300'}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-600">
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
                        <span className="text-xs text-gray-400 block mt-0.5">{formatDateTime(log.timestamp)}</span>
                      </div>
                      {canRevert && (
                        <button
                          onClick={async () => {
                            if (!await showConfirm(`„${log.field_changed}" auf „${log.old_value}" zurücksetzen?`)) return
                            try {
                              const { data: updated } = await issuesApi.revertActivity(issue.id, log.id)
                              upsertIssue(updated)
                              const { data } = await issuesApi.getActivity(issue.id)
                              setActivity(data)
                            } catch (err) {
                              showToast(err.response?.data?.error || 'Fehler beim Rückgängigmachen', 'error')
                            }
                          }}
                          title="Rückgängig machen"
                          className="text-gray-300 hover:text-orange-500 transition-colors px-1 shrink-0 mt-0.5"
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

            {/* Kommentare */}
            {tab === 'comments' && (
              <div className="space-y-5">
                {comments.length === 0 && (
                  <p className="text-sm text-gray-400 py-2">Noch keine Kommentare</p>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {(c.author_name || 'U')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-gray-900">{c.author_name}</span>
                        <span className="text-xs text-gray-400">{formatDateTime(c.created_at)}</span>
                        {(c.author_id === user?.id) && (
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            className="text-xs text-gray-300 hover:text-red-500 ml-auto transition-colors"
                          >
                            Löschen
                          </button>
                        )}
                      </div>
                      <div className="prose prose-sm max-w-none text-gray-700">
                        <ReactMarkdown>{c.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
                  <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-bold shrink-0">
                    {(user?.username || 'U')[0].toUpperCase()}
                  </div>
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Kommentar hinzufügen…"
                    className="flex-1 border border-gray-200 rounded-full px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  />
                  <Button type="submit" size="sm">Senden</Button>
                </form>
              </div>
            )}

            {/* Zeiterfassung */}
            {tab === 'worklog' && (
              <div className="space-y-4">
                <WorklogTimer onStop={handleWorklogSave} />
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
                <WorklogList worklogs={worklogs} onDelete={handleWorklogDelete} />
              </div>
            )}

            {/* Anhänge */}
            {tab === 'attachments' && (
              <div
                className={`space-y-3 rounded-xl transition-all ${
                  isDraggingFile ? 'ring-2 ring-primary-400 bg-primary-50 p-3' : ''
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex items-center gap-3">
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    + Datei hochladen
                  </button>
                  <span className="text-xs text-gray-400">oder Dateien hierher ziehen</span>
                </div>

                {isDraggingFile && (
                  <div className="text-center py-6 text-primary-600 font-medium text-sm">
                    ⬇ Dateien loslassen zum Hochladen
                  </div>
                )}

                {/* Upload-Fortschritt */}
                {uploadingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    {f.done ? '✓' : f.error ? '✗' : '⏳'}
                    <span className={f.error ? 'text-red-500' : f.done ? 'text-green-600' : ''}>
                      {f.name}
                    </span>
                  </div>
                ))}

                {attachments.length === 0 && uploadingFiles.length === 0 && !isDraggingFile && (
                  <p className="text-sm text-gray-400 text-center py-6">
                    📎 Noch keine Anhänge — Dateien hochladen oder hierher ziehen
                  </p>
                )}

                {attachments.map((att) => {
                  const isImage = att.mime_type?.startsWith('image/')
                  const isPdf   = att.mime_type === 'application/pdf'
                  const preview = attachmentsApi.previewUrl(att.id)
                  return (
                    <div
                      key={att.id}
                      className="border border-gray-100 rounded-xl p-3 hover:border-gray-200 transition-colors cursor-context-menu"
                      onContextMenu={(e) => openAttMenu(e, att)}
                    >
                      <div className="flex items-center gap-3">
                        {isImage ? (
                          <img
                            src={preview}
                            alt={att.original_name}
                            className="w-10 h-10 object-cover rounded-lg shrink-0 cursor-pointer border border-gray-100"
                            onClick={() => window.open(preview, '_blank')}
                          />
                        ) : isPdf ? (
                          <div className="w-10 h-10 bg-red-50 border border-red-100 rounded-lg flex items-center justify-center text-red-400 text-xs font-bold shrink-0">PDF</div>
                        ) : (
                          <div className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-300 text-lg shrink-0">📄</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 font-medium truncate">{att.original_name}</p>
                          <p className="text-xs text-gray-400">{formatFileSize(att.size)} · {att.uploader_name}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {isPdf && (
                            <button
                              onClick={() => setShowPreview((p) => ({ ...p, [att.id]: !p[att.id] }))}
                              className="text-xs text-primary-600 hover:text-primary-800"
                            >
                              {showPreview[att.id] ? 'Einklappen' : 'Vorschau'}
                            </button>
                          )}
                          <button onClick={() => attachmentsApi.download(att.id)} className="text-xs text-primary-600 hover:text-primary-800">↓ Laden</button>
                          {(att.uploader_id === user?.id || user?.is_admin) && (
                            <button onClick={() => handleDeleteAttachment(att.id)} className="text-xs text-gray-300 hover:text-red-500 transition-colors">Löschen</button>
                          )}
                        </div>
                      </div>
                      {isPdf && showPreview[att.id] && (
                        <iframe src={preview} title={att.original_name} className="w-full h-48 mt-3 rounded-lg border border-gray-100" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {attMenu && (
              <ContextMenu x={attMenu.x} y={attMenu.y} items={attMenu.items} onClose={() => setAttMenu(null)} />
            )}
          </div>
        </div>
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
