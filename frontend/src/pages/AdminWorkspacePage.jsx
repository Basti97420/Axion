import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminDbApi } from '../api/adminDbApi'
import { useAuthStore } from '../store/authStore'

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function isBoolType(typeStr) {
  return typeStr.toUpperCase().includes('BOOL')
}
function isLongText(typeStr, colName) {
  return typeStr.toUpperCase().includes('TEXT') ||
    ['description', 'content', 'output', 'prompt', 'code', 'actions',
     'cells', 'error', 'workspace'].some(k => colName.includes(k))
}
function formatCellValue(val) {
  if (val === null || val === undefined) return <span className="text-gray-300 italic text-xs">null</span>
  if (typeof val === 'boolean') return <span className={val ? 'text-green-600' : 'text-gray-400'}>{val ? 'true' : 'false'}</span>
  const s = String(val)
  if (s.length > 80) return <span title={s} className="truncate block max-w-xs">{s.slice(0, 80)}…</span>
  return s
}
function extBadge(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const colors = { md: 'bg-purple-100 text-purple-700', txt: 'bg-blue-100 text-blue-700', csv: 'bg-green-100 text-green-700' }
  return (
    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${colors[ext] || 'bg-gray-100 text-gray-500'}`}>
      .{ext}
    </span>
  )
}

// ─── DB-Browser ─────────────────────────────────────────────────────────────

function DbBrowser() {
  const [tables, setTables] = useState([])
  const [selectedTable, setSelectedTable] = useState(null)
  const [rows, setRows] = useState([])
  const [columns, setColumns] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [editRow, setEditRow] = useState(null)   // row object being edited
  const [editFields, setEditFields] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    adminDbApi.getTables().then(({ data }) => {
      setTables(data)
      if (data.length) selectTable(data[0].table)
    }).catch(() => {})
  }, [])

  const selectTable = useCallback((table) => {
    setSelectedTable(table)
    setPage(1)
    setQ('')
    setEditRow(null)
  }, [])

  useEffect(() => {
    if (!selectedTable) return
    setLoading(true)
    adminDbApi.getRows(selectedTable, page, q).then(({ data }) => {
      setRows(data.rows)
      setColumns(data.columns)
      setTotal(data.total)
      setPages(data.pages)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [selectedTable, page, q])

  function openEdit(row) {
    setEditRow(row)
    setEditFields({ ...row })
    setSaveError('')
  }

  async function handleSave() {
    if (!editRow) return
    setSaving(true)
    setSaveError('')
    const editable = {}
    columns.filter(c => !c.readonly && !c.primary_key).forEach(c => {
      if (editFields[c.name] !== editRow[c.name]) {
        editable[c.name] = editFields[c.name]
      }
    })
    if (!Object.keys(editable).length) { setEditRow(null); setSaving(false); return }
    try {
      await adminDbApi.updateRow(selectedTable, editRow.id, editable)
      setRows(prev => prev.map(r => r.id === editRow.id ? { ...r, ...editable } : r))
      setEditRow(null)
    } catch (e) {
      setSaveError(e?.response?.data?.error || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const tableInfo = tables.find(t => t.table === selectedTable)

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Sidebar Tabellenliste */}
      <div className="w-52 shrink-0 bg-white border border-gray-200 rounded-xl overflow-y-auto">
        <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Tabellen
        </div>
        {tables.map(t => (
          <button
            key={t.table}
            onClick={() => selectTable(t.table)}
            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
              selectedTable === t.table
                ? 'bg-primary-50 text-primary-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="truncate font-mono text-xs">{t.table}</span>
            <span className="text-xs text-gray-400 shrink-0">{t.row_count}</span>
          </button>
        ))}
      </div>

      {/* Hauptbereich */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {selectedTable && (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-3">
              <h3 className="font-mono text-sm font-semibold text-gray-800">{selectedTable}</h3>
              <span className="text-xs text-gray-400">{total} Zeilen</span>
              <div className="flex-1" />
              <input
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="Suchen…"
                value={q}
                onChange={e => { setQ(e.target.value); setPage(1) }}
              />
            </div>

            {/* Tabelle */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Lädt…</div>
              ) : rows.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Keine Einträge</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {columns.map(c => (
                        <th key={c.name} className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">
                          {c.name}
                          {c.readonly && <span className="ml-1 text-gray-300">🔒</span>}
                        </th>
                      ))}
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => openEdit(row)}
                      >
                        {columns.map(c => (
                          <td key={c.name} className="px-3 py-1.5 text-gray-700 max-w-xs">
                            {formatCellValue(row[c.name])}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right">
                          <button className="text-primary-500 hover:text-primary-700 text-xs font-medium">
                            Bearbeiten
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center gap-2 justify-center">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Zurück
                </button>
                <span className="text-sm text-gray-600">Seite {page} / {pages}</span>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Weiter →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit-Panel (slide-in rechts) */}
      {editRow && (
        <div className="w-80 shrink-0 bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden shadow-lg">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-800">Zeile bearbeiten</span>
            <button onClick={() => setEditRow(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {columns.map(col => {
              const val = editFields[col.name]
              const disabled = col.readonly || col.primary_key
              return (
                <div key={col.name}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {col.name}
                    {disabled && <span className="ml-1 text-gray-300 font-normal">(schreibgeschützt)</span>}
                  </label>
                  {disabled ? (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5 font-mono break-all">
                      {val === null ? 'null' : String(val)}
                    </div>
                  ) : isBoolType(col.type) ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!val}
                        onChange={e => setEditFields(f => ({ ...f, [col.name]: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-xs text-gray-600">{val ? 'true' : 'false'}</span>
                    </label>
                  ) : isLongText(col.type, col.name) ? (
                    <textarea
                      rows={4}
                      value={val ?? ''}
                      onChange={e => setEditFields(f => ({ ...f, [col.name]: e.target.value }))}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-primary-300 resize-y"
                    />
                  ) : (
                    <input
                      type="text"
                      value={val ?? ''}
                      onChange={e => setEditFields(f => ({ ...f, [col.name]: e.target.value }))}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  )}
                </div>
              )
            })}
          </div>
          {saveError && (
            <div className="px-4 pb-2 text-xs text-red-600">{saveError}</div>
          )}
          <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-primary-600 text-white text-sm py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Speichert…' : 'Speichern'}
            </button>
            <button
              onClick={() => setEditRow(null)}
              className="px-3 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Datei-Baum ─────────────────────────────────────────────────────────────

function FileTree() {
  const [tree, setTree] = useState(null)
  const [collapsed, setCollapsed] = useState({ agents: false, scripts: false })
  const [selected, setSelected] = useState(null)  // {type, id, filename}
  const [content, setContent] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    adminDbApi.getTree().then(({ data }) => setTree(data)).catch(() => {})
  }, [])

  async function selectFile(type, id, filename) {
    setSelected({ type, id, filename })
    setContent('')
    setSaveMsg('')
    setLoadingFile(true)
    try {
      const { data } = type === 'agent'
        ? await adminDbApi.getAgentFile(id, filename)
        : await adminDbApi.getScriptFile(id, filename)
      setContent(data.content || '')
    } catch {
      setContent('')
    } finally {
      setLoadingFile(false)
    }
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setSaveMsg('')
    try {
      if (selected.type === 'agent') {
        await adminDbApi.saveAgentFile(selected.id, selected.filename, content)
      } else {
        await adminDbApi.saveScriptFile(selected.id, selected.filename, content)
      }
      setSaveMsg('✓ Gespeichert')
      setTimeout(() => setSaveMsg(''), 2500)
    } catch (e) {
      setSaveMsg('❌ ' + (e?.response?.data?.error || 'Fehler'))
    } finally {
      setSaving(false)
    }
  }

  if (!tree) return <div className="text-sm text-gray-400 text-center py-16">Lädt…</div>

  const hasAgentFiles = tree.agents.some(a => a.files.length > 0)
  const hasScriptFiles = tree.scripts.some(s => s.files.length > 0)

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Baum-Sidebar */}
      <div className="w-64 shrink-0 bg-white border border-gray-200 rounded-xl overflow-y-auto">
        {/* Agenten */}
        <button
          className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          onClick={() => setCollapsed(c => ({ ...c, agents: !c.agents }))}
        >
          <span className="text-base">🤖</span>
          <span className="flex-1 text-left">Agenten</span>
          <span className="text-gray-400 text-xs">{collapsed.agents ? '▶' : '▼'}</span>
        </button>
        {!collapsed.agents && (
          tree.agents.length === 0 ? (
            <div className="px-4 py-2 text-xs text-gray-400 italic">Keine Agenten</div>
          ) : (
            tree.agents.map(agent => (
              <div key={agent.id}>
                <div className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border-b border-gray-100 truncate">
                  {agent.name}
                </div>
                {agent.files.length === 0 ? (
                  <div className="px-5 py-1 text-xs text-gray-300 italic">Keine Dateien</div>
                ) : (
                  agent.files.map(file => (
                    <button
                      key={file}
                      onClick={() => selectFile('agent', agent.id, file)}
                      className={`w-full text-left px-5 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                        selected?.type === 'agent' && selected?.id === agent.id && selected?.filename === file
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {extBadge(file)}
                      <span className="truncate">{file}</span>
                    </button>
                  ))
                )}
              </div>
            ))
          )
        )}

        {/* Scripts */}
        <button
          className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-b border-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          onClick={() => setCollapsed(c => ({ ...c, scripts: !c.scripts }))}
        >
          <span className="text-base">⚙️</span>
          <span className="flex-1 text-left">Scripts</span>
          <span className="text-gray-400 text-xs">{collapsed.scripts ? '▶' : '▼'}</span>
        </button>
        {!collapsed.scripts && (
          tree.scripts.length === 0 ? (
            <div className="px-4 py-2 text-xs text-gray-400 italic">Keine Scripts</div>
          ) : (
            tree.scripts.map(script => (
              <div key={script.id}>
                <div className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border-b border-gray-100 truncate">
                  {script.name}
                </div>
                {script.files.length === 0 ? (
                  <div className="px-5 py-1 text-xs text-gray-300 italic">Keine Dateien</div>
                ) : (
                  script.files.map(file => (
                    <button
                      key={file}
                      onClick={() => selectFile('script', script.id, file)}
                      className={`w-full text-left px-5 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                        selected?.type === 'script' && selected?.id === script.id && selected?.filename === file
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {extBadge(file)}
                      <span className="truncate">{file}</span>
                    </button>
                  ))
                )}
              </div>
            ))
          )
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm bg-white border border-gray-200 rounded-xl">
            <div className="text-center">
              <div className="text-3xl mb-2">📄</div>
              <p>Datei aus dem Baum auswählen</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
              {extBadge(selected.filename)}
              <span className="font-mono text-sm font-semibold text-gray-800">{selected.filename}</span>
              <div className="flex-1" />
              {saveMsg && <span className="text-sm text-gray-600">{saveMsg}</span>}
              <button
                onClick={handleSave}
                disabled={saving || loadingFile}
                className="bg-primary-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
              >
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
            {loadingFile ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm bg-white border border-gray-200 rounded-xl">
                Lädt…
              </div>
            ) : (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                className="flex-1 min-h-0 w-full font-mono text-sm border border-gray-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none bg-white"
                spellCheck={false}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Haupt-Seite ─────────────────────────────────────────────────────────────

export default function AdminWorkspacePage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('db')

  if (!user?.is_admin) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-6 bg-red-50 border border-red-200 rounded-xl text-center">
        <p className="text-red-700 font-semibold text-lg mb-1">Kein Zugriff</p>
        <p className="text-red-600 text-sm">Diese Seite ist nur für Administratoren zugänglich.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-sm text-primary-600 hover:underline">
          Zurück zur Startseite
        </button>
      </div>
    )
  }

  const tabs = [
    { id: 'db',    label: '🗄️  Datenbank' },
    { id: 'files', label: '📁 Dateien' },
  ]

  return (
    <div className="h-screen flex flex-col p-6 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin-Workspace</h1>
          <p className="text-sm text-gray-500 mt-0.5">Datenbank-Browser · Workspace-Dateien</p>
        </div>
        <div className="flex-1" />
        {/* Tab-Switcher */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'db'    && <DbBrowser />}
        {activeTab === 'files' && <FileTree />}
      </div>
    </div>
  )
}
