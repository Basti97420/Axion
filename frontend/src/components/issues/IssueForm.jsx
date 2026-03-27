import { useState, useEffect } from 'react'
import Button from '../common/Button'
import { STATUSES, STATUS_LABELS } from '../../utils/statusColors'
import { PRIORITIES, PRIORITY_LABELS } from '../../utils/priorityUtils'
import { tagsApi } from '../../api/tagsApi'
import { milestonesApi } from '../../api/milestonesApi'
import { useIssueStore } from '../../store/issueStore'

const TYPES = ['task', 'bug', 'story', 'epic', 'subtask']
const TYPE_LABELS = { task: 'Aufgabe', bug: 'Bug', story: 'Story', epic: 'Epic', subtask: 'Unteraufgabe' }

const TEMPLATES = [
  {
    name: 'Bug',
    type: 'bug',
    priority: 'high',
    title: '[Bug] ',
    description: '**Beschreibung:**\n\n**Schritte zum Reproduzieren:**\n1. \n\n**Erwartetes Verhalten:**\n\n**Tatsächliches Verhalten:**',
  },
  {
    name: 'Feature',
    type: 'story',
    priority: 'medium',
    title: '',
    description: '**Als** ...\n**möchte ich** ...\n**damit** ...',
  },
  {
    name: 'Task',
    type: 'task',
    priority: 'medium',
    title: '',
    description: '',
  },
]

export default function IssueForm({ initial = {}, projectId, onSubmit, onCancel, loading }) {
  const [title, setTitle] = useState(initial.title || '')
  const [description, setDescription] = useState(initial.description || '')
  const [type, setType] = useState(initial.type || 'task')
  const [status, setStatus] = useState(initial.status || 'open')
  const [priority, setPriority] = useState(initial.priority || 'low')
  const [dueDate, setDueDate] = useState(initial.due_date || '')
  const [estimatedHours, setEstimatedHours] = useState(initial.estimated_hours || '')
  const [availableTags, setAvailableTags] = useState([])
  const [selectedTagIds, setSelectedTagIds] = useState(initial.tags?.map((t) => t.id) || [])
  const [milestones, setMilestones] = useState([])
  const [milestoneId, setMilestoneId] = useState(initial.milestone_id || '')
  const [parentId, setParentId] = useState(initial.parent_id ? String(initial.parent_id) : '')

  const allIssues = useIssueStore((s) => s.issues)
  const stories = allIssues.filter((i) => i.type === 'story' && i.status !== 'done' && i.status !== 'cancelled')
  const isEdit = !!initial.id

  useEffect(() => {
    tagsApi.getAll({ project_id: projectId })
      .then(({ data }) => setAvailableTags(data))
      .catch(() => {})
    milestonesApi.getAll(projectId)
      .then(({ data }) => setMilestones(data))
      .catch(() => {})
  }, [projectId])

  function toggleTag(id) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    )
  }

  function handleTypeChange(newType) {
    setType(newType)
    if (newType !== 'subtask') setParentId('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      title,
      description,
      type,
      status,
      priority,
      due_date: dueDate || null,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
      tag_ids: selectedTagIds,
      milestone_id: milestoneId ? parseInt(milestoneId) : null,
      parent_id: type === 'subtask' && parentId ? parseInt(parentId) : null,
    })
  }

  const fieldClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  function applyTemplate(tpl) {
    setType(tpl.type)
    setPriority(tpl.priority)
    setTitle(tpl.title)
    setDescription(tpl.description)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEdit && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Vorlage:</span>
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.name}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="px-2.5 py-1 text-xs rounded-full border border-gray-300 text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
            >
              {tpl.name}
            </button>
          ))}
        </div>
      )}
      <div>
        <label className={labelClass}>Titel *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} required placeholder="Kurze Beschreibung" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Typ</label>
          <select value={type} onChange={(e) => handleTypeChange(e.target.value)} className={fieldClass}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldClass}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Priorität</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={fieldClass}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Fällig am</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Schätzung (Stunden)</label>
          <input type="number" step="0.5" min="0" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className={fieldClass} placeholder="z.B. 2.5" />
        </div>
        {type === 'subtask' && (
          <div className="col-span-2">
            <label className={labelClass}>
              Story <span className="text-red-500">*</span>
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={fieldClass}
              required
            >
              <option value="">Story auswählen…</option>
              {stories.map((s) => (
                <option key={s.id} value={s.id}>#{s.id} {s.title}</option>
              ))}
            </select>
          </div>
        )}
        {milestones.length > 0 && (
          <div>
            <label className={labelClass}>Meilenstein</label>
            <select value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)} className={fieldClass}>
              <option value="">Kein Meilenstein</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className={labelClass}>Beschreibung</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className={`${fieldClass} resize-none font-mono text-xs`}
          placeholder="Markdown wird unterstützt"
        />
      </div>

      {availableTags.length > 0 && (
        <div>
          <label className={labelClass}>Tags</label>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                  selectedTagIds.includes(tag.id)
                    ? 'border-transparent text-white'
                    : 'border-gray-300 text-gray-600 bg-white hover:border-gray-400'
                }`}
                style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : {}}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" loading={loading}>{isEdit ? 'Speichern' : 'Erstellen'}</Button>
      </div>
    </form>
  )
}
