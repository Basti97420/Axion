import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { userSettingsApi } from '../api/userSettingsApi'
import { settingsApi } from '../api/settingsApi'
import { telegramSettingsApi } from '../api/telegramSettingsApi'
import { projectsApi } from '../api/projectsApi'
import PasswordModal from '../components/common/PasswordModal'
import { setUserTimezone } from '../utils/dateUtils'

const CLAUDE_MODELS = [
  { value: 'claude-sonnet-4-5',          label: 'Claude Sonnet 4.5 (Empfohlen)' },
  { value: 'claude-opus-4-5',            label: 'Claude Opus 4.5 (Leistungsstark)' },
  { value: 'claude-haiku-4-5',           label: 'Claude Haiku 4.5 (Schnell & günstig)' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Stabil)' },
]

const TIMEZONES = [
  { value: '', label: 'Automatisch (Browser)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich (CET/CEST)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
]

const DEFAULT_FORM = {
  icloud_username: '',
  icloud_app_password: '',
  timezone: '',
}

// Wiederverwendbare Komponente für maskierte Passwortfelder
function MaskedInput({ value, onChange, placeholder, label, hint, className }) {
  const [show, setShow] = useState(false)
  const isStored = value === '***'
  const fieldClass = className || 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white'
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={isStored ? '' : value}
          onChange={onChange}
          placeholder={isStored ? '✓ Gespeichert – leer lassen um beizubehalten' : placeholder}
          className={`${fieldClass} pr-20`}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
        >
          {show ? 'Ausblenden' : 'Anzeigen'}
        </button>
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function UserSettingsPage() {
  const user = useAuthStore((s) => s.user)

  // Persönliche Einstellungen
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  // Admin: KI global
  const [aiForm, setAiForm] = useState(null)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiMessage, setAiMessage] = useState(null)

  // Admin: Telegram
  const [tgForm, setTgForm] = useState(null)
  const [tgSaving, setTgSaving] = useState(false)
  const [tgMessage, setTgMessage] = useState(null)
  const [projects, setProjects] = useState([])

  // Admin: iCloud global
  const [icloudForm, setIcloudForm] = useState(null)
  const [icloudSaving, setIcloudSaving] = useState(false)
  const [icloudMessage, setIcloudMessage] = useState(null)

  // Admin: Backup
  const [backupForm, setBackupForm] = useState(null)
  const [backupSaving, setBackupSaving] = useState(false)
  const [backupMessage, setBackupMessage] = useState(null)
  const [backupList, setBackupList] = useState([])
  const [backupTriggering, setBackupTriggering] = useState(false)

  // Persönliche Einstellungen laden
  useEffect(() => {
    userSettingsApi.get()
      .then(({ data }) => setForm((f) => ({ ...f, ...data })))
      .catch(() => setMessage({ type: 'error', text: 'Einstellungen konnten nicht geladen werden.' }))
  }, [])

  // Admin-Einstellungen laden
  useEffect(() => {
    if (!user?.is_admin) return
    settingsApi.getAiConfig()
      .then(({ data }) => setAiForm(data))
      .catch(() => {})
    telegramSettingsApi.get()
      .then(({ data }) => setTgForm(data))
      .catch(() => {})
    settingsApi.getIcloudConfig()
      .then(({ data }) => setIcloudForm(data))
      .catch(() => {})
    settingsApi.getBackupConfig()
      .then(({ data }) => setBackupForm(data))
      .catch(() => {})
    settingsApi.listBackups()
      .then(({ data }) => setBackupList(data))
      .catch(() => {})
    projectsApi.getAll()
      .then(({ data }) => setProjects(data))
      .catch(() => {})
  }, [user])

  // Auto-hide Meldungen
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(t)
  }, [message])

  useEffect(() => {
    if (!aiMessage) return
    const t = setTimeout(() => setAiMessage(null), 5000)
    return () => clearTimeout(t)
  }, [aiMessage])

  useEffect(() => {
    if (!tgMessage) return
    const t = setTimeout(() => setTgMessage(null), 5000)
    return () => clearTimeout(t)
  }, [tgMessage])

  useEffect(() => {
    if (!icloudMessage) return
    const t = setTimeout(() => setIcloudMessage(null), 5000)
    return () => clearTimeout(t)
  }, [icloudMessage])

  useEffect(() => {
    if (!backupMessage) return
    const t = setTimeout(() => setBackupMessage(null), 5000)
    return () => clearTimeout(t)
  }, [backupMessage])

  // Persönliche Einstellungen speichern
  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await userSettingsApi.save(form)
      setForm((f) => ({ ...f, ...data }))
      setUserTimezone(data.timezone)
      setMessage({ type: 'success', text: 'Einstellungen gespeichert.' })
    } catch {
      setMessage({ type: 'error', text: 'Fehler beim Speichern.' })
    } finally {
      setSaving(false)
    }
  }

  // Admin: KI speichern
  async function handleAiSave(e) {
    e.preventDefault()
    setAiSaving(true)
    try {
      const { data } = await settingsApi.saveAiConfig(aiForm)
      setAiForm(data)
      setAiMessage({ type: 'success', text: 'KI-Einstellungen gespeichert.' })
    } catch (err) {
      setAiMessage({ type: 'error', text: err.response?.data?.error || 'Fehler beim Speichern.' })
    } finally {
      setAiSaving(false)
    }
  }

  // Admin: Telegram speichern
  async function handleTgSave(e) {
    e.preventDefault()
    setTgSaving(true)
    try {
      const { data } = await telegramSettingsApi.save(tgForm)
      setTgForm(data)
      setTgMessage({ type: 'success', text: 'Telegram-Einstellungen gespeichert.' })
    } catch (err) {
      setTgMessage({ type: 'error', text: err.response?.data?.error || 'Fehler beim Speichern.' })
    } finally {
      setTgSaving(false)
    }
  }

  // Admin: iCloud speichern
  async function handleIcloudSave(e) {
    e.preventDefault()
    setIcloudSaving(true)
    try {
      const { data } = await settingsApi.saveIcloudConfig(icloudForm)
      setIcloudForm(data)
      setIcloudMessage({ type: 'success', text: 'iCloud-Einstellungen gespeichert.' })
    } catch (err) {
      setIcloudMessage({ type: 'error', text: err.response?.data?.error || 'Fehler beim Speichern.' })
    } finally {
      setIcloudSaving(false)
    }
  }

  // Admin: Backup speichern
  async function handleBackupSave(e) {
    e.preventDefault()
    setBackupSaving(true)
    try {
      const { data } = await settingsApi.saveBackupConfig(backupForm)
      setBackupForm(data)
      setBackupMessage({ type: 'success', text: 'Backup-Einstellungen gespeichert.' })
    } catch (err) {
      setBackupMessage({ type: 'error', text: err.response?.data?.error || 'Fehler beim Speichern.' })
    } finally {
      setBackupSaving(false)
    }
  }

  // Admin: Backup jetzt erstellen
  async function handleBackupNow() {
    setBackupTriggering(true)
    try {
      await settingsApi.triggerBackup()
      const { data: cfg } = await settingsApi.getBackupConfig()
      setBackupForm(cfg)
      const { data: list } = await settingsApi.listBackups()
      setBackupList(list)
      setBackupMessage({ type: 'success', text: 'Backup erfolgreich erstellt.' })
    } catch (err) {
      setBackupMessage({ type: 'error', text: err.response?.data?.error || 'Fehler beim Backup.' })
    } finally {
      setBackupTriggering(false)
    }
  }

  // Admin: Backup löschen
  async function handleBackupDelete(filename) {
    if (!window.confirm(`Backup "${filename}" wirklich löschen?`)) return
    try {
      await settingsApi.deleteBackup(filename)
      setBackupList((l) => l.filter((b) => b.filename !== filename))
    } catch (err) {
      setBackupMessage({ type: 'error', text: err.response?.data?.error || 'Fehler beim Löschen.' })
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function formatDate(iso) {
    if (!iso) return '–'
    try {
      return new Date(iso + 'Z').toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return iso
    }
  }

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })) }
  function setAi(key, value) { setAiForm((f) => ({ ...f, [key]: value })) }
  function setTg(key, value) { setTgForm((f) => ({ ...f, [key]: value })) }
  function setIcloud(key, value) { setIcloudForm((f) => ({ ...f, [key]: value })) }
  function setBackup(key, value) { setBackupForm((f) => ({ ...f, [key]: value })) }

  const fieldClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white'
  const labelClass = 'block text-xs font-medium text-gray-700 mb-1'

  function SaveRow({ saving, message, label = 'Speichern' }) {
    return (
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Speichern…' : label}
        </button>
        {message && (
          <span className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.type === 'success' ? '✓' : '⚠'} {message.text}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Einstellungen</h1>
        <p className="text-sm text-gray-500">Persönliche Konfigurationen und{user?.is_admin ? ' Systemeinstellungen' : ' Anpassungen'}.</p>
      </div>

      {/* ── Persönliche Einstellungen ── */}
      <form onSubmit={handleSave} className="space-y-8">

        {/* Profil */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">Profil</h2>
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span>🔑</span> Passwort ändern
          </button>
        </section>

        {/* iCloud Kalender (persönlich) */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-1 pb-2 border-b border-gray-200">
            Kalender (iCloud) <span className="text-xs font-normal text-gray-400 ml-1">persönlich</span>
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Für die iCloud-Synchronisation wird ein app-spezifisches Passwort benötigt.{' '}
            <a href="https://support.apple.com/en-us/102654" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              Apple-Dokumentation →
            </a>
          </p>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Apple ID (E-Mail)</label>
              <input type="email" value={form.icloud_username} onChange={(e) => set('icloud_username', e.target.value)}
                placeholder="beispiel@icloud.com" className={fieldClass} autoComplete="username" />
            </div>
            <MaskedInput
              label="App-spezifisches Passwort"
              value={form.icloud_app_password}
              onChange={(e) => set('icloud_app_password', e.target.value)}
              placeholder="xxxx-xxxx-xxxx-xxxx"
              className={fieldClass}
            />
          </div>
        </section>

        {/* Zeitzone */}
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-1 pb-2 border-b border-gray-200">Zeitzone</h2>
          <p className="text-xs text-gray-500 mb-4">Beeinflusst die Anzeige von Zeitstempeln (Aktivität, Kommentare, etc.).</p>
          <div>
            <label className={labelClass}>Zeitzone</label>
            <select value={form.timezone} onChange={(e) => set('timezone', e.target.value)} className={fieldClass}>
              {TIMEZONES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </section>

        <SaveRow saving={saving} message={message} />
      </form>

      {/* ── Admin-Sektionen ── */}
      {user?.is_admin && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 pt-4">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">Administrator</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          <div className="flex gap-3 text-xs">
            <a href="/wiki/api-referenz" target="_blank" rel="noreferrer"
               className="text-primary-600 hover:underline">📖 API-Referenz</a>
            <a href="/wiki/axion-python-bibliothek" target="_blank" rel="noreferrer"
               className="text-primary-600 hover:underline">📖 Axion Library Docs</a>
            <a href="/wiki/ki-agenten-aktionen" target="_blank" rel="noreferrer"
               className="text-primary-600 hover:underline">📖 Ki Agenten Aktionen</a>
          </div>

          {/* KI Global */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">KI-Assistent (Global)</h2>
              <p className="text-xs text-gray-500 mt-0.5">Standard-Provider für alle Nutzer ohne persönliche KI-Einstellung</p>
            </div>
            {!aiForm ? <div className="px-5 py-6 text-sm text-gray-400">Lädt…</div> : (
              <form onSubmit={handleAiSave} className="px-5 py-5 space-y-5">
                <div>
                  <label className={labelClass}>Provider</label>
                  <div className="flex gap-2">
                    {[{ value: 'ollama', label: 'Ollama (lokal)' }, { value: 'claude', label: 'Claude API' }].map(({ value, label }) => (
                      <button key={value} type="button" onClick={() => setAi('provider', value)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          aiForm.provider === value
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                        }`}>{label}</button>
                    ))}
                  </div>
                </div>
                {aiForm.provider === 'ollama' && (
                  <>
                    <div>
                      <label className={labelClass}>Host-URL</label>
                      <input type="text" value={aiForm.ollama_url} onChange={(e) => setAi('ollama_url', e.target.value)}
                        placeholder="http://host.docker.internal:11434" className={fieldClass} />
                      <p className="text-xs text-gray-400 mt-1">In Docker: <code className="bg-gray-100 px-1 rounded">http://host.docker.internal:11434</code></p>
                    </div>
                    <div>
                      <label className={labelClass}>Modell</label>
                      <input type="text" value={aiForm.ollama_model} onChange={(e) => setAi('ollama_model', e.target.value)}
                        placeholder="llama3.2" className={fieldClass} />
                    </div>
                  </>
                )}
                {aiForm.provider === 'claude' && (
                  <>
                    <MaskedInput label="API-Key" value={aiForm.claude_api_key}
                      onChange={(e) => setAi('claude_api_key', e.target.value === '' ? aiForm.claude_api_key : e.target.value)}
                      placeholder="sk-ant-..." className={fieldClass}
                      hint="Anthropic API-Key – wird maskiert gespeichert" />
                    <div>
                      <label className={labelClass}>Modell</label>
                      <select value={aiForm.claude_model} onChange={(e) => setAi('claude_model', e.target.value)} className={fieldClass}>
                        {CLAUDE_MODELS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                  </>
                )}
                <SaveRow saving={aiSaving} message={aiMessage} />
              </form>
            )}
          </section>

          {/* Telegram Bot */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Telegram Bot</h2>
              <p className="text-xs text-gray-500 mt-0.5">Bot-Token und Chat-ID für Issues, KI-Anfragen und Benachrichtigungen</p>
            </div>
            {!tgForm ? <div className="px-5 py-6 text-sm text-gray-400">Lädt…</div> : (
              <form onSubmit={handleTgSave} className="px-5 py-5 space-y-4">
                <MaskedInput label="Bot Token" value={tgForm.bot_token}
                  onChange={(e) => setTg('bot_token', e.target.value)}
                  placeholder="123456:ABC-DEF..." className={fieldClass}
                  hint="Von @BotFather erhalten – wird maskiert gespeichert" />
                <div>
                  <label className={labelClass}>Chat-ID</label>
                  <input type="text" value={tgForm.chat_id} onChange={(e) => setTg('chat_id', e.target.value)}
                    placeholder="-100123456789" className={fieldClass} />
                  <p className="text-xs text-gray-400 mt-1">Gruppen-ID oder persönliche User-ID</p>
                </div>
                <div>
                  <label className={labelClass}>Standard-Projekt <span className="font-normal text-gray-400">(für /issue Befehl)</span></label>
                  <select value={tgForm.default_project_id ?? ''} onChange={(e) => setTg('default_project_id', e.target.value ? parseInt(e.target.value) : null)} className={fieldClass}>
                    <option value="">– Kein Standard-Projekt –</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Benachrichtigungen</label>
                  <div className="space-y-2">
                    {[
                      { key: 'notify_on_create', label: 'Bei Issue-Erstellung benachrichtigen' },
                      { key: 'notify_on_status_change', label: 'Bei Status-Änderungen benachrichtigen' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={tgForm[key]} onChange={(e) => setTg(key, e.target.checked)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Benachrichtigungs-Intervall</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" max="60"
                      value={tgForm.notify_interval_min ?? 5}
                      onChange={(e) => setTg('notify_interval_min', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    />
                    <span className="text-sm text-gray-500">Minuten (0 = sofort senden)</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Benachrichtigungen werden gesammelt und alle N Minuten als eine Nachricht gesendet</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-500 space-y-1">
                  <p className="font-medium text-gray-600 mb-1">Verfügbare Bot-Befehle:</p>
                  <p><code className="bg-white px-1 rounded border">/issue &lt;Titel&gt;</code> – Neues Issue erstellen</p>
                  <p><code className="bg-white px-1 rounded border">/issues</code> – Letzte 5 offene Issues</p>
                  <p><code className="bg-white px-1 rounded border">/ki &lt;Frage&gt;</code> – KI-Assistent befragen</p>
                  <p><code className="bg-white px-1 rounded border">/hilfe</code> – Alle Befehle anzeigen</p>
                </div>
                <SaveRow saving={tgSaving} message={tgMessage} />
              </form>
            )}
          </section>

          {/* iCloud Global */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">iCloud Kalender (Global)</h2>
              <p className="text-xs text-gray-500 mt-0.5">Termine aus Axion automatisch in den iCloud-Kalender übertragen</p>
            </div>
            {!icloudForm ? <div className="px-5 py-6 text-sm text-gray-400">Lädt…</div> : (
              <form onSubmit={handleIcloudSave} className="px-5 py-5 space-y-4">
                <div>
                  <label className={labelClass}>Apple-ID (E-Mail)</label>
                  <input type="email" value={icloudForm.username} onChange={(e) => setIcloud('username', e.target.value)}
                    placeholder="deine@icloud.com" className={fieldClass} />
                </div>
                <MaskedInput label="App-Passwort" value={icloudForm.app_password}
                  onChange={(e) => setIcloud('app_password', e.target.value)}
                  placeholder="xxxx-xxxx-xxxx-xxxx" className={fieldClass}
                  hint="appleid.apple.com → Anmeldung & Sicherheit → App-spezifische Passwörter" />
                <div>
                  <label className={labelClass}>Kalender-Name</label>
                  <input type="text" value={icloudForm.calendar_name} onChange={(e) => setIcloud('calendar_name', e.target.value)}
                    placeholder="Axion" className={fieldClass} />
                  <p className="text-xs text-gray-400 mt-1">Wird neu erstellt falls er nicht existiert</p>
                </div>
                <div>
                  <label className={labelClass}>Standard-Projekt für iCloud-Importe</label>
                  <select value={icloudForm.default_project_id || ''} onChange={(e) => setIcloud('default_project_id', e.target.value ? parseInt(e.target.value) : null)} className={fieldClass}>
                    <option value="">— Erstes verfügbares Projekt —</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Neue Termine aus iCloud werden als Issues in diesem Projekt angelegt</p>
                </div>
                <SaveRow saving={icloudSaving} message={icloudMessage} />
              </form>
            )}
          </section>

          {/* Automatisches Backup */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Automatisches Backup</h2>
              <p className="text-xs text-gray-500 mt-0.5">Regelmäßige Sicherung der Datenbank und Wiki-Anhänge auf dem Server</p>
            </div>
            {!backupForm ? <div className="px-5 py-6 text-sm text-gray-400">Lädt…</div> : (
              <div className="px-5 py-5 space-y-5">
                <form onSubmit={handleBackupSave} className="space-y-4">
                  {/* Toggle */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setBackup('enabled', !backupForm.enabled)}
                      className={`relative w-10 h-6 rounded-full transition-colors ${backupForm.enabled ? 'bg-primary-600' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${backupForm.enabled ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-sm text-gray-700">Automatisches Backup aktiv</span>
                  </label>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Intervall (Tage)</label>
                      <input
                        type="number" min="1" max="365"
                        value={backupForm.interval_days}
                        onChange={(e) => setBackup('interval_days', Math.max(1, parseInt(e.target.value) || 7))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        disabled={!backupForm.enabled}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Max. gespeicherte Backups</label>
                      <input
                        type="number" min="1" max="20"
                        value={backupForm.max_keep}
                        onChange={(e) => setBackup('max_keep', Math.max(1, parseInt(e.target.value) || 5))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      />
                    </div>
                  </div>

                  {backupForm.last_run && (
                    <p className="text-xs text-gray-500">
                      Letztes automatisches Backup: <span className="font-medium text-gray-700">{formatDate(backupForm.last_run)}</span>
                    </p>
                  )}

                  <div className="flex items-center gap-3">
                    <SaveRow saving={backupSaving} message={backupMessage} />
                    <button
                      type="button"
                      onClick={handleBackupNow}
                      disabled={backupTriggering}
                      className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 border border-gray-300"
                    >
                      {backupTriggering ? 'Sichert…' : '💾 Jetzt sichern'}
                    </button>
                  </div>
                </form>

                {/* Backup-Liste */}
                {backupList.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Gespeicherte Backups</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Datum</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Größe</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {backupList.map((b) => (
                            <tr key={b.filename} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-700 font-mono">{formatDate(b.created_at)}</td>
                              <td className="px-3 py-2 text-gray-500">{formatBytes(b.size_bytes)}</td>
                              <td className="px-3 py-2 text-right space-x-2">
                                <a
                                  href={settingsApi.backupDownloadUrl(b.filename)}
                                  download={b.filename}
                                  className="text-primary-600 hover:underline"
                                >
                                  ↓ Download
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleBackupDelete(b.filename)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {backupList.length === 0 && (
                  <p className="text-xs text-gray-400">Noch keine automatischen Backups vorhanden. Klicke „Jetzt sichern" für das erste Backup.</p>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <PasswordModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </div>
  )
}
