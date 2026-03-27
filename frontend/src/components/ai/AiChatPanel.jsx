import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAiStore } from '../../store/aiStore'
import { aiApi } from '../../api/aiApi'

export default function AiChatPanel() {
  const { isOpen, close, messages, addMessage, loading, setLoading } = useAiStore()
  const params = useParams()
  const projectId = params.projectId ? parseInt(params.projectId) : null
  const issueId = params.issueId ? parseInt(params.issueId) : null
  const wikiSlug = params.slug || null

  const [input, setInput] = useState('')
  const [aiStatus, setAiStatus] = useState(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      aiApi.getStatus()
        .then(({ data }) => setAiStatus(data))
        .catch(() => setAiStatus({ available: false, provider: 'ollama' }))
    }
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    addMessage({ role: 'user', content: text })
    setLoading(true)

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const { data } = await aiApi.chat({
        message: text,
        context: { project_id: projectId, issue_id: issueId, wiki_slug: wikiSlug },
        history,
      })
      addMessage({ role: 'assistant', content: data.reply, action_result: data.action_result })
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: '⚠ Fehler: ' + (err.response?.data?.error || err.message),
      })
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  const providerLabel = aiStatus?.provider === 'claude' ? 'Claude' : 'Ollama'
  const isAvailable = aiStatus?.available

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={close} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-screen w-[400px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 shrink-0">
          <span className="font-semibold text-gray-800 text-sm">KI-Assistent</span>
          {aiStatus && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
              isAvailable
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-600 border-red-200'
            }`}>
              {providerLabel} {isAvailable ? '●' : '✗'}
            </span>
          )}
          <div className="flex-1" />
          {(projectId || issueId || wikiSlug) && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {issueId ? `Issue #${issueId}` : wikiSlug ? `Wiki: ${wikiSlug}` : `Projekt ${projectId}`}
            </span>
          )}
          <button
            onClick={close}
            className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Nachrichten */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-gray-400 text-center mt-8 leading-relaxed">
              Stell mir eine Frage zu deinen Issues.<br />
              z.B. „Was sind meine offenen Aufgaben?"<br />
              oder „Schreibe eine Beschreibung für Issue #1"
            </p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.action_result && (
                  <p className={`mt-1.5 text-xs ${msg.role === 'user' ? 'text-primary-200' : 'text-green-600'}`}>
                    {msg.action_result.type === 'issue_updated' &&
                      `✓ Issue #${msg.action_result.issue_id} aktualisiert`}
                    {msg.action_result.type === 'comment_added' &&
                      `✓ Kommentar zu Issue #${msg.action_result.issue_id} hinzugefügt`}
                    {msg.action_result.type === 'create_issue' &&
                      `✓ Issue #${msg.action_result.issue_id} erstellt: „${msg.action_result.title}"`}
                    {msg.action_result.type === 'wiki_page_created' &&
                      `✓ Wiki-Seite „${msg.action_result.title}" erstellt`}
                    {msg.action_result.type === 'wiki_page_updated' &&
                      `✓ Wiki-Seite „${msg.action_result.title}" aktualisiert`}
                    {msg.action_result.type === 'worklog_added' &&
                      `✓ ${msg.action_result.hours}h auf Issue #${msg.action_result.issue_id} erfasst`}
                    {msg.action_result.type === 'milestone_created' &&
                      `✓ Meilenstein „${msg.action_result.name}" erstellt`}
                    {msg.action_result.type === 'dependency_set' &&
                      `✓ Issue #${msg.action_result.issue_id} blockiert jetzt #${msg.action_result.blocks}`}
                    {msg.action_result.type === 'tag_added' &&
                      `✓ Tag zu Issue #${msg.action_result.issue_id} hinzugefügt`}
                    {msg.action_result.type === 'tag_removed' &&
                      `✓ Tag von Issue #${msg.action_result.issue_id} entfernt`}
                  </p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-400">
                Denkt nach…
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Eingabe */}
        <div className="px-3 pb-3 pt-2 border-t border-gray-200 shrink-0">
          {aiStatus && !isAvailable && (
            <p className="text-xs text-red-500 mb-2">
              {aiStatus.provider === 'claude'
                ? '⚠ Claude API-Key nicht konfiguriert (CLAUDE_API_KEY in .env)'
                : '⚠ Ollama nicht erreichbar – bitte starte Ollama (localhost:11434)'}
            </p>
          )}
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nachricht… (Enter zum Senden)"
              rows={2}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="px-3 bg-primary-600 text-white rounded-lg text-base font-medium hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
