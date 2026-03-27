import { useDraggable } from '@dnd-kit/core'
import { useNavigate } from 'react-router-dom'
import Badge from '../common/Badge'
import { PRIORITY_COLORS, PRIORITY_ICONS } from '../../utils/priorityUtils'
import { formatDate, dueDateColor } from '../../utils/dateUtils'

export default function KanbanCard({ issue, projectId }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.id,
    data: { issue },
  })

  const style = { opacity: isDragging ? 0.4 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
      onClick={(e) => {
        if (!isDragging) navigate(`/projects/${projectId}/issues/${issue.id}`)
      }}
    >
      <p className="text-sm text-gray-900 font-medium leading-snug mb-2">{issue.title}</p>
      <div className="flex flex-wrap gap-1 items-center">
        <Badge className={PRIORITY_COLORS[issue.priority]}>
          {PRIORITY_ICONS[issue.priority]}
        </Badge>
        {issue.due_date && (
          <span className={`text-xs ${dueDateColor(issue.due_date, issue.status)}`}>
            {formatDate(issue.due_date)}
          </span>
        )}
        {issue.assignee_name && (
          <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
            {issue.assignee_name}
          </span>
        )}
      </div>
      {issue.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {issue.tags.map((tag) => (
            <span
              key={tag.id}
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: tag.color + '33', color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
