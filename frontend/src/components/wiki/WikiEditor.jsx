import { useState, useRef, useEffect, useCallback } from 'react'
import MDEditor, { commands } from '@uiw/react-md-editor'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import Button from '../common/Button'
import { wikiApi } from '../../api/wikiApi'
import { useToastStore } from '../../store/toastStore'

const tableCommand = {
  name: 'table',
  keyCommand: 'table',
  buttonProps: { title: 'Tabelle einfügen', 'aria-label': 'Tabelle einfügen' },
  icon: <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>⊞ Tabelle</span>,
  execute(_state, api) {
    api.replaceSelection(
      '\n| Spalte 1 | Spalte 2 | Spalte 3 |\n| --- | --- | --- |\n| Zelle 1 | Zelle 2 | Zelle 3 |\n'
    )
  },
}

const linkCommand = {
  name: 'wiki-link',
  keyCommand: 'wiki-link',
  buttonProps: { title: '[[Knowledge-Link]]', 'aria-label': 'Knowledge-Link einfügen' },
  icon: <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>[[]]</span>,
  execute(_state, api) {
    api.replaceSelection('[[')
  },
}

function makeImageCommand(slug, showToast) {
  return {
    name: 'image-upload',
    buttonProps: { title: 'Bild hochladen', 'aria-label': 'Bild hochladen' },
    icon: <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>🖼 Bild</span>,
    execute(_state, api) {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
          const { data } = await wikiApi.uploadAttachment(slug, file)
          const url = wikiApi.getAttachmentUrl(data.id)
          api.replaceSelection(`![${file.name}](${url})`)
        } catch {
          showToast('Bild-Upload fehlgeschlagen', 'error')
        }
      }
      input.click()
    },
  }
}

export default function WikiEditor({ initial, onSave, onCancel, loading, slug }) {
  const { showToast } = useToastStore()
  const [title, setTitle] = useState(initial?.title || '')
  const [content, setContent] = useState(initial?.content || '')
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const editorRef = useRef(null)

  // Autocomplete-State
  const [allPages, setAllPages] = useState([])
  const [acVisible, setAcVisible] = useState(false)
  const [acQuery, setAcQuery] = useState('')
  const [acResults, setAcResults] = useState([])
  const [acIndex, setAcIndex] = useState(0)

  // Seiten einmalig laden für Autocomplete
  useEffect(() => {
    wikiApi.listPages({})
      .then(({ data }) => setAllPages(data))
      .catch(() => {})
  }, [])

  // Beim Tippen prüfen ob [[… aktiv ist
  function handleContentChange(value = '') {
    setContent(value)

    // Suche letztes nicht-geschlossenes [[ im Text
    const match = value.match(/\[\[([^\][\n]{0,80})$/)
    if (match) {
      const query = match[1]
      setAcQuery(query)
      const results = allPages
        .filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8)
      setAcResults(results)
      setAcVisible(results.length > 0 || query.length === 0)
      setAcIndex(0)
    } else {
      setAcVisible(false)
    }
  }

  // Seite aus Autocomplete einfügen
  const insertLink = useCallback((page) => {
    // Ersetze das offene [[ + Suchbegriff durch [[Titel]]
    const updated = content.replace(/\[\[([^\][\n]{0,80})$/, `[[${page.title}]]`)
    setContent(updated)
    setAcVisible(false)
  }, [content])

  // Tastaturnavigation im Dropdown
  function handleEditorKeyDown(e) {
    if (!acVisible) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setAcIndex((i) => Math.min(i + 1, acResults.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setAcIndex((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && acResults[acIndex]) { e.preventDefault(); insertLink(acResults[acIndex]) }
    if (e.key === 'Escape') { setAcVisible(false) }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    onSave({ title: title.trim(), content })
  }

  async function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    if (!slug) return
    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      try {
        const { data } = await wikiApi.uploadAttachment(slug, file)
        const url = wikiApi.getAttachmentUrl(data.id)
        const isImage = file.type.startsWith('image/')
        const md = isImage ? `![${file.name}](${url})` : `[${file.name}](${url})`
        setContent((prev) => prev + '\n' + md)
      } catch {
        // Einzelne Fehler still ignorieren
      }
    }
    setUploading(false)
  }

  function handleDragOver(e) {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      setIsDragging(true)
    }
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false)
  }

  const extraCommands = [
    commands.divider,
    tableCommand,
    linkCommand,
    ...(slug ? [makeImageCommand(slug, showToast)] : []),
  ]

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full gap-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Seitentitel…"
        required
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      <div className="relative flex-1 min-h-0">
        <div
          ref={editorRef}
          className={`flex-1 min-h-0 h-full rounded-lg transition-all ${isDragging ? 'ring-2 ring-primary-400' : ''}`}
          data-color-mode="light"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={handleEditorKeyDown}
        >
          {isDragging && (
            <div className="absolute inset-0 bg-primary-50/80 rounded-lg flex items-center justify-center z-10 pointer-events-none">
              <p className="text-primary-600 font-medium text-sm">⬇ Datei loslassen – wird als Anhang eingefügt</p>
            </div>
          )}
          <MDEditor
            value={content}
            onChange={handleContentChange}
            height="100%"
            preview="live"
            visibleDragbar={false}
            previewOptions={{
              remarkPlugins: [[remarkMath]],
              rehypePlugins: [[rehypeKatex]],
            }}
            extraCommands={extraCommands}
          />
        </div>

        {/* [[Seitenname]]-Autocomplete-Dropdown */}
        {acVisible && acResults.length > 0 && (
          <div className="absolute bottom-2 left-2 z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-72 max-h-56 overflow-y-auto">
            <div className="px-3 py-1 text-xs text-gray-400 border-b border-gray-100 mb-1">
              Knowledge-Link einfügen
            </div>
            {acResults.map((page, i) => (
              <button
                key={page.slug}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertLink(page) }}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center gap-2 ${
                  i === acIndex ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-gray-400 text-xs">📄</span>
                <span className="truncate">{page.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {uploading && (
        <p className="text-xs text-primary-600">⏳ Dateien werden hochgeladen…</p>
      )}

      <div className="flex justify-end gap-2 shrink-0">
        {!slug && (
          <span className="text-xs text-gray-400 self-center">Drag & Drop nach erstem Speichern verfügbar</span>
        )}
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
        <Button type="submit" loading={loading}>
          Speichern
        </Button>
      </div>
    </form>
  )
}
