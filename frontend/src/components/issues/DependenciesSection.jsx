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

export default function DependenciesSection({ issueId }) {
  const allIssues = useIssueStore((s) => s.issues)
  const [blocks, setBlocks] = useState([])
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    issuesApi.getDependencies(issueId)
      .then(({ data }) => setBlocks(data.blocks))
      .catch(() => {})
  }, [issueId])

  async function handleAdd(targetId) {
    await issuesApi.addDependency(issueId, { target_id: targetId, type: 'blocks' }).catch(() => {})
    const { data } = await issuesApi.getDependencies(issueId)
    setBlocks(data.blocks)
    setSearch('')
    setAdding(false)
  }

  async function handleRemove(targetId) {
    await issuesApi.removeDependency(issueId, targetId, 'blocks').catch(() => {})
    setBlocks((prev) => prev.filter((i) => i.id !== targetId))
  }

  const existingIds = new Set([issueId, ...blocks.map((i) => i.id)])

  const filtered = search.length >= 1
    ? allIssues.filter(
        (i) => !existingIds.has(i.id) &&
          (i.title.toLowerCase().includes(search.toLowerCase()) || String(i.id).includes(search))
      ).slice(0, 6)
    : []

  if (blocks.length === 0 && !adding) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Abhängigkeiten</h2>
          <button onClick={() => setAdding(true)} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Blockiert</button>
        </div>
        <p className="text-xs text-gray-400">Keine Abhängigkeiten</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Abhängigkeiten</h2>
        <button onClick={() => setAdding(true)} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Blockiert</button>
      </div>

      {blocks.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1.5 font-medium">Blockiert:</p>
          <div className="flex flex-wrap gap-1.5">
            {blocks.map((i) => (
              <IssueChip key={i.id} issue={i} onRemove={() => handleRemove(i.id)} />
            ))}
          </div>
        </div>
      )}

      {adding && (
        <div className="relative mt-2">
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
                  onClick={() => handleAdd(i.id)}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 text-sm"
                >
                  <span className="text-xs text-gray-400 font-mono">#{i.id}</span>
                  <span className="truncate flex-1">{i.title}</span>
                  <Badge className={STATUS_COLORS[i.status]}>{STATUS_LABELS[i.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => { setAdding(false); setSearch('') }} className="mt-1.5 text-xs text-gray-400 hover:text-gray-600">Abbrechen</button>
        </div>
      )}
    </div>
  )
}
