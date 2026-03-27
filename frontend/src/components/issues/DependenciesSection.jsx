import { useEffect, useState } from 'react'
import { issuesApi } from '../../api/issuesApi'
import { useIssueStore } from '../../store/issueStore'
import { STATUS_COLORS, STATUS_LABELS } from '../../utils/statusColors'
import Badge from '../common/Badge'

function IssueChip({ issue, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs">
      <span className="text-gray-400 font-mono">#{issue.id}</span>
      <span className="font-medium text-gray-800 max-w-32 truncate">{issue.title}</span>
      <Badge className={STATUS_COLORS[issue.status]}>{STATUS_LABELS[issue.status]}</Badge>
      {onRemove && (
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 ml-0.5 leading-none">✕</button>
      )}
    </span>
  )
}

export default function DependenciesSection({ issueId, projectId }) {
  const allIssues = useIssueStore((s) => s.issues)
  const [deps, setDeps] = useState({ blocks: [], blocked_by: [] })
  const [search, setSearch] = useState('')
  const [addType, setAddType] = useState(null) // 'blocks' | 'blocked_by'

  useEffect(() => {
    issuesApi.getDependencies(issueId)
      .then(({ data }) => setDeps(data))
      .catch(() => {})
  }, [issueId])

  async function handleAdd(targetId, type) {
    await issuesApi.addDependency(issueId, { target_id: targetId, type }).catch(() => {})
    const { data } = await issuesApi.getDependencies(issueId)
    setDeps(data)
    setSearch('')
    setAddType(null)
  }

  async function handleRemove(targetId, type) {
    await issuesApi.removeDependency(issueId, targetId, type).catch(() => {})
    setDeps((prev) => ({
      ...prev,
      [type === 'blocks' ? 'blocks' : 'blocked_by']:
        prev[type === 'blocks' ? 'blocks' : 'blocked_by'].filter((i) => i.id !== targetId),
    }))
  }

  const existingIds = new Set([
    issueId,
    ...deps.blocks.map((i) => i.id),
    ...deps.blocked_by.map((i) => i.id),
  ])

  const filtered = search.length >= 1
    ? allIssues.filter(
        (i) => !existingIds.has(i.id) &&
          (i.title.toLowerCase().includes(search.toLowerCase()) || String(i.id).includes(search))
      ).slice(0, 6)
    : []

  if (deps.blocks.length === 0 && deps.blocked_by.length === 0 && !addType) {
    return (
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Abhängigkeiten</h2>
          <div className="flex gap-1">
            <button onClick={() => setAddType('blocks')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Blockiert</button>
            <span className="text-gray-300">|</span>
            <button onClick={() => setAddType('blocked_by')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Blockiert durch</button>
          </div>
        </div>
        <p className="text-xs text-gray-400">Keine Abhängigkeiten</p>
      </div>
    )
  }

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700">Abhängigkeiten</h2>
        <div className="flex gap-1">
          <button onClick={() => setAddType('blocks')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Blockiert</button>
          <span className="text-gray-300">|</span>
          <button onClick={() => setAddType('blocked_by')} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Blockiert durch</button>
        </div>
      </div>

      {deps.blocks.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1.5 font-medium">Blockiert:</p>
          <div className="flex flex-wrap gap-1.5">
            {deps.blocks.map((i) => (
              <IssueChip key={i.id} issue={i} onRemove={() => handleRemove(i.id, 'blocks')} />
            ))}
          </div>
        </div>
      )}

      {deps.blocked_by.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1.5 font-medium">
            🔒 Blockiert durch:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {deps.blocked_by.map((i) => (
              <IssueChip key={i.id} issue={i} onRemove={() => handleRemove(i.id, 'blocked_by')} />
            ))}
          </div>
        </div>
      )}

      {addType && (
        <div className="relative mt-2">
          <p className="text-xs text-gray-500 mb-1">
            {addType === 'blocks' ? 'Welches Issue blockiert dieses hier?' : 'Durch welches Issue wird dieses blockiert?'}
          </p>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Issue-Titel oder #ID suchen…"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {filtered.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {filtered.map((i) => (
                <li
                  key={i.id}
                  onClick={() => handleAdd(i.id, addType)}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 text-sm"
                >
                  <span className="text-xs text-gray-400 font-mono">#{i.id}</span>
                  <span className="truncate flex-1">{i.title}</span>
                  <Badge className={STATUS_COLORS[i.status]}>{STATUS_LABELS[i.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => { setAddType(null); setSearch('') }} className="mt-1.5 text-xs text-gray-400 hover:text-gray-600">Abbrechen</button>
        </div>
      )}
    </div>
  )
}
