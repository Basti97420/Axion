import { useRef, useEffect } from 'react'
import { Draggable } from '@fullcalendar/interaction'
import { useIssueStore } from '../../store/issueStore'
import IssueCard from './IssueCard'
import IssueFilters from './IssueFilters'
import Button from '../common/Button'

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }
const CLOSED_STATUSES = ['done', 'cancelled']

export default function IssueList({ projectId, filters, onFiltersChange, onNewIssue, selectedIssueId, draggable, nativeDraggable, navKey = 0 }) {
  const issues = useIssueStore((s) => s.issues)
  const listRef = useRef(null)

  // Zeige erledigte Issues nur wenn explizit nach done/cancelled gefiltert wird
  const showingClosed = CLOSED_STATUSES.includes(filters.status)

  const filtered = issues.filter((i) => {
    if (filters.status) {
      if (i.status !== filters.status) return false
    } else {
      // Kein Status-Filter aktiv → erledigte ausblenden
      if (CLOSED_STATUSES.includes(i.status)) return false
    }
    if (filters.priority && i.priority !== filters.priority) return false
    if (filters.type && i.type !== filters.type) return false
    return true
  })

  // Anzahl versteckter erledigter Issues (nur wenn kein Status-Filter aktiv)
  const hiddenCount = !filters.status
    ? issues.filter((i) => CLOSED_STATUSES.includes(i.status) &&
        (!filters.priority || i.priority === filters.priority) &&
        (!filters.type || i.type === filters.type)).length
    : 0

  const sorted = [...filtered].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99
    const pb = PRIORITY_ORDER[b.priority] ?? 99
    if (pa !== pb) return pa - pb
    return new Date(a.created_at) - new Date(b.created_at)
  })

  useEffect(() => {
    if (!draggable || !listRef.current) return
    const drag = new Draggable(listRef.current, {
      itemSelector: '[data-fc-event]',
      eventData: (el) => JSON.parse(el.getAttribute('data-fc-event')),
    })
    return () => drag.destroy()
  }, [draggable, sorted.length, navKey])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            Issues <span className="text-gray-400 font-normal">({filtered.length})</span>
          </span>
          <Button size="sm" onClick={onNewIssue}>+ Neu</Button>
        </div>
        <IssueFilters filters={filters} onChange={onFiltersChange} />
      </div>

      {draggable && (
        <p className="text-xs text-gray-400 px-3 py-1.5 bg-gray-50 border-b border-gray-100 shrink-0">
          ↕ Issue in den Kalender ziehen
        </p>
      )}

      {/* Liste */}
      <div ref={listRef} className="flex-1 overflow-y-auto divide-y divide-gray-100 scrollbar-thin">
        {sorted.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            {showingClosed ? 'Keine erledigten Issues' : 'Keine offenen Issues'}
          </div>
        ) : (
          sorted.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              projectId={projectId}
              selected={issue.id === selectedIssueId}
              draggable={draggable}
              nativeDraggable={nativeDraggable}
            />
          ))
        )}

        {/* Hinweis auf ausgeblendete Issues */}
        {hiddenCount > 0 && (
          <button
            onClick={() => onFiltersChange({ ...filters, status: 'done' })}
            className="w-full text-xs text-gray-400 hover:text-gray-600 py-2.5 text-center hover:bg-gray-50 transition-colors"
          >
            + {hiddenCount} erledigte{hiddenCount === 1 ? 's' : ''} Issue{hiddenCount === 1 ? '' : 's'} ausgeblendet — anzeigen
          </button>
        )}
      </div>
    </div>
  )
}
