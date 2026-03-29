import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns'
import { projectsApi } from '../api/projectsApi'
import { calendarApi } from '../api/calendarApi'
import { worklogApi } from '../api/worklogApi'
import { issuesApi } from '../api/issuesApi'
import { calendarEntriesApi } from '../api/calendarEntriesApi'
import { useIssueStore } from '../store/issueStore'
import { useCalendarStore } from '../store/calendarStore'
import CalendarView from '../components/calendar/CalendarView'
import IssueList from '../components/issues/IssueList'
import MiniCalendar from '../components/calendar/MiniCalendar'
import IssueForm from '../components/issues/IssueForm'
import Modal from '../components/common/Modal'

const ICLOUD_STATUS = {
  ok:    { dot: 'bg-green-500', pill: 'bg-green-50 text-green-700 border-green-200', label: 'iCloud ✓' },
  error: { dot: 'bg-red-500',   pill: 'bg-red-50 text-red-700 border-red-200',       label: 'iCloud ✗' },
  off:   { dot: 'bg-gray-400',  pill: 'bg-gray-50 text-gray-500 border-gray-200',    label: 'iCloud –' },
}

function IcloudStatusBadge({ status, errorMsg }) {
  const cfg = ICLOUD_STATUS[status] ?? ICLOUD_STATUS.off
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.pill}`}
      title={errorMsg || undefined}
    >
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

export default function CalendarPage() {
  const { projectId } = useParams()
  const id = parseInt(projectId)
  const navigate = useNavigate()

  const { issues, setIssues, upsertIssue } = useIssueStore()
  const { icloudEvents, icloudConfigured, setIcloudEvents, setIcloudConfigured } = useCalendarStore()

  const [calendarEntries, setCalendarEntries] = useState([])
  const [worklogSummary, setWorklogSummary] = useState([])
  const [filters, setFilters] = useState({})
  const [showNewIssue, setShowNewIssue] = useState(false)
  const [saving, setSaving] = useState(false)
  const [icloudError, setIcloudError] = useState('')
  const [calError, setCalError] = useState(null)
  const [syncInfo, setSyncInfo] = useState(null)
  const [navKey, setNavKey] = useState(0)
  const [currentCalDate, setCurrentCalDate] = useState(new Date())
  const [navigateTo, setNavigateTo] = useState(null)

  useEffect(() => {
    if (!calError) return
    const t = setTimeout(() => setCalError(null), 5000)
    return () => clearTimeout(t)
  }, [calError])

  useEffect(() => {
    if (!syncInfo) return
    const t = setTimeout(() => setSyncInfo(null), 5000)
    return () => clearTimeout(t)
  }, [syncInfo])

  const dateStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const dateEnd   = format(endOfMonth(addMonths(new Date(), 2)), 'yyyy-MM-dd')

  useEffect(() => {
    projectsApi.getIssues(id).then(({ data }) => setIssues(data)).catch(() => {})

    const wStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const wEnd   = format(endOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd')
    worklogApi.summary({ start: wStart, end: wEnd })
      .then(({ data }) => setWorklogSummary(data))
      .catch(() => {})

    loadCalendar()
  }, [id])

  async function loadCalendar() {
    // 1. Lokale Entries laden
    let entries = []
    try {
      const { data } = await calendarEntriesApi.getAll(id, dateStart, dateEnd)
      entries = data
      setCalendarEntries(entries)
    } catch { /* ignore */ }

    // 2. iCloud-Status prüfen
    let configured = false
    try {
      const { data: status } = await calendarApi.getStatus()
      configured = status.configured
      setIcloudConfigured(configured)
    } catch {
      setIcloudConfigured(false)
    }

    if (!configured) return

    // 3. iCloud-Events laden
    let icloudEvts = []
    try {
      const { data } = await calendarApi.getEvents(dateStart, dateEnd)
      icloudEvts = data
      setIcloudEvents(icloudEvts)
    } catch (err) {
      setIcloudError(err.response?.data?.error || 'iCloud-Verbindung fehlgeschlagen')
      return
    }

    // 4. Sync-Check: auf iCloud gelöschte Entries lokal entfernen
    const icloudUids = new Set(icloudEvts.map((e) => e.uid))
    const deletedRemotely = entries.filter((e) => e.icloud_uid && !icloudUids.has(e.icloud_uid))
    if (deletedRemotely.length > 0) {
      await Promise.all(deletedRemotely.map((e) => calendarEntriesApi.remove(e.id).catch(() => {})))
      setCalendarEntries((prev) => prev.filter((e) => !deletedRemotely.find((d) => d.id === e.id)))
      setSyncInfo(`${deletedRemotely.length} Eintrag/Einträge auf iCloud gelöscht – lokal entfernt.`)
    }

    // 5. Neue iCloud-Events importieren (vom iPhone erstellt etc.)
    try {
      const { data: imported } = await calendarApi.syncFromIcloud(dateStart, dateEnd)
      if (imported.length > 0) {
        setCalendarEntries((prev) => {
          const existingIds = new Set(prev.map((e) => e.id))
          return [...prev, ...imported.filter((e) => !existingIds.has(e.id))]
        })
        // Issues neu laden damit importierte Issues in der Sidebar erscheinen
        projectsApi.getIssues(id).then(({ data }) => setIssues(data)).catch(() => {})
        setSyncInfo(`${imported.length} neuer Termin/Termine aus iCloud importiert.`)
      }
    } catch { /* iCloud-Fehler ignorieren */ }
  }

  // Bestehend: due_date via Drag auf Ganztags-Event aktualisieren
  async function handleIssueDrop(issue, newDate) {
    upsertIssue({ ...issue, due_date: newDate })
    try {
      const { data } = await issuesApi.patchDueDate(issue.id, newDate)
      upsertIssue(data)
    } catch {
      upsertIssue(issue)
    }
  }

  // Neu: Issue aus Sidebar in Kalender gezogen → CalendarEntry anlegen
  async function handleEntryCreate({ issueId, start, end }) {
    try {
      const { data } = await calendarEntriesApi.create({
        issue_id: issueId,
        project_id: id,
        start_dt: start,
        end_dt: end,
      })
      setCalendarEntries((prev) => [...prev, data])
    } catch (err) {
      console.error('Entry-Erstellung fehlgeschlagen', err)
    }
  }

  // Entry verschieben oder Dauer ändern
  async function handleEntryUpdate(entryId, { start, end }) {
    // Optimistisch
    const oldEntries = [...calendarEntries]
    setCalendarEntries((prev) =>
      prev.map((e) => e.id === entryId ? { ...e, start_dt: start, end_dt: end } : e)
    )
    try {
      await calendarEntriesApi.update(entryId, { start_dt: start, end_dt: end })
    } catch {
      setCalError('Eintrag konnte nicht gespeichert werden. Änderung wurde rückgängig gemacht.')
      setCalendarEntries(oldEntries)
    }
  }

  // Entry löschen
  async function handleEntryDelete(entryId) {
    const oldEntries = [...calendarEntries]
    setCalendarEntries((prev) => prev.filter((e) => e.id !== entryId))
    try {
      await calendarEntriesApi.remove(entryId)
    } catch {
      setCalError('Eintrag konnte nicht gelöscht werden.')
      setCalendarEntries(oldEntries)
    }
  }

  // Reines iCloud-Event verschieben/resizen: altes löschen + neues mit gleicher uid anlegen
  async function handleIcloudEventUpdate(uid, title, description, { start, end }) {
    const oldEvents = [...icloudEvents]
    setIcloudEvents((prev) => prev.map((e) => e.uid === uid ? { ...e, start, end } : e))
    try {
      await calendarApi.deleteEvent(uid)
      await calendarApi.createEvent({ uid, title, start, end, description })
    } catch {
      setIcloudEvents(oldEvents)
      setCalError('iCloud-Eintrag konnte nicht aktualisiert werden.')
    }
  }

  function handleEntryIssueOpen(issueId) {
    navigate(`/projects/${id}/issues/${issueId}`)
  }

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
      {/* Linke Spalte – Mini-Kalender + Issue-Liste (draggable aktiviert) */}
      <div className="w-80 shrink-0 border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Mini-Kalender */}
        <div className="shrink-0 border-b border-gray-200 p-2">
          <MiniCalendar
            currentDate={currentCalDate}
            onWeekSelect={(date) => setNavigateTo(date)}
          />
          {!icloudConfigured && (
            <p className="text-xs text-amber-600 mt-1 px-1">
              ⚠ iCloud nicht konfiguriert – nur Issue-Termine sichtbar
            </p>
          )}
          {icloudError && (
            <p className="text-xs text-red-600 mt-1 px-1">⚠ {icloudError}</p>
          )}
        </div>
        <IssueList
          projectId={id}
          filters={filters}
          onFiltersChange={setFilters}
          onNewIssue={() => setShowNewIssue(true)}
          draggable={true}
          navKey={navKey}
        />
      </div>

      {/* Rechte Seite – Kalender */}
      <div className="flex-1 overflow-hidden p-4 flex flex-col">
        <div className="flex justify-end mb-2 shrink-0 gap-2">
          {syncInfo && (
            <div className="flex-1 flex items-center justify-between text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              <span>ℹ {syncInfo}</span>
              <button onClick={() => setSyncInfo(null)} className="ml-3 text-blue-400 hover:text-blue-600">✕</button>
            </div>
          )}
          {calError && (
            <div className="flex-1 flex items-center justify-between text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <span>⚠ {calError}</span>
              <button onClick={() => setCalError(null)} className="ml-3 text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          <button
            onClick={() => { setIcloudError(''); loadCalendar() }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 transition-colors"
            title="Kalender neu laden"
          >
            ↻ Aktualisieren
          </button>
          <IcloudStatusBadge
            status={icloudError ? 'error' : icloudConfigured ? 'ok' : 'off'}
            errorMsg={icloudError}
          />
        </div>
        <div className="flex-1 overflow-hidden">
        <CalendarView
          issues={issues}
          icloudEvents={icloudEvents}
          worklogSummary={worklogSummary}
          calendarEntries={calendarEntries}
          onIssueDrop={handleIssueDrop}
          onEntryCreate={handleEntryCreate}
          onEntryUpdate={handleEntryUpdate}
          onEntryDelete={handleEntryDelete}
          onEntryIssueOpen={handleEntryIssueOpen}
          onIcloudEventUpdate={handleIcloudEventUpdate}
          navigateTo={navigateTo}
          onDatesSet={(start) => {
            setNavKey((k) => k + 1)
            setCurrentCalDate(start)
          }}
        />
        </div>
      </div>

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
