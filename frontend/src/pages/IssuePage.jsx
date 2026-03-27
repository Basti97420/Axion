import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { projectsApi } from '../api/projectsApi'
import { issuesApi } from '../api/issuesApi'
import { useProjectStore } from '../store/projectStore'
import { useIssueStore } from '../store/issueStore'
import IssueList from '../components/issues/IssueList'
import IssueDetail from '../components/issues/IssueDetail'
import IssueForm from '../components/issues/IssueForm'
import Modal from '../components/common/Modal'

export default function IssuePage() {
  const { projectId, issueId } = useParams()
  const id = parseInt(projectId)

  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const currentProject = useProjectStore((s) => s.currentProject)
  const { setIssues, upsertIssue, setCurrentIssue } = useIssueStore()
  const currentIssue = useIssueStore((s) => s.currentIssue)

  const [filters, setFilters] = useState({})
  const [showNewIssue, setShowNewIssue] = useState(false)
  const [saving, setSaving] = useState(false)

  // Projekt + alle Issues laden
  useEffect(() => {
    projectsApi.getOne(id).then(({ data }) => setCurrentProject(data)).catch(() => {})
    projectsApi.getIssues(id).then(({ data }) => setIssues(data)).catch(() => {})
  }, [id])

  // Aktuelles Issue laden
  useEffect(() => {
    issuesApi.getOne(parseInt(issueId))
      .then(({ data }) => setCurrentIssue(data))
      .catch(() => {})
  }, [issueId])

  async function handleNewIssue(data) {
    setSaving(true)
    try {
      const { data: issue } = await issuesApi.create({ ...data, project_id: id })
      upsertIssue(issue)
      setShowNewIssue(false)
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Erstellen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Linke Spalte – Issue-Liste */}
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
          selectedIssueId={parseInt(issueId)}
        />
      </div>

      {/* Rechte Seite – Issue-Detail */}
      <div className="flex-1 overflow-hidden">
        {currentIssue ? (
          <IssueDetail issue={currentIssue} projectId={id} />
        ) : (
          <div className="p-6 text-sm text-gray-400">Wird geladen…</div>
        )}
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
