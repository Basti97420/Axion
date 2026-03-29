import { useRef, useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import deLocale from '@fullcalendar/core/locales/de'

function isoWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

// Status-Farben für Issue-Events
function issueColor(status, dueDateStr) {
  if (status === 'done' || status === 'cancelled') return '#22c55e'
  const due = dueDateStr ? new Date(dueDateStr) : null
  const today = new Date(); today.setHours(0,0,0,0)
  if (due && due < today) return '#ef4444'
  return '#f97316'
}

// Kleines Popover für Entry-Events und iCloud-Events
function EntryPopover({ event, onDelete, onClose, onIssueOpen }) {
  if (!event) return null
  const rect = event._rect
  return (
    <div
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-44"
      style={{ top: rect?.top ?? 100, left: rect?.left ?? 100 }}
    >
      <p className="text-sm font-semibold text-gray-800 mb-1 truncate max-w-48">{event.title}</p>
      <p className="text-xs text-gray-500 mb-3">
        {new Date(event.start).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })} –{' '}
        {event.end ? new Date(event.end).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}
      </p>
      <div className="flex flex-col gap-1.5">
        {event.issueId && (
          <button
            onClick={() => { onIssueOpen(event.issueId); onClose() }}
            className="text-xs text-white bg-primary-600 hover:bg-primary-700 rounded px-2 py-1.5 text-left"
          >
            → Issue #{event.issueId} öffnen
          </button>
        )}
        {event.entryId && (
          <button
            onClick={() => { onDelete(event.entryId); onClose() }}
            className="text-xs text-white bg-red-500 hover:bg-red-600 rounded px-2 py-1.5"
          >
            Löschen
          </button>
        )}
        <button
          onClick={onClose}
          className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded px-2 py-1.5"
        >
          Schließen
        </button>
      </div>
    </div>
  )
}

