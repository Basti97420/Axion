import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { worklogsApi } from '../../api/worklogsApi'

function getMondayOfCurrentWeek() {
  const now = new Date()
  const day = (now.getDay() + 6) % 7 // 0=Mo, 6=So
  const monday = new Date(now)
  monday.setDate(now.getDate() - day)
  monday.setHours(0, 0, 0, 0)
  return monday
}

export default function WorklogDashboard({ projectId }) {
  const navigate = useNavigate()
  const [worklogs, setWorklogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [weeks, setWeeks] = useState(4)

  useEffect(() => {
    setLoading(true)
    worklogsApi.getProjectWorklogs(projectId, weeks)
      .then(({ data }) => setWorklogs(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId, weeks])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Lädt…
      </div>
    )
  }

  if (worklogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
        <span className="text-3xl">⏱</span>
        <p className="text-sm font-medium text-gray-600">Keine Zeiteinträge im gewählten Zeitraum</p>
        <p className="text-xs text-gray-400">Buche Stunden direkt in einem Issue unter dem Tab „Worklog".</p>
        <select
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className="mt-2 text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600"
        >
          <option value={1}>Letzte Woche</option>
          <option value={4}>Letzte 4 Wochen</option>
          <option value={12}>Letzte 3 Monate</option>
          <option value={52}>Letztes Jahr</option>
        </select>
      </div>
    )
  }

  // Aggregationen
  const totalMin = worklogs.reduce((s, w) => s + w.duration_min, 0)
  const totalHours = (totalMin / 60).toFixed(1)

  const monday = getMondayOfCurrentWeek()
  const thisWeekMin = worklogs
    .filter((w) => new Date(w.date) >= monday)
    .reduce((s, w) => s + w.duration_min, 0)
  const thisWeekHours = (thisWeekMin / 60).toFixed(1)

  const byUser = {}
  worklogs.forEach((w) => {
    const name = w.user_name || 'Unbekannt'
    byUser[name] = (byUser[name] || 0) + w.duration_min
  })
  const maxUserMin = Math.max(...Object.values(byUser), 1)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">⏱ Zeiterfassung</h2>
        <select
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value={1}>Letzte Woche</option>
          <option value={4}>Letzte 4 Wochen</option>
          <option value={12}>Letzte 3 Monate</option>
          <option value={52}>Letztes Jahr</option>
        </select>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Stunden gesamt', value: `${totalHours} h`, color: 'text-primary-600' },
          { label: 'Diese Woche', value: `${thisWeekHours} h`, color: 'text-green-600' },
          { label: 'Einträge', value: worklogs.length, color: 'text-gray-800' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm"
          >
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Balkendiagramm pro Person */}
      {Object.keys(byUser).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Stunden pro Person
          </h3>
          <div className="space-y-2">
            {Object.entries(byUser)
              .sort(([, a], [, b]) => b - a)
              .map(([name, min]) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-28 truncate shrink-0">{name}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-400 rounded-full transition-all duration-300"
                      style={{ width: `${(min / maxUserMin) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 shrink-0 w-16 text-right font-mono">
                    {(min / 60).toFixed(1)} h
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tabelle */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Datum', 'Issue', 'Person', 'Std', 'Beschreibung'].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i === 3 ? 'text-right' : 'text-left'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {worklogs.map((w) => (
              <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">{w.date}</td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => navigate(`/projects/${projectId}/issues/${w.issue_id}`)}
                    className="text-primary-600 hover:underline text-left"
                  >
                    <span className="text-gray-400 font-mono text-xs mr-1">#{w.issue_id}</span>
                    <span className="truncate">{w.issue_title}</span>
                  </button>
                </td>
                <td className="px-4 py-2.5 text-gray-600">{w.user_name || '—'}</td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-700">{w.duration_h}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[180px] truncate">
                  {w.description || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
