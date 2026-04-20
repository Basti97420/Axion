# Axion – Projektübersicht für Claude

## Architektur

Axion ist ein Monolith — alles in einem Flask-Backend:

| Komponente | Port | Verzeichnis | Beschreibung |
|---------|------|-------------|-------------|
| main-api | 5050 | `main-api/` | Flask: Issues, Projekte, Wiki, Kalender, iCloud-Sync, KI |
| frontend | 5173 | `frontend/` | Vite + React |

Wiki und iCloud-Kalender-Sync sind direkt in `main-api` integriert (`app/routes/wiki.py (URL-Prefix: /api/knowledge)`, `app/routes/calendar_sync.py`).

## Services starten

```bash
# main-api (enthält Wiki + Kalender)
cd main-api && source venv/bin/activate && python run.py

# frontend
cd frontend && npm run dev
```

Oder im Hintergrund:
```bash
cd main-api && nohup venv/bin/python run.py > /dev/null 2>&1 &
```

## Datenbank

- **ORM**: SQLAlchemy + Flask-Migrate (Alembic)
- **DB**: SQLite (`main-api/instance/planwiki.db`) – eine Datenbank für alle Features inkl. Wiki
- **Migrationen**:
  ```bash
  cd main-api && source venv/bin/activate
  flask db migrate -m "beschreibung"
  flask db upgrade
  ```
- SQLite hat kein transaktionales DDL → Migrationen mit `_has_table()` / `_has_column()` idempotent schreiben

## Standard-Login

Beim ersten Start mit leerer Datenbank legt `run.py` automatisch an:
- **Benutzername**: `admin`
- **Passwort**: `admin`

Danach über Benutzerverwaltung (`/admin/users`) ändern.

## Frontend-Stack

- **Vite + React 18**
- **Tailwind CSS** – primäre Farbe: `primary-*` (definiert in `tailwind.config.js`)
- **@tailwindcss/typography** – `prose prose-sm` für Markdown-Rendering
- **Zustand** – State Management (`src/store/`)
- **Axios** – API-Client (`src/api/client.js`, Basis: `http://localhost:5050/api`)
- **FullCalendar v6** – Kalender (`@fullcalendar/react`)
- **@dnd-kit/core** – Kanban Drag & Drop (nur `useDraggable`/`useDroppable`, kein `SortableContext`)
- **react-markdown** – Markdown-Rendering in Issue-Beschreibungen und Kommentaren

## Backend-Konventionen

- **Blueprint-Pattern**: jede Route-Gruppe = eigenes Blueprint in `app/routes/`
- **`to_dict()`** auf jedem Model für JSON-Serialisierung
- **`@login_required`** für alle geschützten Endpunkte (Flask-Login, Session-Cookies)
- **`@admin_required`** für Admin-Endpunkte (definiert in `app/routes/admin.py`)
- **Activity Logging**: `activity_logger.log(action, user_id, issue_id, ...)` nach Änderungen
- Fehlerantworten: `jsonify({"error": "Meldung"}), HTTP-Code`

## API-Muster

