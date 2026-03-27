import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { pythonScriptsApi } from '../api/pythonScriptsApi'
import { formatDateTime } from '../utils/dateUtils'
import Button from '../components/common/Button'

const FIELD_CLASSES = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full'
const LABEL_CLASSES = 'block text-xs font-medium text-gray-600 mb-1'

const TEMPLATES = [
  {
    label: '📋 Issues ausgeben',
    code: `import axion

issues = axion.get_issues()
print(f"Anzahl Issues: {len(issues)}")
for iss in issues:
    print(f"  #{iss['id']} [{iss['status']}] {iss['title']}")
`,
  },
  {
    label: '🌐 Web-Request',
    code: `import requests

r = requests.get("https://httpbin.org/get", timeout=10)
print(r.status_code)
print(r.json())
`,
  },
  {
    label: '📁 Workspace lesen',
    code: `import axion

workspaces = axion.list_agent_workspaces()
print(f"Agent-Workspaces: {len(workspaces)}")
for ws in workspaces:
    print(f"  {ws['name']}: {ws['files']}")
`,
  },
  {
    label: '🛒 Supermarkt-Angebote',
    code: `"""
Kaufland & Rewe – Wochenangebote
=================================
Holt aktuelle Angebote und speichert sie als Markdown-Datei im Workspace.

Konfiguration (ganz oben anpassen):
  KEYWORDS  – Filterliste, z.B. ['Milch', 'Käse', 'Fleisch']  (leer = alle)
  TIMEOUT   – HTTP-Timeout in Sekunden
"""
import requests
from bs4 import BeautifulSoup
import json
import axion
from datetime import date

# ── Konfiguration ──────────────────────────────────────────────
KEYWORDS = []        # leer = alle Angebote zeigen
TIMEOUT  = 20
HEADERS  = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0 Safari/537.36'
    ),
    'Accept-Language': 'de-DE,de;q=0.9',
}

today = date.today()
kw    = today.isocalendar()[1]
results = {'kaufland': [], 'rewe': []}


def matches(name):
    if not KEYWORDS:
        return True
    return any(k.lower() in name.lower() for k in KEYWORDS)


# ── Kaufland ───────────────────────────────────────────────────
print("Lade Kaufland-Angebote …")
try:
    r = requests.get(
        'https://www.kaufland.de/angebote/diese-woche.html',
        headers=HEADERS, timeout=TIMEOUT
    )
    soup = BeautifulSoup(r.text, 'lxml')

    # Variante 1: JSON-LD strukturierte Daten
    for tag in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(tag.string or '')
            items = data if isinstance(data, list) else [data]
            for item in items:
                offers = item.get('offers') or []
                if isinstance(offers, dict):
                    offers = [offers]
                for o in offers:
                    name  = item.get('name', '')
                    price = o.get('price', '')
                    unit  = o.get('priceCurrency', 'EUR')
                    if name and matches(name):
                        results['kaufland'].append({'name': name, 'price': f"{price} {unit}"})
        except Exception:
            pass

    # Variante 2: HTML-Karten (falls JSON-LD leer)
    if not results['kaufland']:
        for card in soup.select(
            '[class*="product-tile"], [class*="offer-tile"], '
            '[class*="product-card"], [class*="c-offer"]'
        )[:40]:
            name_el  = card.select_one('[class*="title"], [class*="name"], h3, h2')
            price_el = card.select_one('[class*="price"]')
            if name_el:
                name  = name_el.get_text(' ', strip=True)
                price = price_el.get_text(' ', strip=True) if price_el else '–'
                if matches(name):
                    results['kaufland'].append({'name': name, 'price': price})

    print(f"  → {len(results['kaufland'])} Angebote gefunden")
except Exception as e:
    print(f"  ✗ Kaufland: {e}")


# ── Rewe ───────────────────────────────────────────────────────
print("Lade Rewe-Angebote …")
try:
    # Primär: Rewe mobile App-API (kein Login erforderlich)
    r = requests.get(
        'https://mobile-api.rewe.de/api/v3/all-offers?page=0&pageSize=60',
        headers={**HEADERS, 'x-platform': 'web'},
        timeout=TIMEOUT
    )
    if r.status_code == 200:
        data = r.json()
        offers_raw = (
            data.get('data', {}).get('offers')
            or data.get('offers')
            or []
        )
        for o in offers_raw:
            name  = o.get('title') or o.get('name', '')
            price = o.get('priceLabel') or str(o.get('price', '–'))
            if name and matches(name):
                results['rewe'].append({'name': name, 'price': price})
    else:
        raise ValueError(f"HTTP {r.status_code}")

    # Fallback: HTML scrapen
    if not results['rewe']:
        r2 = requests.get('https://www.rewe.de/angebote/', headers=HEADERS, timeout=TIMEOUT)
        soup = BeautifulSoup(r2.text, 'lxml')
        for card in soup.select(
            '[class*="ProductOffer"], [class*="product-offer"], '
            '[class*="offer-item"], article'
        )[:40]:
            name_el  = card.select_one('[class*="title"], [class*="name"], h3')
            price_el = card.select_one('[class*="price"], [class*="Price"]')
            if name_el:
                name  = name_el.get_text(' ', strip=True)
                price = price_el.get_text(' ', strip=True) if price_el else '–'
                if matches(name):
                    results['rewe'].append({'name': name, 'price': price})

    print(f"  → {len(results['rewe'])} Angebote gefunden")
except Exception as e:
    print(f"  ✗ Rewe: {e}")


# ── Markdown-Ausgabe & Speicherung ─────────────────────────────
lines = [f"# 🛒 Supermarkt-Angebote – KW {kw} ({today.isoformat()})\\n"]

lines.append("## 🟡 Kaufland")
if results['kaufland']:
    for a in results['kaufland']:
        lines.append(f"- **{a['name']}** — {a['price']}")
else:
    lines.append("_Keine Daten – Seite ggf. JS-Only oder Selektoren veraltet._")

lines.append("\\n## 🔴 Rewe")
if results['rewe']:
    for a in results['rewe']:
        lines.append(f"- **{a['name']}** — {a['price']}")
else:
    lines.append("_Keine Daten – API ggf. geändert oder Selektoren veraltet._")

lines.append(f"\\n---\\n_Abgerufen am {today.isoformat()}_")
content = '\\n'.join(lines)

print("\\n" + content[:800] + ("…" if len(content) > 800 else ""))

# Workspace-Datei speichern
filename = f"angebote-kw{kw}.md"
axion.write_file(filename, content)
print(f"\\n✓ Gespeichert als '{filename}'")

# Optional: Wiki-Seite aktualisieren
# axion.update_wiki_page('supermarkt-angebote', content, title=f'Angebote KW {kw}')

# Optional: Telegram-Benachrichtigung (Top 3 je Markt)
# kaufland_top = results['kaufland'][:3]
# rewe_top     = results['rewe'][:3]
# msg  = f"🛒 Angebote KW {kw}:\\n"
# msg += "Kaufland: " + ", ".join(a['name'] for a in kaufland_top) + "\\n"
# msg += "Rewe: "     + ", ".join(a['name'] for a in rewe_top)
# axion.notify_telegram(msg)
`,
  },
]

