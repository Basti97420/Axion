import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WikiTree from '../components/wiki/WikiTree'
import WikiEditor from '../components/wiki/WikiEditor'
import { wikiApi } from '../api/wikiApi'

export default function WikiIndexPage() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [treeKey, setTreeKey] = useState(0)

  async function handleCreate(data) {
    setSaving(true)
    try {
      const { data: page } = await wikiApi.createPage(data)
      setCreating(false)
      setTreeKey((k) => k + 1) // refresh tree
      navigate(`/wiki/${page.slug}`)
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

      <div className="flex-1 overflow-y-auto p-6">
        {creating ? (
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            <h1 className="text-xl font-bold text-gray-900 mb-4">Neue Wiki-Seite</h1>
            <div className="flex-1 min-h-0">
              <WikiEditor
                onSave={handleCreate}
                onCancel={() => setCreating(false)}
                loading={saving}
              />
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto text-center mt-20">
            <div className="text-4xl mb-4">📖</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Wiki</h2>
            <p className="text-sm text-gray-500 mb-6">
              Wähle eine Seite aus der Seitenleiste oder erstelle eine neue.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
            >
              + Neue Seite erstellen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
