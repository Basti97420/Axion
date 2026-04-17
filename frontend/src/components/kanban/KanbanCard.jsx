import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { useNavigate } from 'react-router-dom'
import Badge from '../common/Badge'
import ContextMenu from '../common/ContextMenu'
import { PRIORITY_COLORS, PRIORITY_ICONS } from '../../utils/priorityUtils'
import { STATUS_LABELS } from '../../utils/statusColors'
import { formatDate, dueDateColor } from '../../utils/dateUtils'
import { issuesApi } from '../../api/issuesApi'
import { milestonesApi } from '../../api/milestonesApi'
import { useAuthStore } from '../../store/authStore'
import { useIssueStore } from '../../store/issueStore'

const PRIORITY_ORDER = ['low', 'medium', 'high', 'critical']
const PRIORITY_LABELS_DE = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch', critical: 'Kritisch' }
const PRIORITY_ICONS_MAP = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }

export default function KanbanCard({ issue, projectId }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { upsertIssue, removeIssue } = useIssueStore()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.id,
    data: { issue },
  })
  const [menu, setMenu] = useState(null)
  const [milestones, setMilestones] = useState([])

  const style = { opacity: isDragging ? 0.4 : 1 }

  async function handleContextMenu(e) {
    e.preventDefault()
    // Meilensteine lazy laden
    let ms = milestones
    if (ms.length === 0 && projectId) {
      try {
        const { data } = await milestonesApi.getAll(projectId)
        ms = data
        setMilestones(data)
      } catch { ms = [] }
    }

    const statusSub = Object.entries(STATUS_LABELS).map(([val, label]) => ({
      label,
      active: issue.status === val,
      onClick: async () => {
        try {
          const { data } = await issuesApi.patchStatus(issue.id, val)
          upsertIssue(data)
        } catch {}
      },
    }))

    const prioritySub = PRIORITY_ORDER.map((val) => ({
      label: PRIORITY_LABELS_DE[val],
      icon: PRIORITY_ICONS_MAP[val],
      active: issue.priority === val,
      onClick: async () => {
        try {
          const { data } = await issuesApi.patchPriority(issue.id, val)
          upsertIssue(data)
        } catch {}
      },
    }))

    const milestoneSub = ms.length > 0
      ? ms.map((m) => ({
          label: m.name,
          active: issue.milestone_id === m.id,
          onClick: async () => {
            try {
              const { data } = await issuesApi.update(issue.id, { milestone_id: m.id })
              upsertIssue(data)
            } catch {}
          },
        }))
      : [{ label: 'Keine Meilensteine', disabled: true, onClick: () => {} }]

    setMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { icon: '📋', label: 'Status', submenu: statusSub },
        { icon: '⚡', label: 'Priorität', submenu: prioritySub },
        { divider: true },
        {
          icon: '👤', label: 'Mir zuweisen',
          onClick: async () => {
            try {
              const { data } = await issuesApi.update(issue.id, { assignee_id: user?.id })
              upsertIssue(data)
            } catch {}
          },
        },
        { icon: '🏁', label: 'Meilenstein', submenu: milestoneSub },
        { divider: true },
        {
          icon: '🔗', label: 'Link kopieren',
          onClick: () => navigator.clipboard.writeText(
            `${window.location.origin}/projects/${projectId}/issues/${issue.id}`
          ),
        },
        {
          icon: '↗', label: 'In neuem Tab öffnen',
          onClick: () => window.open(`/projects/${projectId}/issues/${issue.id}`, '_blank'),
        },
        { divider: true },
        {
          icon: '📑', label: 'Duplizieren',
          onClick: async () => {
            try {
              await issuesApi.create({
                title: `${issue.title} (Kopie)`,
                description: issue.description,
                type: issue.type,
                priority: issue.priority,
                project_id: issue.project_id,
                status: 'open',
              })
            } catch {}
          },
        },
        {
          icon: '🗑', label: 'Löschen', danger: true,
          onClick: async () => {
            if (!confirm(`Issue „${issue.title}" wirklich löschen?`)) return
            try {
              await issuesApi.remove(issue.id)
              removeIssue(issue.id)
            } catch {}
          },
        },
      ],
    })
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
        onClick={(e) => { if (!isDragging) navigate(`/projects/${projectId}/issues/${issue.id}`) }}
        onContextMenu={handleContextMenu}
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
      {menu && (
        <ContextMenu
          x={menu.x} y={menu.y}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
}
