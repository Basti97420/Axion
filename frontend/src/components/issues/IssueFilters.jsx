import { STATUSES, STATUS_LABELS } from '../../utils/statusColors'
import { PRIORITIES, PRIORITY_LABELS } from '../../utils/priorityUtils'

const TYPES = ['task', 'bug', 'story', 'epic', 'subtask']
const TYPE_LABELS = { task: 'Aufgabe', bug: 'Bug', story: 'Story', epic: 'Epic', subtask: 'Unteraufgabe' }

export default function IssueFilters({ filters, onChange, tags = [] }) {
  function set(key, value) {
    onChange({ ...filters, [key]: value })
  }

  const selectClass = 'text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500'

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <select value={filters.status || ''} onChange={(e) => set('status', e.target.value)} className={selectClass}>
        <option value="">Alle Status</option>
        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>

      <select value={filters.priority || ''} onChange={(e) => set('priority', e.target.value)} className={selectClass}>
        <option value="">Alle Prioritäten</option>
        {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
      </select>

      <select value={filters.type || ''} onChange={(e) => set('type', e.target.value)} className={selectClass}>
        <option value="">Alle Typen</option>
        {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
      </select>

      {(filters.status || filters.priority || filters.type) && (
        <button
          onClick={() => onChange({})}
          className="text-xs text-gray-400 hover:text-gray-700 underline"
        >
          Zurücksetzen
        </button>
      )}
    </div>
  )
}
