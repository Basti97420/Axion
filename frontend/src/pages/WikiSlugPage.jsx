import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import WikiTree from '../components/wiki/WikiTree'
import WikiPage from '../components/wiki/WikiPage'
import WikiEditor from '../components/wiki/WikiEditor'
import { wikiApi } from '../api/wikiApi'

export default function WikiSlugPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [page, setPage] = useState(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [treeKey, setTreeKey] = useState(0)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    setNotFound(false)
    setPage(null)
    setEditing(false)
    setCreating(false)
    wikiApi.getPage(slug)
      .then(({ data }) => setPage(data))
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true)
      })
  }, [slug])

  async function handleSave(data) {
    setSaving(true)
    try {
      const { data: updated } = await wikiApi.updatePage(slug, data)
      setPage(updated)
      setEditing(false)
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Seite "${page.title}" wirklich löschen?`)) return
    await wikiApi.deletePage(slug)
    setTreeKey((k) => k + 1)
    navigate('/knowledge')
  }

  async function handleCreate(data) {
    setSaving(true)
    try {
      const { data: newPage } = await wikiApi.createPage(data)
      setCreating(false)
      setTreeKey((k) => k + 1)
      navigate(`/knowledge/${newPage.slug}`)
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-64 shrink-0 border-r border-gray-200 overflow-hidden flex flex-col">
        <WikiTree key={treeKey} onNewPage={() => setCreating(true)} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {creating && (
          <div className="max-w-4xl mx-auto h-full flex flex-col p-6">
            <h1 className="text-xl font-bold text-gray-900 mb-4">Neue Knowledge-Seite</h1>
            <div className="flex-1 min-h-0">
              <WikiEditor
                onSave={handleCreate}
                onCancel={() => setCreating(false)}
                loading={saving}
              />
            </div>
          </div>
        )}

        {!creating && notFound && (
          <div className="max-w-2xl mx-auto text-center mt-20">
            <div className="text-4xl mb-4">🔴</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Seite nicht gefunden</h2>
            <p className="text-sm text-gray-500 mb-6">
              Diese Seite existiert noch nicht.
            </p>
            <button
              onClick={() => {
                // Pre-fill title from slug for new page creation
                navigate('/knowledge')
              }}
              className="text-sm text-primary-600 hover:underline"
            >
              ← Zurück zur Knowledge-Base
            </button>
          </div>
        )}

        {!creating && !page && !notFound && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-gray-400">Lädt…</span>
          </div>
        )}

        {!creating && page && !editing && (
          <WikiPage
            page={page}
            onEdit={() => setEditing(true)}
            onDelete={handleDelete}
          />
        )}

        {!creating && page && editing && (
          <div className="h-full flex flex-col p-6">
            <WikiEditor
              initial={page}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
              loading={saving}
              slug={slug}
            />
          </div>
        )}
      </div>
    </div>
  )
}
