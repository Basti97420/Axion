import { useEffect, useState, useCallback } from 'react'
import { useParams, useLocation, useSearchParams } from 'react-router-dom'
import { projectsApi } from '../api/projectsApi'
import { issuesApi } from '../api/issuesApi'
import { useProjectStore } from '../store/projectStore'
import { useIssueStore } from '../store/issueStore'
import IssueList from '../components/issues/IssueList'
import KanbanBoard from '../components/kanban/KanbanBoard'
import IssueForm from '../components/issues/IssueForm'
import Modal from '../components/common/Modal'
import ActivityFeed from '../components/project/ActivityFeed'
import MilestoneList from '../components/project/MilestoneList'
import { useToastStore } from '../store/toastStore'

export default function ProjectPage() {
  const { projectId } = useParams()
  const id = parseInt(projectId)
  const location = useLocation()

  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const currentProject = useProjectStore((s) => s.currentProject)
  const { setIssues, upsertIssue } = useIssueStore()
  const currentIssue = useIssueStore((s) => s.currentIssue)

  const { showToast } = useToastStore()
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState({})
  const view = searchParams.get('view') || 'kanban'
  const [showNewIssue, setShowNewIssue] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadIssues = useCallback(() => {
    projectsApi.getIssues(id).then(({ data }) => setIssues(data)).catch(() => {})
  }, [id, setIssues])

  useEffect(() => {
    projectsApi.getOne(id).then(({ data }) => setCurrentProject(data)).catch(() => {})
    loadIssues()
  }, [id])

  // Polling: alle 15 s neu laden, pausiert wenn Tab im Hintergrund
  useEffect(() => {
    const INTERVAL = 15_000
    let timer = null

    function start() {
      if (document.visibilityState === 'visible') {
        timer = setInterval(loadIssues, INTERVAL)
      }
    }
    function stop() { clearInterval(timer); timer = null }

    function onVisibility() {
      if (document.visibilityState === 'visible') { stop(); start() }
      else { stop() }
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [loadIssues])

  // Aktuell geöffnetes Issue aus URL (für Markierung in der Liste)
  const selectedIssueId = location.pathname.match(/issues\/(\d+)/)?.[1]
    ? parseInt(location.pathname.match(/issues\/(\d+)/)[1])
    : null

  async function handleNewIssue(data) {
    setSaving(true)
    try {
      const { data: issue } = await issuesApi.create({ ...data, project_id: id })
      upsertIssue(issue)
      setShowNewIssue(false)
    } catch (err) {
      showToast(err.response?.data?.error || 'Fehler beim Erstellen', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Linke Spalte – Issue-Liste (320px fix) */}
      <div className="w-80 shrink-0 border-r border-gray-200 flex flex-col overflow-hidden">
        {currentProject && (
          <div className="px-3 py-3 border-b border-gray-200 flex items-center gap-2 shrink-0">
            <span
              className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: currentProject.color }}
            >
              {currentProject.key.charAt(0)}
            </span>
            <span className="text-sm font-semibold text-gray-800 truncate">{currentProject.name}</span>
          </div>
        )}
        <IssueList
          projectId={id}
          filters={filters}
          onFiltersChange={setFilters}
          onNewIssue={() => setShowNewIssue(true)}
          onRefresh={loadIssues}
          selectedIssueId={selectedIssueId}
          nativeDraggable={view === 'milestones'}
        />
      </div>

      {/* Rechte Seite */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          {view === 'kanban' && <KanbanBoard projectId={id} />}
          {view === 'activity' && <ActivityFeed projectId={id} />}
          {view === 'milestones' && <MilestoneList projectId={id} />}
        </div>
      </div>

      {/* Neues Issue Modal */}
      <Modal open={showNewIssue} onClose={() => setShowNewIssue(false)} title="Neues Issue">
        <IssueForm
          projectId={id}
          onSubmit={handleNewIssue}
          onCancel={() => setShowNewIssue(false)}
          loading={saving}
        />
      </Modal>
    </div>
  )
}
