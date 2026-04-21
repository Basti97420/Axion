import { useDroppable } from '@dnd-kit/core'
import KanbanCard from './KanbanCard'

export default function KanbanColumn({ statusObj, issues, projectId }) {
  const { setNodeRef, isOver } = useDroppable({ id: statusObj.key })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl min-w-[260px] w-72 shrink-0 transition-colors ${
        isOver ? 'bg-primary-50' : 'bg-gray-100'
      }`}
    >
      {/* Spalten-Header */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${statusObj.dot_color}`} />
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {statusObj.label}
        </span>
        <span className="ml-auto text-xs text-gray-400 bg-white rounded-full px-1.5 py-0.5">
          {issues.length}
        </span>
      </div>

      {/* Karten */}
      <div className="px-2 pb-2 space-y-2 min-h-[60px] overflow-y-auto max-h-[calc(100vh-12rem)] kanban-col-scroll">
        {issues.map((issue) => (
          <KanbanCard key={issue.id} issue={issue} projectId={projectId} />
        ))}
      </div>
    </div>
  )
}
