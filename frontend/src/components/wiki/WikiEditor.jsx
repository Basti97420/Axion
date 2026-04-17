import { useState, useRef } from 'react'
import MDEditor, { commands } from '@uiw/react-md-editor'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import Button from '../common/Button'
import { wikiApi } from '../../api/wikiApi'

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

function makeImageCommand(slug) {
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
          alert('Bild-Upload fehlgeschlagen')
        }
      }
      input.click()
    },
  }
}

export default function WikiEditor({ initial, onSave, onCancel, loading, slug }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [content, setContent] = useState(initial?.content || '')
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const editorRef = useRef(null)

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
    ...(slug ? [makeImageCommand(slug)] : []),
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

      <div
        ref={editorRef}
        className={`flex-1 min-h-0 rounded-lg transition-all ${isDragging ? 'ring-2 ring-primary-400' : ''}`}
        data-color-mode="light"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 bg-primary-50/80 rounded-lg flex items-center justify-center z-10 pointer-events-none">
            <p className="text-primary-600 font-medium text-sm">⬇ Datei loslassen – wird als Anhang eingefügt</p>
          </div>
        )}
        <MDEditor
          value={content}
          onChange={setContent}
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
