import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { projectsApi } from '../../api/projectsApi'
import { issuesApi } from '../../api/issuesApi'
import { useAuthStore } from '../../store/authStore'
import { useIssueStore } from '../../store/issueStore'
import { formatDateTime } from '../../utils/dateUtils'
import { useToastStore } from '../../store/toastStore'

const REVERTABLE = new Set(['updated', 'status_changed', 'field_changed', 'ki_update', 'reverted'])

function actionLabel(log) {
  if (log.action === 'status_changed')
    return `hat Status geändert: ${log.old_value} → ${log.new_value}`
  if (log.action === 'commented')
    return 'hat kommentiert'
  if (log.action === 'created')
    return log.issue_id ? 'hat Issue erstellt' : 'hat Projekt erstellt'
  if (log.action === 'reverted')
    return `hat ${log.field_changed} zurückgesetzt auf „${log.new_value}"`
  if (log.field_changed)
    return `hat ${log.field_changed} geändert`
  return log.action
}

function groupByDate(logs) {
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const groups = {}
  logs.forEach((log) => {
    const d = new Date(log.timestamp)
    const key = d.toDateString() === today
      ? 'Heute'
      : d.toDateString() === yesterday
      ? 'Gestern'
      : d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    ;(groups[key] = groups[key] || []).push(log)
  })
  return groups
}

export default function ActivityFeed({ projectId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.is_admin
  const upsertIssue = useIssueStore((s) => s.upsertIssue)
  const { showToast, showConfirm } = useToastStore()

  function loadLog() {
    setLoading(true)
    projectsApi.getLog(projectId)
      .then(({ data }) => setLogs(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadLog() }, [projectId])

  async function handleRevert(log) {
    if (!await showConfirm(`„${log.field_changed}" auf „${log.old_value}" zurücksetzen?`)) return
    try {
      const { data } = await issuesApi.revertActivity(log.issue_id, log.id)
      upsertIssue(data)
      loadLog()
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler beim Rückgängigmachen', 'error')
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Lade…</div>
  if (logs.length === 0) return <div className="p-6 text-sm text-gray-400">Keine Aktivitäten vorhanden.</div>

  const groups = groupByDate(logs)

  return (
    <div className="p-6 max-w-2xl">
      {Object.entries(groups).map(([date, entries]) => (
        <div key={date} className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{date}</h3>
          <ul className="space-y-2">
            {entries.map((log) => {
              const canRevert = isAdmin
                && log.field_changed
                && log.old_value !== null && log.old_value !== undefined
                && ['updated', 'status_changed', 'field_changed', 'ki_update', 'reverted'].includes(log.action)
              return (
                <li key={log.id} className="flex gap-3 items-start text-sm">
                  <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {(log.user_name || '?')[0].toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-gray-800">{log.user_name || 'System'}</span>{' '}
                    <span className="text-gray-600">{actionLabel(log)}</span>
                    {log.issue_id && (
                      <Link
                        to={`/projects/${log.project_id}/issues/${log.issue_id}`}
                        className="text-primary-600 hover:underline text-xs ml-1"
                      >
                        #{log.issue_id}{log.issue_title ? `: ${log.issue_title}` : ''}
                      </Link>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(log.timestamp)}</div>
                  </div>
                  {canRevert && (
                    <button
                      onClick={() => handleRevert(log)}
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
        </div>
      ))}
    </div>
  )
}
