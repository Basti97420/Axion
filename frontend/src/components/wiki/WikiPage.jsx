import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import Button from '../common/Button'
import { wikiApi } from '../../api/wikiApi'
import { formatDateTime } from '../../utils/dateUtils'

export default function WikiPage({ page, onEdit, onDelete }) {
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState(page.attachments || [])
  const contentRef = useRef(null)

  // KaTeX: rendert math-inline und math-block Elemente nach HTML-Rendering
  useEffect(() => {
    if (!contentRef.current) return
    contentRef.current.querySelectorAll('.math.math-inline').forEach((el) => {
      try {
        katex.render(el.textContent, el, { throwOnError: false })
      } catch {}
    })
    contentRef.current.querySelectorAll('.math.math-block').forEach((el) => {
      try {
        katex.render(el.textContent, el, { throwOnError: false, displayMode: true })
      } catch {}
    })
  }, [page.rendered])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { data } = await wikiApi.uploadAttachment(page.slug, file)
      setAttachments((prev) => [...prev, data])
    } catch {
      alert('Upload fehlgeschlagen')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDeleteAttachment(id) {
    if (!confirm('Anhang löschen?')) return
    await wikiApi.deleteAttachment(id)
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  function formatSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{page.title}</h1>
          <p className="text-xs text-gray-400 mt-1">
            Zuletzt geändert: {formatDateTime(page.updated_at)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="secondary" onClick={onEdit}>Bearbeiten</Button>
          <Button size="sm" variant="danger" onClick={onDelete}>Löschen</Button>
        </div>
      </div>

      {/* Rendered content */}
      <div
        ref={contentRef}
        className="prose prose-sm max-w-none mb-8"
        dangerouslySetInnerHTML={{ __html: page.rendered || '' }}
        onClick={(e) => {
          const a = e.target.closest('a.wiki-link')
          if (!a) return
          e.preventDefault()
          navigate(new URL(a.href, window.location.origin).pathname)
        }}
      />

      {/* Attachments */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Anhänge ({attachments.length})</h3>
          <label className="cursor-pointer">
            <span className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              {uploading ? 'Lädt hoch…' : '+ Datei hochladen'}
            </span>
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
        {attachments.length > 0 && (
          <ul className="space-y-1">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 text-sm group">
                {a.mime_type?.startsWith('image/') && (
                  <img
                    src={wikiApi.getAttachmentUrl(a.id)}
                    alt={a.filename}
                    className="w-8 h-8 object-cover rounded border border-gray-200 shrink-0"
                  />
                )}
                <a
                  href={wikiApi.getAttachmentUrl(a.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary-600 hover:underline truncate flex-1"
                >
                  {a.filename}
                </a>
                <span className="text-xs text-gray-400 shrink-0">{formatSize(a.size_bytes)}</span>
                <button
                  onClick={() => handleDeleteAttachment(a.id)}
                  className="text-xs text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