export default function CalendarView({
  issues,
  icloudEvents,
  worklogSummary,
  calendarEntries,
  onIssueDrop,
  onEntryCreate,
  onEntryUpdate,
  onEntryDelete,
  onEntryIssueOpen,
  onIcloudEventUpdate,
  onDateSelect,
  onDatesSet,
  navigateTo,
}) {
  const calendarRef = useRef(null)
  const [popover, setPopover] = useState(null) // { title, start, end, entryId, issueId, _rect }

  useEffect(() => {
    if (navigateTo && calendarRef.current) {
      calendarRef.current.getApi().gotoDate(navigateTo)
    }
  }, [navigateTo])

  // Issues mit due_date → Ganztags-Events (bleibt unverändert)
  const issueEvents = issues
    .filter((i) => i.due_date)
    .map((i) => ({
      id: `issue-${i.id}`,
      title: i.title,
      start: i.due_date,
      allDay: true,
      backgroundColor: issueColor(i.status, i.due_date),
      borderColor: issueColor(i.status, i.due_date),
      textColor: '#fff',
      editable: true,
      durationEditable: false,
      extendedProps: { type: 'issue', issue: i },
    }))

  // calendar_entries → timed Events mit Resize
  const entryEvents = (calendarEntries || []).map((e) => {
    const isImported = !e.issue_id
    return {
      id: `entry-${e.id}`,
      title: e.title || e.issue_title || 'Kalender-Eintrag',
      start: e.start_dt,
      end: e.end_dt,
      backgroundColor: isImported ? '#6b7280' : issueColor(e.issue_status, e.start_dt),
      borderColor: isImported ? '#4b5563' : 'rgba(255,255,255,0.4)',
      textColor: '#fff',
      editable: true,
      durationEditable: true,
      extendedProps: { type: 'entry', entryId: e.id, entry: e },
    }
  })

  // iCloud-Events – Axion-eigene Events (description "Axion Issue #..." oder legacy "PlanWiki Issue #...") ausblenden,
  // da diese bereits als CalendarEntry angezeigt werden (zuverlässiger als UID-Vergleich)
  const localIcloudUids = new Set((calendarEntries || []).map((e) => e.icloud_uid).filter(Boolean))
  const cloudEvents = (icloudEvents || [])
    .filter((e) => {
      if (e.description?.startsWith('Axion Issue #') || e.description?.startsWith('PlanWiki Issue #')) return false
      if (localIcloudUids.has(e.uid)) return false
      return true
    })
    .map((e) => ({
      id: `icloud-${e.uid}`,
      title: e.title,
      start: e.start,
      end: e.end,
      backgroundColor: '#6366f1',
      borderColor: '#4f46e5',
      textColor: '#fff',
      editable: true,
      durationEditable: true,
      extendedProps: { type: 'icloud', event: e },
    }))

  // Worklog-Auslastung als Hintergrund-Events
  const workloadEvents = (worklogSummary || []).map((w) => {
    let color = '#dcfce7'
    if (w.total_h > 8) color = '#fee2e2'
    else if (w.total_h > 5) color = '#fef9c3'
    return {
      id: `workload-${w.date}`,
      start: w.date,
      allDay: true,
      display: 'background',
      backgroundColor: color,
      editable: false,
      extendedProps: { type: 'workload', hours: w.total_h },
    }
  })

  function handleEventClick({ event, jsEvent }) {
    const { type } = event.extendedProps
    const rect = jsEvent.target.getBoundingClientRect()
    if (type === 'entry') {
      setPopover({
        title: event.title,
        start: event.start,
        end: event.end,
        entryId: event.extendedProps.entryId,
        issueId: event.extendedProps.entry?.issue_id || null,
        _rect: { top: rect.bottom + 4, left: rect.left },
      })
    } else if (type === 'icloud') {
      const e = event.extendedProps.event
      setPopover({
        title: event.title,
        start: event.start,
        end: event.end,
        entryId: null,
        issueId: null,
        icloudUid: e.uid,
        _rect: { top: rect.bottom + 4, left: rect.left },
      })
    }
  }

  function handleEventDrop({ event, revert }) {
    const { type, issue, entryId } = event.extendedProps
    if (type === 'issue' && onIssueDrop) {
      onIssueDrop(issue, event.startStr)
    } else if (type === 'entry' && onEntryUpdate) {
      onEntryUpdate(entryId, { start: event.startStr, end: event.endStr })
    } else if (type === 'icloud' && onIcloudEventUpdate) {
      const e = event.extendedProps.event
      onIcloudEventUpdate(e.uid, e.title, e.description, { start: event.startStr, end: event.endStr })
    } else {
      revert()
    }
  }

  function handleEventResize({ event, revert }) {
    const { type, entryId } = event.extendedProps
    if (type === 'entry' && onEntryUpdate) {
      onEntryUpdate(entryId, { start: event.startStr, end: event.endStr })
    } else if (type === 'icloud' && onIcloudEventUpdate) {
      const e = event.extendedProps.event
      onIcloudEventUpdate(e.uid, e.title, e.description, { start: event.startStr, end: event.endStr })
    } else {
      revert()
    }
  }

  function handleEventReceive({ event }) {
    // Externes Drop: Issue aus Sidebar
    const { type, issueId, issue } = event.extendedProps
    if (type === 'external-issue' && onEntryCreate) {
      const start = event.startStr
      // endStr nutzen (Lokalzeit wie startStr) – verhindert UTC-Offset-Bug nach Sommerzeit
      const end = event.endStr || start

      onEntryCreate({ issueId, issue, start, end })
    }
    // FullCalendar-Event wieder entfernen – State-Update zeichnet es neu
    event.remove()
  }

  function handleDateSelect(info) {
    if (onDateSelect) onDateSelect(info.startStr)
  }

  return (
    <div className="h-full calendar-wrapper" onClick={() => popover && setPopover(null)}>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale={deLocale}
        height="100%"
        snapDuration="00:15:00"
        slotDuration="00:30:00"
        scrollTime="08:00:00"
        customButtons={{
          kwTitle: { text: ' ', click: () => {} },
        }}
        headerToolbar={{
          left: 'prev,next today',
          center: 'kwTitle',
          right: 'dayGridMonth,timeGridWeek',
        }}
        nowIndicator={true}
        events={[...issueEvents, ...entryEvents, ...cloudEvents, ...workloadEvents]}
        editable={true}
        selectable={true}
        droppable={true}
        eventDurationEditable={true}
        eventResizableFromStart={false}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventReceive={handleEventReceive}
        select={handleDateSelect}
        datesSet={(info) => {
          onDatesSet && onDatesSet(info.start)
          requestAnimationFrame(() => {
            const btn = calendarRef.current?.getApi()?.el?.querySelector('.fc-kwTitle-button')
            if (!btn) return
            btn.textContent = info.view.type === 'timeGridWeek'
              ? `KW ${isoWeek(info.start)}`
              : info.view.title
            btn.style.cssText = 'background:none;border:none;box-shadow:none;font-size:1.1rem;font-weight:700;color:inherit;cursor:default;pointer-events:none;padding:0 8px;'
          })
        }}
        eventContent={(info) => {
          const { type } = info.event.extendedProps
          if (type === 'workload') return null
          const isEntry = type === 'entry'
          return (
            <div className={`px-1 py-0.5 text-xs truncate font-medium ${isEntry ? 'cursor-pointer' : ''}`}>
              {info.event.title}
            </div>
          )
        }}
        dayCellContent={(info) => {
          const w = (worklogSummary || []).find((w) => w.date === info.dateStr)
          return (
            <div className="fc-daygrid-day-number flex items-center justify-between w-full px-1">
              <span>{info.dayNumberText}</span>
              {w && (
                <span className={`text-xs font-medium ${
                  w.total_h > 8 ? 'text-red-600' :
                  w.total_h > 5 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  ⏱ {w.total_h}h
                </span>
              )}
            </div>
          )
        }}
      />

      {popover && (
        <EntryPopover
          event={popover}
          onDelete={onEntryDelete}
          onClose={() => setPopover(null)}
          onIssueOpen={onEntryIssueOpen}
        />
      )}
    </div>
  )
}