// ---------------------------------------------------------------------------
// Variablen-Tabelle
// ---------------------------------------------------------------------------
function VariablesTable({ variables }) {
  if (!variables || Object.keys(variables).length === 0) return null
  const entries = Object.entries(variables)
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-gray-500 mb-1">Variablen</p>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-2 py-1 font-medium text-gray-600 border border-gray-200">Name</th>
            <th className="text-left px-2 py-1 font-medium text-gray-600 border border-gray-200">Typ</th>
            <th className="text-left px-2 py-1 font-medium text-gray-600 border border-gray-200">Wert</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, info]) => (
            <tr key={name} className="even:bg-gray-50">
              <td className="px-2 py-1 font-mono text-primary-700 border border-gray-200">{name}</td>
              <td className="px-2 py-1 text-gray-500 border border-gray-200">{info.type}</td>
              <td className="px-2 py-1 font-mono text-gray-800 border border-gray-200 max-w-xs truncate">{info.repr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Zellen-Output-Anzeige (wiederverwendet in CellBlock und RunList)
// ---------------------------------------------------------------------------
function OutputPanel({ run }) {
  if (!run) return null
  const ok = run.exit_code === 0
  const isRunning = run.exit_code === null && !run.error
  return (
    <div className={`mt-2 rounded-lg border text-xs overflow-hidden ${ok ? 'border-green-200' : isRunning ? 'border-blue-200' : 'border-red-200'}`}>
      {isRunning && (
        <div className="px-3 py-2 bg-blue-50 text-blue-600">⏳ läuft...</div>
      )}
      {run.error && (
        <div className="px-3 py-2 bg-red-50 text-red-600">
          <strong>Fehler:</strong> {run.error}
        </div>
      )}
      {run.stdout && (
        <pre className="bg-gray-900 text-green-400 px-3 py-2 overflow-x-auto max-h-40 whitespace-pre-wrap">
          {run.stdout}
        </pre>
      )}
      {run.stderr && (
        <pre className="bg-gray-900 text-red-400 px-3 py-2 overflow-x-auto max-h-24 whitespace-pre-wrap">
          {run.stderr}
        </pre>
      )}
      {!run.stdout && !run.stderr && !run.error && !isRunning && (
        <div className="px-3 py-2 bg-green-50 text-green-700">✓ Kein Output (exit 0)</div>
      )}
      {run.variables && <div className="px-3 pb-3"><VariablesTable variables={run.variables} /></div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CellBlock — einzelne Notebook-Zelle
// ---------------------------------------------------------------------------
function CellBlock({ index, code, output, running, onChange, onRun, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  return (
    <div className={`border rounded-lg overflow-hidden ${output?.exit_code === 0 ? 'border-green-300' : output && output.exit_code !== null ? 'border-red-300' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-mono text-gray-400">[ {index + 1} ]</span>
        <div className="flex items-center gap-1">
          {!isFirst && (
            <button type="button" onClick={onMoveUp} className="text-xs text-gray-400 hover:text-gray-600 px-1">↑</button>
          )}
          {!isLast && (
            <button type="button" onClick={onMoveDown} className="text-xs text-gray-400 hover:text-gray-600 px-1">↓</button>
          )}
          <button type="button" onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 px-1 ml-1">✕</button>
        </div>
      </div>

      {/* Editor */}
      <CodeMirror
        value={code}
        height="auto"
        minHeight="60px"
        extensions={[python()]}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          autocompletion: true,
          indentOnInput: true,
          tabSize: 4,
        }}
      />

      {/* Run-Button + Output */}
      <div className="px-3 pb-3 pt-2 bg-white">
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="text-xs px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 float-right"
        >
          {running ? '⏳' : '▶'} Ausführen
        </button>
        <div className="clear-both" />
        <OutputPanel run={output} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NotebookEditor
// ---------------------------------------------------------------------------
function NotebookEditor({ cells, onChange, onRunCell, cellRunning, cellOutputs }) {
  function updateCell(idx, val) {
    const next = [...cells]
    next[idx] = val
    onChange(next)
  }

  function addCell(afterIdx) {
    const next = [...cells]
    next.splice(afterIdx + 1, 0, '')
    onChange(next)
  }

  function deleteCell(idx) {
    if (cells.length === 1) {
      onChange([''])
      return
    }
    onChange(cells.filter((_, i) => i !== idx))
  }

  function moveUp(idx) {
    if (idx === 0) return
    const next = [...cells]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next)
  }

  function moveDown(idx) {
    if (idx === cells.length - 1) return
    const next = [...cells]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {cells.map((code, idx) => (
        <div key={idx}>
          <CellBlock
            index={idx}
            code={code}
            output={cellOutputs[idx]}
            running={cellRunning === idx}
            onChange={(val) => updateCell(idx, val)}
            onRun={() => onRunCell(idx)}
            onDelete={() => deleteCell(idx)}
            onMoveUp={() => moveUp(idx)}
            onMoveDown={() => moveDown(idx)}
            isFirst={idx === 0}
            isLast={idx === cells.length - 1}
          />
          <button
            type="button"
            onClick={() => addCell(idx)}
            className="w-full text-xs text-gray-400 hover:text-gray-600 py-1 border border-dashed border-gray-200 rounded hover:border-gray-300 transition-colors"
          >
            + Zelle hinzufügen
          </button>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ScriptForm
// ---------------------------------------------------------------------------
function ScriptForm({ script, onSave, onDelete, onRun, running, onRunCell, cellRunning, cellOutputs }) {
  const initialCells = script?.cells || null
  const [notebookMode, setNotebookMode] = useState(!!initialCells)
  const [form, setForm] = useState({
    name:          script?.name || '',
    description:   script?.description || '',
    code:          script?.code || '',
    cells:         initialCells || (script?.code ? [script.code] : ['']),
    timeout_sec:   script?.timeout_sec || 30,
    is_active:     script?.is_active ?? true,
    schedule_type:  script?.schedule_type || 'manual',
    interval_min:   script?.interval_min || 60,
    schedule_days:  script?.schedule_days ?? null,
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
    if (notebookMode) {
      set('cells', [tpl.code])
    } else {
      set('code', tpl.code)
    }
  }

  function toggleNotebookMode() {
    if (!notebookMode) {
      // Einfach → Notebook: Code in Zellen aufteilen
      const rawCells = form.code
        ? form.code.split(/\n{2,}(?=\S)/).filter(Boolean)
        : ['']
      set('cells', rawCells.length > 0 ? rawCells : [''])
    } else {
      // Notebook → Einfach: Zellen zusammenführen
      set('code', form.cells.join('\n\n'))
    }
    setNotebookMode((m) => !m)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (notebookMode) {
      onSave({ ...form, cells: form.cells, code: form.cells.join('\n\n') })
    } else {
      onSave({ ...form, cells: null })
    }
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASSES}>Name</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
            placeholder="Mein Script"
            className={FIELD_CLASSES}
          />
        </div>
        <div>
          <label className={LABEL_CLASSES}>Timeout (Sekunden)</label>
          <input
            type="number"
            min="1"
            max="300"
            value={form.timeout_sec}
            onChange={(e) => set('timeout_sec', parseInt(e.target.value) || 30)}
            className={FIELD_CLASSES}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASSES}>Ausführung</label>
          <select
            value={form.schedule_type}
            onChange={(e) => set('schedule_type', e.target.value)}
            className={FIELD_CLASSES}
          >
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
        <label className={LABEL_CLASSES}>Beschreibung (optional)</label>
        <input
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Was macht dieses Script?"
          className={FIELD_CLASSES}
        />
      </div>

      {/* Code-Editor mit Developer-Modus-Toggle */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <label className={LABEL_CLASSES + ' mb-0'}>Python-Code</label>
            <a href="/wiki/axion-python-bibliothek" target="_blank" rel="noreferrer"
               className="text-xs text-primary-600 hover:underline">
              📖 Axion Library Docs
            </a>
          </div>
          <button
            type="button"
            onClick={toggleNotebookMode}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              notebookMode
                ? 'bg-primary-50 border-primary-300 text-primary-700 font-medium'
                : 'border-gray-300 text-gray-500 hover:bg-gray-50'
            }`}
          >
            🧪 Developer Modus {notebookMode ? 'an' : 'aus'}
          </button>
        </div>

        {notebookMode ? (
          <NotebookEditor
            cells={form.cells}
            onChange={(cells) => set('cells', cells)}
            onRunCell={(idx) => onRunCell && onRunCell(idx, form.cells)}
            cellRunning={cellRunning}
            cellOutputs={cellOutputs || {}}
          />
        ) : (
          <>
            <div className="border border-gray-300 rounded-lg overflow-hidden text-sm">
              <CodeMirror
                value={form.code}
                height="320px"
                extensions={[python()]}
                onChange={(val) => set('code', val)}
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLine: true,
                  autocompletion: true,
                  indentOnInput: true,
                  tabSize: 4,
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Verfügbar: <code className="bg-gray-100 px-1 rounded">import axion</code> für Projekt-Zugriff
              (Issues, Wiki, Workspaces)
            </p>
          </>
        )}
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set('is_active', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Script aktiv</span>
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit">Speichern</Button>
        {script && (
          <Button type="button" variant="secondary" onClick={onRun} loading={running}>
            ▶ Alle ausführen
          </Button>
        )}
        {script && (
          <Button type="button" variant="danger" onClick={onDelete}>
            Löschen
          </Button>
        )}
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// RunList
// ---------------------------------------------------------------------------
function RunList({ runs }) {
  const [expanded, setExpanded] = useState({})

  function toggle(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }))
  }

  if (!runs.length) return <p className="text-xs text-gray-400">Noch keine Runs.</p>

  return (
    <ul className="space-y-2">
      {runs.map((run) => {
        const ok = run.exit_code === 0
        const isRunning = run.exit_code === null && !run.error
        const isOpen = expanded[run.id]
        return (
          <li key={run.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggle(run.id)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs">{isOpen ? '▼' : '▶'}</span>
                <span className="text-xs text-gray-500">{formatDateTime(run.started_at)}</span>
                {run.finished_at && (
                  <span className="text-xs text-gray-400">
                    ({Math.round((new Date(run.finished_at) - new Date(run.started_at)) / 100) / 10}s)
                  </span>
                )}
                {run.triggered_by === 'scheduler' && (
                  <span className="text-xs text-blue-400">⏱ Scheduler</span>
                )}
                {run.triggered_by === 'ki' && (
                  <span className="text-xs text-purple-400">🤖 KI</span>
                )}
                {run.triggered_by === 'cell' && (
                  <span className="text-xs text-orange-400">🧪 Zelle</span>
                )}
              </div>
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                isRunning ? 'bg-blue-100 text-blue-600' :
                ok        ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
              }`}>
                {isRunning ? '⏳ läuft' : ok ? `✓ exit 0` : `✗ exit ${run.exit_code ?? 'err'}`}
              </span>
            </button>

            {isOpen && (
              <div className="px-3 py-2 space-y-2 border-t border-gray-100">
                {run.error && (
                  <div className="text-xs text-red-600 bg-red-50 rounded p-2">
                    <strong>App-Fehler:</strong> {run.error}
                  </div>
                )}
                {run.stdout && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">stdout</p>
                    <pre className="text-xs bg-gray-900 text-green-400 rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap">
                      {run.stdout}
                    </pre>
                  </div>
                )}
                {run.stderr && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">stderr</p>
                    <pre className="text-xs bg-gray-900 text-red-400 rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap">
                      {run.stderr}
                    </pre>
                  </div>
                )}
                {!run.stdout && !run.stderr && !run.error && (
                  <p className="text-xs text-gray-400">Kein Output.</p>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Haupt-Seite
// ---------------------------------------------------------------------------
export default function PythonScriptsPage() {
  const { projectId } = useParams()
  const [scripts, setScripts] = useState([])
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [runs, setRuns] = useState([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [cellOutputs, setCellOutputs] = useState({})   // { cellIndex: run }
  const [cellRunning, setCellRunning] = useState(null)  // cellIndex | null

  useEffect(() => {
    pythonScriptsApi.getAll(projectId).then(({ data }) => setScripts(data)).catch(() => {})
  }, [projectId])

  useEffect(() => {
    if (selected) {
      pythonScriptsApi.getRuns(selected.id).then(({ data }) => setRuns(data)).catch(() => {})
      setCellOutputs({})
      setCellRunning(null)
    } else {
      setRuns([])
    }
  }, [selected])

  function pollRun(scriptId, runId, onDone) {
    const poll = (attempts) => {
      setTimeout(() => {
        pythonScriptsApi.getRuns(scriptId).then(({ data }) => {
          setRuns(data)
          const run = data.find((r) => r.id === runId)
          if (run && run.exit_code === null && !run.error && attempts > 0) {
            poll(attempts - 1)
          } else {
            onDone && onDone(run)
          }
        }).catch(() => onDone && onDone(null))
      }, 1500)
    }
    poll(20)
  }

  async function handleSave(formData) {
    setError(null)
    try {
      if (creating) {
        const { data } = await pythonScriptsApi.create(projectId, formData)
        setScripts((s) => [...s, data])
        setSelected(data)
        setCreating(false)
      } else {
        const { data } = await pythonScriptsApi.update(selected.id, formData)
        setScripts((s) => s.map((sc) => sc.id === data.id ? data : sc))
        setSelected(data)
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Fehler beim Speichern')
    }
  }

  async function handleDelete() {
    if (!confirm(`Script "${selected.name}" wirklich löschen?`)) return
    await pythonScriptsApi.remove(selected.id)
    setScripts((s) => s.filter((sc) => sc.id !== selected.id))
    setSelected(null)
    setCreating(false)
  }

  async function handleRun() {
    setRunning(true)
    setError(null)
    try {
      const { data: runData } = await pythonScriptsApi.run(selected.id)
      pollRun(selected.id, runData.run_id, () => setRunning(false))
    } catch (e) {
      setError('Fehler beim Ausführen')
      setRunning(false)
    }
  }

  async function handleRunCell(cellIndex, cells) {
    setCellRunning(cellIndex)
    // Optimistisch: loading-State in cellOutputs setzen
    setCellOutputs((o) => ({ ...o, [cellIndex]: { exit_code: null, stdout: '', stderr: '', error: null } }))
    try {
      const { data: runData } = await pythonScriptsApi.runCells(selected.id, {
        cell_index: cellIndex,
        cells,
      })
      pollRun(selected.id, runData.run_id, (run) => {
        setCellOutputs((o) => ({ ...o, [cellIndex]: run }))
        setCellRunning(null)
      })
    } catch (e) {
      setCellOutputs((o) => ({ ...o, [cellIndex]: { exit_code: -1, error: 'Fehler beim Ausführen', stdout: '', stderr: '' } }))
      setCellRunning(null)
    }
  }

  function selectScript(sc) {
    setSelected(sc)
    setCreating(false)
    setError(null)
  }

  function startCreate() {
    setSelected(null)
    setCreating(true)
    setError(null)
  }

  const activeScript = creating ? null : selected

  return (
    <div className="flex h-full overflow-hidden">
      {/* Linke Spalte */}
      <div className="w-64 shrink-0 border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <Button size="sm" onClick={startCreate} className="w-full">+ Neues Script</Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {scripts.length === 0 && (
            <p className="text-xs text-gray-400 p-4 text-center">Noch keine Scripts.</p>
          )}
          {scripts.map((sc) => (
            <button
              key={sc.id}
              onClick={() => selectScript(sc)}
              className={`w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selected?.id === sc.id && !creating ? 'bg-primary-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${sc.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                <span className="text-xs text-gray-400 font-mono shrink-0">#{sc.id}</span>
                <span className="text-sm font-medium text-gray-800 truncate">{sc.name}</span>
                {sc.schedule_type === 'interval' && (
                  <span className="text-xs text-blue-500 shrink-0">
                    ⏱ {sc.interval_min}min
                    {sc.schedule_days && sc.schedule_days.length < 7 && (
                      <> · {['Mo','Di','Mi','Do','Fr','Sa','So'].filter((_, i) => sc.schedule_days.includes(i)).join(' ')}</>
                    )}
                  </span>
                )}
                {sc.cells && (
                  <span className="text-xs text-orange-400 shrink-0">🧪</span>
                )}
              </div>
              {sc.description && (
                <div className="text-xs text-gray-400 mt-0.5 pl-4 truncate">{sc.description}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Rechte Spalte */}
      <div className="flex-1 overflow-y-auto p-6">
        {!creating && !selected && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Script auswählen oder neues anlegen
          </div>
        )}

        {(creating || selected) && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {creating ? 'Neues Python Script' : selected.name}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <ScriptForm
              key={creating ? 'new' : (selected?.id ?? 'none')}
              script={activeScript}
              onSave={handleSave}
              onDelete={handleDelete}
              onRun={handleRun}
              running={running}
              onRunCell={selected ? handleRunCell : null}
              cellRunning={cellRunning}
              cellOutputs={cellOutputs}
            />

            {selected && (
              <div className="mt-6 border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">🕐 Protokoll</h3>
                  <button
                    onClick={() => pythonScriptsApi.getRuns(selected.id).then(({ data }) => setRuns(data))}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Aktualisieren
                  </button>
                </div>
                <RunList runs={runs} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
