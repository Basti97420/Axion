import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '../../store/notificationStore'
import { useIssueStore } from '../../store/issueStore'
import { useProjectStore } from '../../store/projectStore'
import { worklogsApi } from '../../api/worklogsApi'
import { formatDate } from '../../utils/dateUtils'

export default function NotificationDrawer() {
  const isOpen = useNotificationStore((s) => s.isOpen)
  const close = useNotificationStore((s) => s.close)
  const navigate = useNavigate()

  const issues = useIssueStore((s) => s.issues)
  const projectStatuses = useProjectStore((s) => s.currentProjectStatuses)

  const [pending, setPending] = useState([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [actionLoading, setActionLoading] = useState({})

  // Überfällige Issues: due_date < heute, Status nicht is_closed
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const closedKeys = new Set(projectStatuses.filter((s) => s.is_closed).map((s) => s.key))
  const overdue = issues.filter((i) => {
    if (!i.due_date) return false
    if (closedKeys.has(i.status)) return false
    return new Date(i.due_date) < today
  })

  function loadPending() {
    setLoadingPending(true)
    worklogsApi.getPending()
      .then(({ data }) => setPending(data))
      .catch(() => {})
      .finally(() => setLoadingPending(false))
  }

  useEffect(() => {
    if (isOpen) loadPending()
  }, [isOpen])

  async function handleConfirm(id) {
    setActionLoading((prev) => ({ ...prev, [id]: 'confirm' }))
    try {
      await worklogsApi.confirm(id)
      setPending((prev) => prev.filter((w) => w.id !== id))
    } catch {}
    finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n })
    }
  }

  async function handleReject(id) {
    setActionLoading((prev) => ({ ...prev, [id]: 'reject' }))
    try {
      await worklogsApi.remove(id)
      setPending((prev) => prev.filter((w) => w.id !== id))
    } catch {}
    finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n })
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop (kein Block, nur für Klick-Schließen) */}
      <div className="fixed inset-0 z-40" onClick={close} />

      {/* Drawer */}
      <div className="fixed right-0 top-14 bottom-0 w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">Benachrichtigungen</h2>
          <button onClick={close} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Sektion: Kalender-Buchungen */}
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              🗓 Kalender-Buchungen
            </h3>
            {loadingPending ? (
              <p className="text-xs text-gray-400 py-2">Lade…</p>
            ) : pending.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">Keine offenen Buchungen.</p>
            ) : (
              <div className="space-y-2">
                {pending.map((w) => (
                  <div key={w.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-medium text-gray-800 truncate">{w.issue_title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {w.project_name} · {formatDate(w.date)} · {w.duration_h}h
                    </p>
                    {w.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{w.description}</p>
                    )}
                    <div className="flex gap-2 mt-2.5">
                      <button
                        onClick={() => handleConfirm(w.id)}
                        disabled={!!actionLoading[w.id]}
                        className="flex-1 text-xs font-medium bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-1.5 rounded-lg transition-colors"
                      >
                        {actionLoading[w.id] === 'confirm' ? '…' : '✓ Bestätigen'}
                      </button>
                      <button
                        onClick={() => handleReject(w.id)}
                        disabled={!!actionLoading[w.id]}
                        className="flex-1 text-xs font-medium bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 border border-red-200 py-1.5 rounded-lg transition-colors"
                      >
                        {actionLoading[w.id] === 'reject' ? '…' : '✕ Ablehnen'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sektion: Überfällige Issues */}
          <div className="px-4 py-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              ⚠️ Überfällige Issues
            </h3>
            {overdue.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">Keine überfälligen Issues.</p>
            ) : (
              <div className="space-y-1.5">
                {overdue.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => { navigate(`/projects/${i.project_id}/issues/${i.id}`); close() }}
                    className="w-full text-left bg-red-50 border border-red-200 rounded-lg p-2.5 hover:bg-red-100 transition-colors"
                  >
                    <p className="text-xs font-medium text-gray-800 truncate">{i.title}</p>
                    <p className="text-xs text-red-600 mt-0.5">Fällig: {formatDate(i.due_date)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {(pending.length > 0 || overdue.length > 0) && (
          <div className="px-4 py-2 border-t border-gray-100 shrink-0">
            <p className="text-xs text-gray-400 text-center">
              {pending.length + overdue.length} offene Benachrichtigung{pending.length + overdue.length !== 1 ? 'en' : ''}
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// Hook um Badge-Count zu ermitteln (für Navbar)
export function useNotificationCount() {
  const issues = useIssueStore((s) => s.issues)
  const projectStatuses = useProjectStore((s) => s.currentProjectStatuses)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    worklogsApi.getPending()
      .then(({ data }) => setPendingCount(data.length))
      .catch(() => {})
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const closedKeys = new Set(projectStatuses.filter((s) => s.is_closed).map((s) => s.key))
  const overdueCount = issues.filter((i) => {
    if (!i.due_date) return false
    if (closedKeys.has(i.status)) return false
    return new Date(i.due_date) < today
  }).length

  return pendingCount + overdueCount
}
