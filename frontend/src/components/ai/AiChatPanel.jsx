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
      addMessage({
        role: 'assistant',
        content: data.reply,
        action_results: data.action_results || (data.action_result ? [data.action_result] : []),
      })
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

  function actionResultLabel(r) {
    if (!r) return ''
    switch (r.type) {
      case 'issue_updated':     return `✓ Issue #${r.issue_id} aktualisiert`
      case 'comment_added':     return `✓ Kommentar zu Issue #${r.issue_id}`
      case 'create_issue':      return `✓ Issue #${r.issue_id} erstellt: „${r.title}"`
      case 'wiki_page_created': return `✓ Knowledge-Seite „${r.title}" erstellt`
      case 'wiki_page_updated': return `✓ Knowledge-Seite „${r.title}" aktualisiert`
      case 'worklog_added':     return `✓ ${r.hours}h auf Issue #${r.issue_id} erfasst`
      case 'milestone_created': return `✓ Meilenstein „${r.name}" erstellt`
      case 'dependency_set':    return `✓ Issue #${r.issue_id} blockiert #${r.blocks}`
      case 'tag_added':         return `✓ Tag zu Issue #${r.issue_id} hinzugefügt`
      case 'tag_removed':       return `✓ Tag von Issue #${r.issue_id} entfernt`
      case 'read_done':         return `↻ Daten abgerufen (${r.action})`
      case 'memory_saved':      return `✓ Memory gespeichert: ${r.filename}`
      case 'file_created':      return `✓ Datei erstellt: ${r.filename}`
      case 'agent_triggered':   return `✓ Agent gestartet (ID: ${r.agent_id})`
      case 'script_started':    return `✓ Script gestartet`
      case 'script_created':    return `✓ Script erstellt: ${r.name || r.script_id}`
      case 'ki_agent_created':  return `✓ KI-Agent erstellt: ${r.name}`
      case 'ki_agent_started':  return `✓ KI-Agent gestartet (ID: ${r.agent_id})`
      default:                  return `✓ ${r.type}`
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
              {issueId ? `Issue #${issueId}` : wikiSlug ? `Knowledge: ${wikiSlug}` :`Projekt ${projectId}`}
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
                {msg.action_results && msg.action_results.length > 0 && (
                  <details className="mt-2 border-t border-gray-200 pt-1.5 group/outer">
                    <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-xs text-green-700 font-medium flex items-center gap-1.5 py-0.5 hover:text-green-800">
                      <svg className="w-2 h-2 shrink-0 transition-transform duration-150 group-open/outer:rotate-90" fill="currentColor" viewBox="0 0 6 10"><path d="M0 0l6 5-6 5V0z"/></svg>
                      ✅ {msg.action_results.length} Aktion{msg.action_results.length !== 1 ? 'en' : ''} ausgeführt
                    </summary>
                    <div className="mt-1 space-y-0.5 ml-1">
                      {msg.action_results.map((result, idx) => (
                        <details key={idx} className="group/inner text-xs">
                          <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center gap-1.5 text-green-600 hover:text-green-700 py-0.5 pl-1">
                            <svg className="w-1.5 h-1.5 shrink-0 transition-transform duration-150 group-open/inner:rotate-90" fill="currentColor" viewBox="0 0 6 10"><path d="M0 0l6 5-6 5V0z"/></svg>
                            <span>{actionResultLabel(result)}</span>
                          </summary>
                          <div className="mt-1 ml-4 space-y-1.5">
                            {result._prompt && (
                              <div>
                                <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">📤 Gesendeter Prompt</div>
                                <pre className="text-[10px] bg-blue-50 border border-blue-100 rounded p-2 text-gray-600 whitespace-pre-wrap overflow-x-auto">{result._prompt}</pre>
                              </div>
                            )}
                            {result._raw && (
                              <div>
                                <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">📥 KI-Antwort</div>
                                <pre className="text-[10px] bg-yellow-50 border border-yellow-100 rounded p-2 text-gray-600 whitespace-pre-wrap overflow-x-auto">{result._raw}</pre>
                              </div>
                            )}
                            <div>
                              <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">📋 Ergebnis</div>
                              <pre className="text-[10px] bg-gray-50 border border-gray-100 rounded p-2 text-gray-500 whitespace-pre-wrap overflow-x-auto">
                                {JSON.stringify(Object.fromEntries(Object.entries(result).filter(([k]) => !k.startsWith('_'))), null, 2)}
                              </pre>
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
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