```
GET    /api/projects              → Liste
POST   /api/projects              → Anlegen
GET    /api/projects/<id>         → Detail
PUT    /api/projects/<id>         → Aktualisieren
DELETE /api/projects/<id>         → Löschen

PATCH  /api/issues/<id>/status    → Status-Wechsel (Kanban); setzt closed_at bei done/cancelled
PATCH  /api/issues/<id>/due_date  → Fälligkeitsdatum (Kalender-Drop)

POST   /api/issues/<id>/activity/<aid>/revert  → Feld-Änderung rückgängig (nur Admin)

POST   /api/issues/<id>/attachments        → Datei hochladen
GET    /api/issues/<id>/attachments        → Anhänge auflisten
GET    /api/attachments/<id>/download      → Datei herunterladen (Content-Disposition: attachment)
GET    /api/attachments/<id>/preview       → Datei inline anzeigen (Content-Disposition: inline, für Bilder/PDFs)
DELETE /api/attachments/<id>               → Anhang löschen (nur Uploader oder Admin)

GET    /api/search?q=<query>      → Volltextsuche über Issues + Kommentare (min. 2 Zeichen)

GET    /api/ai/status             → KI-Provider-Status + Verfügbarkeit
POST   /api/ai/chat               → KI-Chat (messages[], project_id?, issue_id?, wiki_slug?)

GET    /api/projects/<id>/python-scripts   → Scripts auflisten
POST   /api/projects/<id>/python-scripts   → Script anlegen
GET/PUT/DELETE /api/python-scripts/<id>    → Script verwalten
POST   /api/python-scripts/<id>/run        → Vollständig ausführen
POST   /api/python-scripts/<id>/run-cells  → Bis Zelle N ausführen (Developer Mode, body: {cell_index, cells[]})
GET    /api/python-scripts/<id>/runs       → Letzte 20 Runs

GET    /api/projects/<id>/ki-agents        → Agenten auflisten
POST   /api/projects/<id>/ki-agents        → Agent anlegen
GET/PUT/DELETE /api/ki-agents/<id>         → Agent verwalten
POST   /api/ki-agents/<id>/run             → Manuell starten
GET    /api/ki-agents/<id>/runs            → Letzte 20 Runs
GET    /api/ki-agents/<id>/files           → Workspace-Dateien auflisten
GET/DELETE /api/ki-agents/<id>/files/<fn>  → Datei herunterladen / löschen

GET    /api/admin/settings/ai           → KI-Konfiguration laden (API-Key maskiert als "***")
PUT    /api/admin/settings/ai           → KI-Konfiguration speichern
GET    /api/admin/settings/telegram     → Telegram-Bot-Konfiguration (Token maskiert)
PUT    /api/admin/settings/telegram     → Telegram-Bot-Konfiguration speichern
GET    /api/admin/settings/icloud       → iCloud-Konfiguration laden (App-Passwort maskiert)
PUT    /api/admin/settings/icloud       → iCloud-Konfiguration speichern
```

## Wichtige Dateipfade

```
main-api/
  app/
    models/          # SQLAlchemy-Models (inkl. WikiPage, WikiAttachment, PythonScript, KiAgent)
    routes/          # Flask-Blueprints
    services/
      python_script_service.py   # build_cell_code(), run_script(), run_script_with_code()
      python_script_scheduler.py # Daemon-Thread: prüft alle 30s auf fällige Scripts
      ki_agent_service.py        # run_agent() mit Aktions-Loop
      ki_agent_scheduler.py      # Daemon-Thread: prüft alle 30s auf fällige Agenten
      worklog_scheduler.py       # Daemon-Thread: prüft alle 60s auf abgelaufene Kalendereinträge → Auto-Worklog
      backup_scheduler.py        # Daemon-Thread: prüft stündlich ob automatisches Backup fällig ist
      axion_helper_template.py   # axion.py Template (wird in jeden Script-Subprocess injiziert)
    __init__.py      # create_app(), Blueprint-Registrierung
  migrations/        # Alembic-Migrationen
  instance/          # Laufzeit-Daten (DB, settings.env, uploads, python-scripts/, ki-agents/)
  run.py             # Startpunkt (legt default-Admin + default-Wiki-Seiten an)
  create_user.py     # CLI zum Nutzer anlegen

frontend/src/
  api/               # Axios-Wrapper pro Service
    client.js        # Axios-Basis (http://localhost:5050/api)
    wikiApi.js       # Knowledge: /api/knowledge/* (via main-api)
    aiApi.js         # KI: getStatus(), chat()
    pythonScriptsApi.js  # getAll(), create(), get(), update(), remove(), run(), runCells(), getRuns()
    kiAgentsApi.js   # getAll(), create(), get(), update(), remove(), run(), getRuns(), getFiles(), deleteFile()
    settingsApi.js   # Admin: getAiConfig(), saveAiConfig(), getIcloudConfig(), saveIcloudConfig()
    attachmentsApi.js# getList(), upload(), download(), previewUrl(), remove()
    searchApi.js     # search(q) → GET /search?q=...
  components/        # Wiederverwendbare Komponenten
    common/          # Layout, Navbar (mit Suchfeld ⌘K), Modal, PasswordModal, etc.
    kanban/          # KanbanBoard, KanbanColumn, KanbanCard
    calendar/        # CalendarView (FullCalendar)
    wiki/            # WikiTree, WikiEditor, WikiPage, KnowledgeGraph (Graph-Overlay), WikiPage, WikiEditor
    issues/          # IssueCard, IssueDetail, IssueForm (mit Vorlagen-Pills), etc.
    project/         # ActivityFeed, MilestoneList
    ai/              # AiChatPanel (festes rechtes Panel, z-50)
  pages/             # Seiten-Komponenten (eine pro Route)
    PythonScriptsPage.jsx    # Script-Editor mit Developer-Modus (Notebook-Zellen)
    KiAgentsPage.jsx         # Agent-Editor mit Runs + Workspace-Dateien
    UserSettingsPage.jsx     # Einstellungen für alle User + Admin-Sektionen (wenn is_admin)
  store/             # Zustand-Stores
    aiStore.js       # isOpen, messages, loading – toggle/open/close, addMessage
  utils/             # Hilfsfunktionen (statusColors, dateUtils, etc.)
```

