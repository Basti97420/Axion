import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { kiAgentsApi } from '../api/kiAgentsApi'
import { formatDateTime } from '../utils/dateUtils'
import Button from '../components/common/Button'

const TEMPLATES = [
  {
    label: '📊 Wochenbericht',
    prompt: 'Erstelle einen Wochenbericht für dieses Projekt. Fasse alle offenen und diese Woche geschlossenen Issues zusammen. Beschreibe den aktuellen Fortschritt und mögliche Risiken. Schreibe das Ergebnis als gut strukturiertes Markdown.',
  },
  {
    label: '🔍 Website-Monitor',
    prompt: 'Vergleiche den aktuellen Website-Inhalt mit dem letzten Workspace-Inhalt. Wenn es relevante Änderungen gibt, erstelle ein neues Issue mit dem Titel \"Website-Änderung erkannt\" und beschreibe die Änderungen in der Beschreibung. Falls keine Änderungen vorliegen, schreibe nur einen kurzen Statusbericht.',
  },
  {
    label: '🐛 Bug-Tracker',
    prompt: 'Prüfe alle offenen Bug-Issues im Projekt. Für jeden Bug, der seit mehr als 7 Tagen keinen Kommentar erhalten hat, füge einen Kommentar hinzu: \"Automatische Erinnerung: Dieses Issue wartet seit über 7 Tagen auf Bearbeitung.\" Erstelle zum Abschluss eine Zusammenfassung aller gefundenen inaktiven Bugs.',
  },
]

const FIELD_CLASSES = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full'
const LABEL_CLASSES = 'block text-xs font-medium text-gray-600 mb-1'

