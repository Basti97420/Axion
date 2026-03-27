import { useNavigate } from 'react-router-dom'
import Badge from '../common/Badge'
import { STATUS_COLORS, STATUS_LABELS } from '../../utils/statusColors'
import { PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_ICONS } from '../../utils/priorityUtils'
import { formatDate, dueDateColor } from '../../utils/dateUtils'

export default function IssueCard({ issue, projectId, selected, draggable, nativeDraggable }) {
  const navigate = useNavigate()

  const fcEventData = draggable
    ? JSON.stringify({
        title: issue.title,
        duration: '01:00',
        extendedProps: { type: 'external-issue', issueId: issue.id, issue },
      })
    : undefined

  function handleDragStart(e) {
    e.dataTransfer.setData('issueId', String(issue.id))
    e.dataTransfer.setData('issueTitle', issue.title)
    e.dataTransfer.effectAllowed = 'move'
  }

  const isAnyDraggable = draggable || nativeDraggable

  return (
    <div
      className={`px-3 py-2.5 border-l-2 transition-colors ${
        selected
          ? 'bg-white border-l-primary-400 shadow-sm'
          : 'border-l-transparent hover:bg-gray-50 hover:border-l-gray-200'
      } ${isAnyDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      onClick={isAnyDraggable ? undefined : () => navigate(`/projects/${projectId}/issues/${issue.id}`)}
      data-fc-event={fcEventData}
      draggable={nativeDraggable ? true : undefined}
      onDragStart={nativeDraggable ? handleDragStart : undefined}
    >
      <div className="flex items-start gap-2">
        <span className="text-xs text-gray-400 font-mono shrink-0 mt-0.5">#{issue.id}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-900 font-medium leading-snug line-clamp-2">{issue.title}</p>
          <div className="flex flex-wrap gap-1 mt-1.5 items-center">
            <Badge className={STATUS_COLORS[issue.status]}>{STATUS_LABELS[issue.status]}</Badge>
            <Badge className={PRIORITY_COLORS[issue.priority]}>
              {PRIORITY_ICONS[issue.priority]} {PRIORITY_LABELS[issue.priority]}
            </Badge>
            {issue.due_date && (
              <span className={`text-xs ${dueDateColor(issue.due_date, issue.status)}`}>
                {formatDate(issue.due_date)}
              </span>
            )}
          </div>
          {issue.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
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
      </div>
    </div>
  )
}