## Konfiguration (settings.env)

Alle Einstellungen werden in `main-api/instance/settings.env` gespeichert (plain text, kein Neustart nötig).
Lesezugriff über `app/services/settings_env.py` → `read(key, default)`.
Schreibzugriff über `write(key, value)`.

Unterstützte Keys:
- `AI_PROVIDER`, `OLLAMA_URL`, `OLLAMA_MODEL`, `CLAUDE_API_KEY`, `CLAUDE_MODEL`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_DEFAULT_PROJECT_ID`, `TELEGRAM_NOTIFY_ON_CREATE`, `TELEGRAM_NOTIFY_ON_STATUS_CHANGE`, `TELEGRAM_NOTIFY_INTERVAL_MIN`
- `ICLOUD_USERNAME`, `ICLOUD_APP_PASSWORD`, `ICLOUD_CALENDAR_NAME`

## Sprache & UX

- **UI-Sprache**: Deutsch durchgängig (Labels, Fehlermeldungen, Bestätigungsdialoge)
- **Fehlermeldungen**: Inline (kein `alert()`), als rote Banner die nach 5s verschwinden
- **Optimistische Updates**: State sofort ändern, bei Fehler rollback + inline Meldung
- **Session-Auth**: `withCredentials: true` in Axios, Cookie-basiert

## Anhänge

- Dateien werden unter `main-api/instance/uploads/` mit UUID-Dateinamen gespeichert
- Originaldateiname + MIME-Type in DB gespeichert (`Attachment`-Model)
- **Download** (`/download`): `Content-Disposition: attachment` → Browser speichert die Datei
- **Vorschau** (`/preview`): `Content-Disposition: inline` → Browser rendert Bild/PDF direkt
- Frontend: `attachmentsApi.previewUrl(id)` gibt absolute URL zurück (kein Axios, direkt in `src`/`href`)
- Im `IssueDetail`: Bilder zeigen 56×56px-Thumbnail inline; PDFs haben aufklappbaren iframe (h-48)
- Max. Dateigröße: 16 MB (`MAX_CONTENT_LENGTH` in `__init__.py`)

## Volltextsuche

- `GET /api/search?q=<query>` – sucht in Issue-Titeln, Beschreibungen und Kommentaren (min. 2 Zeichen)
- Wiki-Suchergebnisse kommen von `GET /api/wiki/search?q=...` (in main-api) und werden im Frontend zusammengeführt
- Navbar-Suchfeld hat `⌘K`-Shortcut; Dropdown schließt bei Klick außerhalb

## Issue-Vorlagen (Templates)

- In `IssueForm` (nur bei neuen Issues) – Vorlagen-Pills: **Bug**, **Feature**, **Task**
- Klick befüllt `type`, `priority`, `title`-Prefix und `description` vor
- Vorlagen sind hardcoded in `IssueForm.jsx` (kein Backend-Endpoint)

## Markdown

- `react-markdown` rendert Beschreibungen und Kommentare in `IssueDetail`
- Tailwind Typography (`prose prose-sm`) sorgt für korrekte Formatierung
- IssueForm-Beschreibungsfeld bleibt Plain-Text (kein Editor); Markdown wird nur beim Lesen gerendert

## KI-Assistent

- **Aufruf**: 🤖-Button in der Navbar öffnet `AiChatPanel` (festes rechtes Panel, 400px)
- **Provider**: Ollama (lokal) oder Claude API – konfigurierbar unter `/settings` (Admin)
- **Konfiguration**: `main-api/instance/settings.env` – wird bei jeder Anfrage geladen (kein Neustart nötig)
  - `load_ai_config()` in `app/routes/settings.py` – von `ai.py` importiert
- **Kontext**: `useParams()` in `AiChatPanel` erkennt aktuellen `projectId`/`issueId`/`wikiSlug` und schickt ihn mit; enthält auch Python Scripts und KI-Agenten des Projekts
- **Aktionen (Chat)**: `update_issue`, `add_comment`, `create_issue`, `create_wiki_page`, `update_wiki_page`, `add_worklog`, `create_milestone`, `update_milestone`, `set_assignee`, `set_due_date`, `add_tag`, `remove_tag`, `create_tag`, `create_subtask`, `assign_milestone`, `set_dependency`, `search_issues`, `read_wiki_page`, `search_wiki`, `list_wiki_pages`, `list_projects`, `create_python_script`, `run_python_script`, `create_ki_agent`, `run_ki_agent`
- **Aktionen (Agenten)**: Alle Chat-Aktionen + `create_file` (Workspace-Datei), `trigger_agent` (Agenten-Kette)
- **JSON-Format**: KI-Antworten sind strukturiertes JSON `{reply, action?: {type, ...}}` – Fallback wenn kein JSON
- **Zweistufige Read-Aktionen**: `read_wiki_page`, `search_wiki`, `search_issues`, `list_projects`, `list_wiki_pages` → erst Daten holen, dann KI erneut aufrufen mit Daten als Kontext
- **Multi-Aktions-Loop**: KI kann bis zu 4 Folgeaktionen ohne Nutzereingabe ausführen (z.B. Story + Subtasks)
- **Chat-History**: Letzte 10 Nachrichten werden mitgeschickt
- **Status-Badge**: Grüner/roter Punkt in Panel-Header zeigt ob Provider erreichbar ist

## Python Scripts

- **Modell** (`PythonScript`): `name`, `code`, `cells` (JSON-Array, null=Einfach-Modus), `schedule_type` (manual/interval), `interval_min`, `schedule_days` (JSON-Array [0..6] Mo=0 So=6, null=täglich), `timeout_sec`, `is_active`, `next_run_at`, `last_run_at`
- **Modell** (`PythonScriptRun`): `stdout`, `stderr`, `exit_code`, `error`, `triggered_by` (manual/scheduler/cell/ki), `variables` (JSON-Dict der Variablen-Diff)
- **Developer-Modus**: `cells`-Feld != null → Notebook-Ansicht in `PythonScriptsPage.jsx`
  - Zelle N ausführen: `build_cell_code(cells, cell_index)` baut Script mit stdout-Unterdrückung für Vorzellen + Snapshot/Diff-Injektion
  - `__AXION_VARS__:{...}` Marker in stderr → Backend parst und speichert als `run.variables`, entfernt aus stderr
- **Scheduler**: `python_script_scheduler.py` – Daemon-Thread, alle 30s, prüft `schedule_type='interval'` + `next_run_at <= now` + Wochentag in `schedule_days` (null = täglich)
- **Workspace**: `instance/python-scripts/<project_id>/` – persistente Dateien

## axion Python Library

In jedem Script-Subprocess wird `axion.py` über `PYTHONPATH` bereitgestellt (Token-Authentifizierung gegen `/api/internal/script/*`):

```python
import axion

# Projekte
project = axion.get_project()             # → dict mit id, name, key, description (eigenes Projekt)
axion.get_project(project_id=2)           # anderes Projekt per ID
projects = axion.list_projects()          # → alle Projekte der Instanz

# Issues
issues = axion.get_issues(status='open', type='bug')  # Liste aller Issues (gefiltert)
axion.create_issue(title, description='', type='task', priority='medium')
axion.update_issue(issue_id, status='done', priority='high', title='...', description='...')
axion.add_comment(issue_id, content)

# Wiki
page = axion.get_wiki_page(slug)           # → dict mit title, content
axion.create_wiki_page(title, content, slug=None)
axion.update_wiki_page(slug, content, title=None)

# Workspace-Dateien (eigener Script-Workspace)
axion.write_file(filename, content)        # .md/.txt/.csv
axion.list_my_files()                      # → [{'filename': ..., 'size': ...}]
axion.read_my_file(filename)               # → str

# Agent-Workspaces lesen (nur lesen)
axion.list_agent_workspaces()              # → [{'name': ..., 'files': [...]}]
axion.read_workspace_file(workspace_name, filename)  # → str

# Telegram (Nachricht in Queue einreihen → gesammelt nach Intervall gesendet)
axion.notify_telegram(message)             # → {'ok': True}
```

Alle Funktionen werfen `requests.HTTPError` bei Fehler.
Interne Endpunkte (Token: `X-Script-Token`):
- `POST /api/internal/script/notify` – Telegram-Nachricht in Queue einreihen
- `GET /api/internal/script/projects` – alle Projekte
- `GET /api/internal/script/projects/<id>` – einzelnes Projekt

## Ki Agents

- **Modell** (`KiAgent`): `name`, `prompt`, `api_provider` (global/ollama/claude), `api_url`, `api_model`, `api_key`, `schedule_type`, `interval_min`, `schedule_days` (JSON-Array [0..6] Mo=0 So=6, null=täglich), `website_url`, `is_active`, `dry_run`, `notify_telegram`, `retry_on_error`, `retry_max`, `retry_delay_min`, `workspace` (letzter Output-Text), `last_run_at`, `next_run_at`
- **Modell** (`KiAgentRun`): `output`, `actions_log` (JSON-Liste), `error`, `triggered_by` (manual/scheduler/chain/ki/retry)
- **Aktionsschleife**: Agent führt bis zu 5 Aktionen pro Run aus, prüft Issue-Änderungen nach jeder Aktion
- **Workspace**: `instance/ki-agents/<agent_id>/` – Agent kann `.md`/`.txt`/`.csv` Dateien schreiben
- **Website-Zugriff**: `website_url` → Content wird beim Run abgerufen und als Kontext mitgegeben
- **Agenten-Kette**: `trigger_agent` → anderer Agent startet asynchron (kein Selbst-Triggering)
- **Scheduler**: `ki_agent_scheduler.py` – Daemon-Thread, alle 30s, analog zu `python_script_scheduler.py` (inkl. `schedule_days`-Check)

## Telegram Bot

- **Service**: `main-api/app/services/telegram_bot.py` – läuft als Daemon-Thread beim Start
- **Konfiguration**: `main-api/instance/settings.env` – Token + Chat-ID via `/settings` (Admin) konfigurierbar
- **Befehle**: `/issue`, `/bug`, `/issues`, `/done`, `/status`, `/suche`, `/ki`, `/hilfe`
- **Plain-Text → KI**: Nachrichten ohne `/` werden direkt an den KI-Assistenten weitergeleitet
- **Push-Notifications**: `tg.notify()` nach Issue-Erstellung, Status-Wechsel und Agent-Completion (konfigurierbar)
- **Batched Notifications**: `notify()` reiht Nachrichten in `_notify_queue` ein; Flush-Thread sendet alle N Minuten gebündelt als eine Nachricht. Bei `TELEGRAM_NOTIFY_INTERVAL_MIN=0` wird sofort gesendet.
- **Python-Script-Integration**: `axion.notify_telegram(message)` → `POST /api/internal/script/notify` → `tg.notify()`
- **Auth**: Nur die konfigurierte `chat_id` wird akzeptiert

## Issue-Modell: wichtige Felder

- `closed_at` (DateTime, nullable): wird bei Status-Wechsel auf `done`/`cancelled` gesetzt; wird gecleart wenn wieder geöffnet
- `assignee_id`: bei Issue-Erstellung automatisch auf `current_user.id` gesetzt, wenn kein Wert übergeben wird
- Kanban blendet `done`/`cancelled`-Issues automatisch aus, wenn `closed_at` älter als 2 Tage ist

## Release-Prozess

Bei **jedem Commit mit nutzbaren Änderungen** sind diese drei Schritte Pflicht:

### 1. Versionsnummer erhöhen
Die Versionsnummer liegt in `frontend/src/utils/version.js`:
```js
export const APP_VERSION = '1.0.0'
```
Schema: `MAJOR.MINOR.PATCH`
- **PATCH** (+0.0.1): Bugfixes, kleine Anpassungen, Styling
- **MINOR** (+0.1.0): Neue Features, sichtbare Funktionserweiterungen
- **MAJOR** (+1.0.0): Grundlegende Umbauten, Breaking Changes

### 2. Docker-Image bauen und pushen
Das Image muss **immer multi-arch** gebaut werden – ein einziger Push deckt beide Ziele ab:
- `linux/amd64` → Linux-Server (Unraid, x86)
- `linux/arm64` → macOS M3/M4 (Apple Silicon, läuft nativ in Docker Desktop) + ARM-Linux

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t basti97420/axion:latest --push .
```

> **Warum ein Build reicht**: Docker Hub speichert beide Architekturen unter demselben Tag.
> Auf dem Mac (M3) zieht `docker pull` automatisch das `arm64`-Image; auf Unraid (x86) das `amd64`-Image.

Danach lokalen Container neu starten:
```bash
docker pull basti97420/axion:latest
docker stop axionv2 && docker rm axionv2
docker run -d --name axionv2 -p 65443:80 \
  -v axion_data:/app/instance \
  --restart unless-stopped \
  basti97420/axion:latest
```

### 3. Unraid-Template (`axion-unraid.xml`) prüfen
Falls sich geändert hat:
- Standard-Port (aktuell 7800)
- Neue Volume-Mounts oder Umgebungsvariablen
- `<ExtraParams>` (aktuell: `--add-host=host.docker.internal:host-gateway`, nötig auf Linux)
- Standard-Modellname (`claude_model` o.ä.)

→ `axion-unraid.xml` entsprechend anpassen, damit Unraid-Nutzer beim Neuinstallieren korrekte Defaults bekommen.

---

## Bekannte Eigenheiten

- **Zwei Drag-Systeme**: FullCalendar-Drag (für Kalender-Einträge) und HTML5-native-Drag (für Milestone-Drop) können auf der gleichen Seite koexistieren; `nativeDraggable` Prop auf IssueCard steuert welches aktiv ist
- **iCloud-Sync**: Graceful Degradation – iCloud-Fehler brechen lokale Funktionen nicht ab
- **Wiki in main-api**: Wiki-Routen unter `/api/knowledge/*` direkt in main-api (`app/routes/wiki.py (URL-Prefix: /api/knowledge)`, `app/routes/wiki_attachments.py`). Modelle: `WikiPage`, `WikiAttachment` in `app/models/`. Frontend: `wikiApi.js` mit `withCredentials: true`
- **Kalender-Sync in main-api**: `/api/calendar/*` via `app/routes/calendar_sync.py`, Services `icloud_client.py` + `event_mapper.py` in `app/services/`
- **Kanban DnD**: Verwendet ausschließlich `useDraggable` + `useDroppable` aus `@dnd-kit/core` — kein `SortableContext`/`useSortable`, da cross-column Drag damit fehlschlägt. `DragOverlay` rendert inline-div (kein `KanbanCard`), um doppelte ID-Registrierung zu vermeiden.
- **IssueDetail Tab-Layout**: Alle Tab-Inhalte (activity, comments, worklog, attachments) müssen im `max-w-3xl mx-auto p-6`-Container liegen — der schließende `</div>` kommt erst nach dem letzten Tab-Block, nicht nach comments.
- **Auto-Worklog-Scheduler**: `worklog_scheduler.py` – Daemon-Thread, alle 60s. Prüft abgelaufene `CalendarEntry`-Einträge mit `issue_id != NULL`. Legt automatisch einen `Worklog`-Eintrag an (`user_id=null`, `calendar_entry_id` gesetzt zur Idempotenz). `CalendarEntry.to_dict()` enthält `worklog_logged: bool` für das Frontend.
- **Backup-Scheduler**: `backup_scheduler.py` – Daemon-Thread, stündliche Prüfung. Liest `BACKUP_ENABLED`, `BACKUP_INTERVAL_DAYS`, `BACKUP_LAST_RUN` aus `settings.env`. Speichert ZIPs in `instance/backups/`, hält max. `BACKUP_MAX_KEEP` Dateien. Admin-Endpunkte: `GET/PUT /api/admin/settings/backup`, `GET /api/admin/backups`, `POST /api/admin/backups/run`, `GET/DELETE /api/admin/backups/<filename>`.
