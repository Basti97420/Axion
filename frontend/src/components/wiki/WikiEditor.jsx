import { useState } from 'react'
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

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    onSave({ title: title.trim(), content })
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

      <div className="flex-1 min-h-0" data-color-mode="light">
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

      <div className="flex justify-end gap-2 shrink-0">
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
