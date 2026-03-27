import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin } from '@dnd-kit/core'
import { useState } from 'react'
import KanbanColumn from './KanbanColumn'
import { STATUSES } from '../../utils/statusColors'
import { issuesApi } from '../../api/issuesApi'
import { useIssueStore } from '../../store/issueStore'

export default function KanbanBoard({ projectId }) {
  const issues = useIssueStore((s) => s.issues)
  const upsertIssue = useIssueStore((s) => s.upsertIssue)
  const [activeIssue, setActiveIssue] = useState(null)

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
    if (!STATUSES.includes(targetStatus) || issue.status === targetStatus) return

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
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 px-4 pt-3 items-start">
        {STATUSES.map((status) => {
          const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
          const columnIssues = issues.filter((i) => {
            if (i.status !== status) return false
            if (['done', 'cancelled'].includes(i.status) && i.closed_at) {
              return Date.now() - new Date(i.closed_at).getTime() < TWO_DAYS_MS
            }
            return true
          })
          return (
            <KanbanColumn
              key={status}
              status={status}
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
  )
}
