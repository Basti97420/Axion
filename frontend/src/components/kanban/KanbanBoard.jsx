import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin } from '@dnd-kit/core'
import { useState } from 'react'
import KanbanColumn from './KanbanColumn'
import StatusManager from './StatusManager'
import { issuesApi } from '../../api/issuesApi'
import { useIssueStore } from '../../store/issueStore'
import { useProjectStore } from '../../store/projectStore'

export default function KanbanBoard({ projectId }) {
  const issues = useIssueStore((s) => s.issues)
  const upsertIssue = useIssueStore((s) => s.upsertIssue)
  const projectStatuses = useProjectStore((s) => s.currentProjectStatuses)
  const [activeIssue, setActiveIssue] = useState(null)
  const [showStatusManager, setShowStatusManager] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragStart({ active }) {
    setActiveIssue(issues.find((i) => String(i.id) === String(active.id)) || null)
  }

  async function handleDragEnd({ active, over }) {
    setActiveIssue(null)
    if (!over) return

    const issue = issues.find((i) => String(i.id) === String(active.id))
    if (!issue) return

    const targetStatus = String(over.id)
    const validKeys = projectStatuses.map((s) => s.key)
    if (!validKeys.includes(targetStatus) || issue.status === targetStatus) return

    // Optimistisches Update
    upsertIssue({ ...issue, status: targetStatus })

    try {
      const { data } = await issuesApi.patchStatus(issue.id, targetStatus)
      upsertIssue(data)
    } catch {
      // Rollback
      upsertIssue(issue)
    }
  }

  return (
    <>
      {/* Status-Manager Button */}
      <div className="flex justify-end px-4 pt-2">
        <button
          onClick={() => setShowStatusManager(true)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors"
          title="Spalten verwalten"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          Spalten verwalten
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 px-4 pt-3 items-start">
          {projectStatuses.map((statusObj) => {
            const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
            const columnIssues = issues.filter((i) => {
              if (i.status !== statusObj.key) return false
              if (statusObj.is_closed && i.closed_at) {
                return Date.now() - new Date(i.closed_at).getTime() < TWO_DAYS_MS
              }
              return true
            })
            return (
              <KanbanColumn
                key={statusObj.key}
                statusObj={statusObj}
                issues={columnIssues}
                projectId={projectId}
              />
            )
          })}
        </div>

        <DragOverlay>
          {activeIssue && (
            <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-lg cursor-grabbing opacity-90">
              <p className="text-sm text-gray-900 font-medium leading-snug">{activeIssue.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {showStatusManager && (
        <StatusManager
          projectId={projectId}
          onClose={() => setShowStatusManager(false)}
        />
      )}
    </>
  )
}