function AgentForm({ agent, onSave, onDelete, onRun, running }) {
  const [form, setForm] = useState({
    name: agent?.name || '',
    prompt: agent?.prompt || '',
    api_provider: agent?.api_provider || 'global',
    api_url: agent?.api_url || '',
    api_model: agent?.api_model || '',
    api_key: '',
    schedule_type: agent?.schedule_type || 'manual',
    interval_min: agent?.interval_min || 60,
    schedule_days: agent?.schedule_days ?? null,
    website_url: agent?.website_url || '',
    is_active: agent?.is_active ?? true,
    dry_run: agent?.dry_run ?? false,
    notify_telegram: agent?.notify_telegram ?? false,
    retry_on_error: agent?.retry_on_error ?? false,
    retry_max: agent?.retry_max ?? 3,
    retry_delay_min: agent?.retry_delay_min ?? 5,
  })

  const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function toggleDay(i) {
    const current = form.schedule_days ?? [0, 1, 2, 3, 4, 5, 6]
    const next = current.includes(i) ? current.filter((d) => d !== i) : [...current, i].sort((a, b) => a - b)
    set('schedule_days', next.length === 7 ? null : next.length === 0 ? [i] : next)
  }

  function applyTemplate(tpl) {
    setForm((f) => ({ ...f, prompt: tpl.prompt }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Vorlagen */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Vorlagen:</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-gray-600"
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={LABEL_CLASSES}>Name</label>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          required
          placeholder="Mein Agent"
          className={FIELD_CLASSES}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={LABEL_CLASSES + ' mb-0'}>Aufgabe (Prompt)</label>
          <a href="/wiki/ki-agenten-aktionen" target="_blank" rel="noreferrer"
             className="text-xs text-primary-600 hover:underline">
            📖 Aktionen & Konfiguration
          </a>
        </div>
        <textarea
          value={form.prompt}
          onChange={(e) => set('prompt', e.target.value)}
          rows={5}
          placeholder="Beschreibe was der Agent tun soll…"
          className={FIELD_CLASSES}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASSES}>KI-Provider</label>
          <select value={form.api_provider} onChange={(e) => set('api_provider', e.target.value)} className={FIELD_CLASSES}>
            <option value="global">Global (Standard)</option>
            <option value="ollama">Ollama</option>
            <option value="claude">Claude API</option>
          </select>
        </div>
        <div>
          <label className={LABEL_CLASSES}>Modell (leer = Standard)</label>
          <input
            value={form.api_model}
            onChange={(e) => set('api_model', e.target.value)}
            placeholder="z.B. llama3:8b"
            className={FIELD_CLASSES}
          />
        </div>
      </div>

      {form.api_provider === 'ollama' && (
        <div>
          <label className={LABEL_CLASSES}>Ollama Host-URL (leer = global)</label>
          <input
            value={form.api_url}
            onChange={(e) => set('api_url', e.target.value)}
            placeholder="http://192.168.1.100:11434"
            className={FIELD_CLASSES}
          />
        </div>
      )}

      {form.api_provider === 'claude' && (
        <div>
          <label className={LABEL_CLASSES}>API-Key (leer = Standard)</label>
          <input
            type="password"
            value={form.api_key}
            onChange={(e) => set('api_key', e.target.value)}
            placeholder={agent?.api_key ? '••••••••' : 'Optional'}
            className={FIELD_CLASSES}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASSES}>Häufigkeit</label>
          <select value={form.schedule_type} onChange={(e) => set('schedule_type', e.target.value)} className={FIELD_CLASSES}>
            <option value="manual">Manuell</option>
            <option value="interval">Intervall</option>
          </select>
        </div>
        {form.schedule_type === 'interval' && (
          <div>
            <label className={LABEL_CLASSES}>Intervall (Minuten)</label>
            <input
              type="number"
              min="1"
              value={form.interval_min}
              onChange={(e) => set('interval_min', parseInt(e.target.value) || 60)}
              className={FIELD_CLASSES}
            />
          </div>
        )}
      </div>

      {form.schedule_type === 'interval' && (
        <div>
          <label className={LABEL_CLASSES}>Wochentage</label>
          <div className="flex gap-1 flex-wrap">
            {DAY_LABELS.map((d, i) => {
              const active = (form.schedule_days ?? [0, 1, 2, 3, 4, 5, 6]).includes(i)
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {d}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-1">Alle aktiv = jeden Tag</p>
        </div>
      )}

      <div>
        <label className={LABEL_CLASSES}>Website URL (optional)</label>
        <input
          value={form.website_url}
          onChange={(e) => set('website_url', e.target.value)}
          placeholder="https://example.com"
          className={FIELD_CLASSES}
        />
      </div>

      {/* Optionen */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.dry_run} onChange={(e) => set('dry_run', e.target.checked)} className="rounded" />
          <span className="text-sm text-gray-700">Nur simulieren (Dry-Run) — Aktionen werden nicht ausgeführt</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.notify_telegram} onChange={(e) => set('notify_telegram', e.target.checked)} className="rounded" />
          <span className="text-sm text-gray-700">Telegram-Benachrichtigung nach jedem Run</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="rounded" />
          <span className="text-sm text-gray-700">Agent aktiv</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.retry_on_error} onChange={(e) => set('retry_on_error', e.target.checked)} className="rounded" />
          <span className="text-sm text-gray-700">Retry bei Fehler</span>
        </label>
        {form.retry_on_error && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <div>
              <label className={LABEL_CLASSES}>Max. Versuche</label>
              <input
                type="number"
                min="1"
                max="10"
                value={form.retry_max}
                onChange={(e) => set('retry_max', parseInt(e.target.value) || 3)}
                className={FIELD_CLASSES}
              />
            </div>
            <div>
              <label className={LABEL_CLASSES}>Wartezeit (Minuten)</label>
              <input
                type="number"
                min="1"
                value={form.retry_delay_min}
                onChange={(e) => set('retry_delay_min', parseInt(e.target.value) || 5)}
                className={FIELD_CLASSES}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit">Speichern</Button>
        {agent && (
          <Button type="button" variant="secondary" onClick={onRun} loading={running}>
            ▶ Jetzt ausführen
          </Button>
        )}
        {agent && (
          <Button type="button" variant="danger" onClick={onDelete}>
            Löschen
          </Button>
        )}
      </div>
    </form>
  )
}

function FileList({ agentId, refreshKey }) {
  const [files, setFiles] = useState([])
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    if (!agentId) return
    kiAgentsApi.getFiles(agentId).then(({ data }) => setFiles(data)).catch(() => {})
  }, [agentId, refreshKey])

  async function toggleExpand(filename) {
    if (expanded[filename] !== undefined) {
      setExpanded((e) => { const n = { ...e }; delete n[filename]; return n })
    } else {
      try {
        const r = await fetch(kiAgentsApi.fileUrl(agentId, filename), { credentials: 'include' })
        const text = await r.text()
        setExpanded((e) => ({ ...e, [filename]: text.slice(0, 3000) }))
      } catch {
        setExpanded((e) => ({ ...e, [filename]: '[Lesefehler]' }))
      }
    }
  }

  async function handleDelete(filename) {
    if (!confirm(`Datei "${filename}" löschen?`)) return
    await kiAgentsApi.deleteFile(agentId, filename)
    setFiles((f) => f.filter((x) => x.filename !== filename))
    setExpanded((e) => { const n = { ...e }; delete n[filename]; return n })
  }

  if (!files.length) return <p className="text-xs text-gray-400">Noch keine Dateien.</p>

  return (
    <ul className="space-y-2">
      {files.map((f) => {
        const isOpen = expanded[f.filename] !== undefined
        const ext = f.filename.split('.').pop().toLowerCase()
        return (
          <li key={f.filename} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
              <button
                onClick={() => toggleExpand(f.filename)}
                className="flex items-center gap-2 text-left flex-1 min-w-0"
              >
                <span className="text-xs shrink-0">{isOpen ? '▼' : '▶'}</span>
                <span className="text-xs font-mono text-gray-700 truncate">{f.filename}</span>
                <span className="text-xs text-gray-400 shrink-0">({Math.round(f.size / 1024 * 10) / 10} KB)</span>
              </button>
              <div className="flex gap-2 shrink-0 ml-2">
                <a
                  href={kiAgentsApi.fileUrl(agentId, f.filename)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary-600 hover:underline"
                >
                  Öffnen
                </a>
                <button
                  onClick={() => handleDelete(f.filename)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Löschen
                </button>
              </div>
            </div>
            {isOpen && (
              <div className="px-3 py-2 border-t border-gray-100 max-h-64 overflow-y-auto">
                {ext === 'md' ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{expanded[f.filename]}</ReactMarkdown>
                  </div>
                ) : (
                  <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap">{expanded[f.filename]}</pre>
                )}
                {expanded[f.filename]?.length >= 3000 && (
                  <p className="text-xs text-gray-400 mt-1">… (Vorschau auf 3000 Zeichen begrenzt)</p>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function RunList({ runs }) {
  if (!runs.length) return <p className="text-xs text-gray-400">Noch keine Runs.</p>

  return (
    <ul className="space-y-2">
      {runs.map((run) => (
        <li key={run.id} className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">{formatDateTime(run.started_at)}</span>
              {run.triggered_by === 'chain' && <span title="Durch Agenten-Kette gestartet">🔗</span>}
              {run.triggered_by === 'scheduler' && <span title="Durch Scheduler gestartet">⏱</span>}
              {run.triggered_by === 'retry' && <span title="Retry-Versuch">🔄</span>}
            </div>
            <span className={`text-xs font-medium ${run.error ? 'text-red-600' : 'text-green-600'}`}>
              {run.error ? `✗ Fehler` : `✓ OK`}
            </span>
          </div>
          {run.error && <p className="text-xs text-red-500 mb-1">{run.error}</p>}
          {(run.tokens_in > 0 || run.tokens_out > 0) && (
            <p className="text-xs text-gray-400 mb-1">
              🔢 {(run.tokens_in + run.tokens_out).toLocaleString()} Tokens
              <span className="text-gray-300 ml-1">
                (↑{run.tokens_in.toLocaleString()} ↓{run.tokens_out.toLocaleString()})
              </span>
            </p>
          )}
          {run.output && (
            <div className="prose prose-sm max-w-none text-xs mt-1">
              <ReactMarkdown>{run.output.slice(0, 400)}</ReactMarkdown>
              {run.output.length > 400 && <span className="text-gray-400">…</span>}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

function StatsPanel({ runs, agent }) {
  const total = runs.length
  const successful = runs.filter((r) => !r.error).length
  const failed = runs.filter((r) => r.error).length
  const totalIn = runs.reduce((s, r) => s + (r.tokens_in || 0), 0)
  const totalOut = runs.reduce((s, r) => s + (r.tokens_out || 0), 0)
  const totalTokens = totalIn + totalOut
  const avgIn = total ? Math.round(totalIn / total) : 0
  const avgOut = total ? Math.round(totalOut / total) : 0

  // Letzte 10 Runs für Token-Verlauf (älteste zuerst)
  const recent = [...runs].reverse().slice(-10)
  const maxTokens = Math.max(...recent.map((r) => (r.tokens_in || 0) + (r.tokens_out || 0)), 1)

  return (
    <div className="space-y-6">
      {/* Übersichtskarten */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Runs gesamt', value: total, color: 'text-gray-800' },
          { label: 'Erfolgreich', value: successful, color: 'text-green-600' },
          { label: 'Fehler', value: failed, color: failed > 0 ? 'text-red-600' : 'text-gray-400' },
          { label: 'Tokens gesamt', value: totalTokens.toLocaleString(), color: 'text-indigo-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Token-Details */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Token-Verteilung</h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>↑ Input (Prompt)</span>
              <span className="font-medium">{totalIn.toLocaleString()} · Ø {avgIn.toLocaleString()}/Run</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full"
                style={{ width: totalTokens ? `${(totalIn / totalTokens) * 100}%` : '0%' }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>↓ Output (Antwort)</span>
              <span className="font-medium">{totalOut.toLocaleString()} · Ø {avgOut.toLocaleString()}/Run</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full"
                style={{ width: totalTokens ? `${(totalOut / totalTokens) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Token-Verlauf */}
      {recent.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Token-Verlauf (letzte {recent.length} Runs)
          </h4>
          <div className="flex items-end gap-1 h-20">
            {recent.map((run, i) => {
              const t = (run.tokens_in || 0) + (run.tokens_out || 0)
              const heightPct = maxTokens ? (t / maxTokens) * 100 : 0
              const inPct = t ? ((run.tokens_in || 0) / t) * 100 : 50
              return (
                <div
                  key={run.id}
                  className="flex-1 flex flex-col justify-end group relative"
                  title={`Run #${run.id}\n↑ ${(run.tokens_in||0).toLocaleString()} ↓ ${(run.tokens_out||0).toLocaleString()}`}
                >
                  {t > 0 && (
                    <div className="w-full rounded-sm overflow-hidden" style={{ height: `${heightPct}%` }}>
                      <div className="bg-blue-400 w-full" style={{ height: `${inPct}%` }} />
                      <div className="bg-emerald-400 w-full" style={{ height: `${100 - inPct}%` }} />
                    </div>
                  )}
                  {t === 0 && (
                    <div className="w-full h-1 rounded-sm bg-gray-300" />
                  )}
                  {run.error && (
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-500" />
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-400" /> Input
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Output
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" /> Fehler
            </span>
          </div>
        </div>
      )}

      {/* Erfolgsrate */}
      {total > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Erfolgsrate</h4>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full"
                style={{ width: `${(successful / total) * 100}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-gray-700 shrink-0">
              {Math.round((successful / total) * 100)} %
            </span>
          </div>
        </div>
      )}

      {total === 0 && (
        <p className="text-xs text-gray-400 text-center py-8">Noch keine Runs vorhanden.</p>
      )}
    </div>
  )
}

const TABS = [
  { id: 'config', label: '⚙️ Konfiguration' },
  { id: 'files', label: '📁 Dateien' },
  { id: 'log', label: '🕐 Protokoll' },
  { id: 'stats', label: '📊 Statistiken' },
]

export default function KiAgentsPage() {
  const { projectId } = useParams()
  const [agents, setAgents] = useState([])
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [runs, setRuns] = useState([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [filesKey, setFilesKey] = useState(0)
  const [activeTab, setActiveTab] = useState('config')

  useEffect(() => {
    kiAgentsApi.getAll(projectId).then(({ data }) => setAgents(data)).catch(() => {})
  }, [projectId])

  useEffect(() => {
    if (selected) {
      kiAgentsApi.getRuns(selected.id).then(({ data }) => setRuns(data)).catch(() => {})
    } else {
      setRuns([])
    }
  }, [selected])

  async function handleSave(formData) {
    setError(null)
    try {
      if (creating) {
        const { data } = await kiAgentsApi.create(projectId, formData)
        setAgents((a) => [...a, data])
        setSelected(data)
        setCreating(false)
      } else {
        const { data } = await kiAgentsApi.update(selected.id, formData)
        setAgents((a) => a.map((ag) => ag.id === data.id ? data : ag))
        setSelected(data)
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Fehler beim Speichern')
    }
  }

  async function handleDelete() {
    if (!confirm(`Agent "${selected.name}" wirklich löschen?`)) return
    await kiAgentsApi.remove(selected.id)
    setAgents((a) => a.filter((ag) => ag.id !== selected.id))
    setSelected(null)
    setCreating(false)
  }

  async function handleRun() {
    setRunning(true)
    setError(null)
    try {
      await kiAgentsApi.run(selected.id)
      setTimeout(() => {
        kiAgentsApi.getRuns(selected.id).then(({ data }) => setRuns(data)).catch(() => {})
        kiAgentsApi.get(selected.id).then(({ data }) => {
          setSelected(data)
          setAgents((a) => a.map((ag) => ag.id === data.id ? data : ag))
        }).catch(() => {})
        setFilesKey((k) => k + 1)
        setRunning(false)
      }, 2000)
    } catch (e) {
      setError('Fehler beim Ausführen')
      setRunning(false)
    }
  }

  function selectAgent(agent) {
    setSelected(agent)
    setCreating(false)
    setError(null)
    setActiveTab('config')
  }

  function startCreate() {
    setSelected(null)
    setCreating(true)
    setError(null)
    setActiveTab('config')
  }

  const activeAgent = creating ? null : selected

  return (
    <div className="flex h-full overflow-hidden">
      {/* Linke Spalte: Agenten-Liste */}
      <div className="w-64 shrink-0 border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <Button size="sm" onClick={startCreate} className="w-full">+ Neuer Agent</Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {agents.length === 0 && (
            <p className="text-xs text-gray-400 p-4 text-center">Noch keine Agenten.</p>
          )}
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => selectAgent(agent)}
              className={`w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selected?.id === agent.id && !creating ? 'bg-primary-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${agent.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                <span className="text-xs text-gray-400 font-mono shrink-0">#{agent.id}</span>
                <span className="text-sm font-medium text-gray-800 truncate">{agent.name}</span>
                {agent.dry_run && <span className="text-xs text-orange-500 shrink-0">sim</span>}
                {agent.retry_on_error && <span className="text-xs text-blue-400 shrink-0">🔄</span>}
              </div>
              <div className="text-xs text-gray-400 mt-0.5 pl-4">
                {agent.last_run_at ? `Letzter Run: ${formatDateTime(agent.last_run_at)}` : 'Noch nicht ausgeführt'}
              </div>
              <div className="text-xs text-gray-400 pl-4">
                {agent.schedule_type === 'interval' ? (
                  <>
                    ⏱ alle {agent.interval_min} Min
                    {agent.schedule_days && agent.schedule_days.length < 7 && (
                      <> · {['Mo','Di','Mi','Do','Fr','Sa','So'].filter((_, i) => agent.schedule_days.includes(i)).join(' ')}</>
                    )}
                  </>
                ) : 'Manuell'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Rechte Spalte: Detail */}
      <div className="flex-1 overflow-y-auto">
        {!creating && !selected && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Agent auswählen oder neuen anlegen
          </div>
        )}

        {(creating || selected) && (
          <>
            {/* Header */}
            <div className="px-6 pt-6 pb-0">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                {creating ? 'Neuer KI-Agent' : selected.name}
              </h2>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            {/* Tab-Leiste (nur bei bestehendem Agent) */}
            {selected && (
              <div className="px-6 border-b border-gray-200">
                <div className="flex gap-0">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'border-primary-600 text-primary-700'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tab-Inhalt */}
            <div className="p-6">
              {/* Konfiguration */}
              {(activeTab === 'config' || creating) && (
                <>
                  <AgentForm
                    key={creating ? 'new' : (selected?.id ?? 'none')}
                    agent={activeAgent}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    onRun={handleRun}
                    running={running}
                  />
                  {selected && selected.workspace && (
                    <div className="mt-6 border-t border-gray-200 pt-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        📋 Workspace (letzter Output)
                        {selected.dry_run && <span className="ml-2 text-xs text-orange-500 font-normal">[Simulation]</span>}
                      </h3>
                      <div className="prose prose-sm max-w-none bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <ReactMarkdown>{selected.workspace}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Dateien */}
              {activeTab === 'files' && selected && (
                <>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">📁 Workspace-Dateien</h3>
                  <FileList agentId={selected.id} refreshKey={filesKey} />
                </>
              )}

              {/* Protokoll */}
              {activeTab === 'log' && selected && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">🕐 Protokoll</h3>
                    <button
                      onClick={() => kiAgentsApi.getRuns(selected.id).then(({ data }) => setRuns(data))}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      Aktualisieren
                    </button>
                  </div>
                  <RunList runs={runs} />
                </>
              )}

              {/* Statistiken */}
              {activeTab === 'stats' && selected && (
                <>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">📊 Statistiken</h3>
                  <StatsPanel runs={runs} agent={selected} />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
