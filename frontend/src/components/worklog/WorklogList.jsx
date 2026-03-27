import { formatDate } from '../../utils/dateUtils'
import { worklogApi } from '../../api/worklogApi'

function minToDisplay(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default function WorklogList({ worklogs, onDelete }) {
  const totalMin = worklogs.reduce((sum, w) => sum + w.duration_min, 0)

  if (worklogs.length === 0) {
    return <p className="text-sm text-gray-400 py-2">Noch keine Zeitbuchungen.</p>
  }

  return (
    <div className="space-y-1">
      {worklogs.map((w) => (
        <div key={w.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0 group">
          <div className="shrink-0 text-right w-12">
            <span className="text-sm font-semibold text-gray-800">{minToDisplay(w.duration_min)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{formatDate(w.date)}</span>
              <span className="text-xs text-gray-400">{w.user_name}</span>
            </div>
            {w.description && (
              <p className="text-xs text-gray-600 mt-0.5 truncate">{w.description}</p>
            )}
          </div>
          <button
            onClick={() => onDelete(w.id)}
            className="text-xs text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <span className="text-xs text-gray-500">
          Gesamt: <span className="font-semibold text-gray-700">{minToDisplay(totalMin)}</span>
        </span>
      </div>
    </div>
  )
}
