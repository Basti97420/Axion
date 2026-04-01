# Axion

Self-hosted project management with Issue-Tracking (Kanban), iCloud Calendar sync, Worklog/time tracking, and a hierarchical Markdown Wiki.

## Architecture

Alle Services laufen in **einem einzigen Container**:

| Komponente        | Beschreibung                                          |
|-------------------|-------------------------------------------------------|
| `main-api`        | Flask: Issues, Projekte, Wiki, Kalender, Auth, KI     |
| `nginx`           | Reverse Proxy + statisches Frontend                   |
| `frontend`        | React + Vite + Tailwind (im Image gebaut)             |

Wiki und iCloud-Kalender sind direkt in `main-api` integriert — kein separater Service nötig.

## Docker Hub – Schnellstart (empfohlen)

```bash
# Container starten (Daten landen in ./data/main/)
docker compose up -d
```

Danach unter **http://localhost** erreichbar.
Standard-Login: `admin` / `admin` (nach dem ersten Login ändern).

Alle Daten liegen in **einem Ordner** neben der `docker-compose.yml`:
- `data/main/` – Datenbank, Wiki-Uploads, KI-Config, Telegram-Config, Secret Key

### Optionale Konfiguration (`.env`)

Für iCloud-Kalender, eigene Ollama-URL oder Claude API Key eine `.env` anlegen:

```env
# iCloud Kalender (optional)
ICLOUD_USERNAME=deine@email.com
ICLOUD_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
ICLOUD_CALENDAR_NAME=Axion

# KI-Assistent (Standard: ollama)
AI_PROVIDER=ollama
OLLAMA_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.2
# CLAUDE_API_KEY=sk-ant-...
```

```bash
docker run -d --name axion -p 80:80 \
  --env-file .env \
  -v $(pwd)/data/main:/app/main-api/instance \
  basti97420/axion:latest
```

Oder mit `docker compose up -d` (nutzt die enthaltene `docker-compose.yml`).

### Updates

```bash
# Neues Image bauen und pushen (nach Code-Änderungen)
docker build -t basti97420/axion:latest .
docker push basti97420/axion:latest

# Auf dem Server: neues Image laden und Container neu starten
docker compose pull
docker compose up -d
```

### Updates einspielen

```bash
# 1. Neues Image von Docker Hub holen
docker pull basti97420/axion:latest

# 2. Container neu starten (Daten bleiben erhalten)
docker compose down
docker compose up -d
```

Alle Daten (Datenbanken, hochgeladene Dateien) bleiben in den Volumes erhalten – der Container selbst enthält keine Nutzerdaten.

### Selbst bauen & pushen (nach Code-Änderungen)

```bash
# Image neu bauen (aus lokalen Dateien, kein GitHub nötig)
docker build -t basti97420/axion:latest .

# Auf Docker Hub hochladen
docker push basti97420/axion:latest

# Laufenden Container updaten
docker compose down && docker compose up -d
```

---

## Lokale Entwicklung

### 1. Prerequisites

- Python 3.9+
- Node.js 18+
- pip + venv

### 2. Set up virtual environments

```bash
cd main-api && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && deactivate
cd ../frontend && npm install
```

### 3. Initialize database

```bash
cd main-api && source venv/bin/activate && flask db upgrade && deactivate
```

### 4. Create first user

```bash
cd main-api && source venv/bin/activate && python create_user.py
```

### 5. Start everything

```bash
# Backend
cd main-api && source venv/bin/activate && python run.py

# Frontend (separate terminal)
cd frontend && npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

iCloud, KI und Telegram werden über `/settings` (Admin) konfiguriert – kein Neustart nötig.

## Features

- **Issue Tracking**: Kanban board, priorities, status workflow, tags, subtasks
- **Worklog**: Timer + manual entry per issue, daily workload summary in calendar; calendar entries linked to issues are automatically logged as worklogs when they expire
- **iCloud Calendar**: Sync events, create appointments from issues, view alongside deadlines
- **Wiki**: Hierarchical pages with Markdown editor, `[[WikiLink]]` syntax, file attachments
- **Global Search**: `Cmd+K` searches Issues, Comments, and Wiki pages in parallel
- **Python Scripts**: Automated scripts with scheduler (interval + weekday filter), Developer Mode (notebook cells), `axion` library (Issues, Wiki, Projects, Workspace, Telegram)
- **Ki Agents**: Autonomous AI agents with actions, scheduling (interval + weekday filter), website monitoring, and file workspace
- **AI Assistant**: Chat-based project management — create issues, manage wiki, run scripts and agents via natural language
- **Backup**: Download full ZIP (JSON + attachments) via the `💾 Backup` button

## API Reference

### Main-API (Port 5050)

#### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| PATCH | `/api/auth/password` | Change password |
| GET | `/api/auth/setup-info` | First-run check |

#### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET/PUT/DELETE | `/api/projects/<id>` | Get / update / delete |
| GET | `/api/projects/<id>/issues` | Project issues |
| GET | `/api/projects/<id>/log` | Activity log |
| GET | `/api/projects/<id>/milestones` | Milestones |
| POST | `/api/projects/<id>/milestones` | Create milestone |
| GET | `/api/projects/<id>/calendar-entries` | Calendar entries |

#### Issues
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/issues` | List (filters: project_id, status, priority, type, assignee_id) |
| POST | `/api/issues` | Create (assignee defaults to creator) |
| GET/PUT/DELETE | `/api/issues/<id>` | Get / update / delete |
| PATCH | `/api/issues/<id>/status` | Change status |
| PATCH | `/api/issues/<id>/priority` | Change priority |
| PATCH | `/api/issues/<id>/due_date` | Set due date |
| GET | `/api/issues/<id>/subtasks` | List subtasks |
| GET | `/api/issues/<id>/activity` | Activity log |
| POST | `/api/issues/<id>/activity/<aid>/revert` | Revert change (admin only) |
| GET/POST | `/api/issues/<id>/comments` | List / add comment |
| DELETE | `/api/issues/<id>/comments/<cid>` | Delete comment |
| GET/POST | `/api/issues/<id>/dependencies` | Get / add dependency |
| DELETE | `/api/issues/<id>/dependencies/<tid>` | Remove dependency |
| GET/POST | `/api/issues/<id>/attachments` | List / upload attachment |
| GET/POST | `/api/issues/<id>/worklogs` | List / add worklog |

#### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attachments/<id>/download` | Download file |
| GET | `/api/attachments/<id>/preview` | Preview inline |
| DELETE | `/api/attachments/<id>` | Delete attachment |
| GET/PUT/DELETE | `/api/milestones/<id>` | Milestone detail / update / delete |
| GET/PUT/DELETE | `/api/worklogs/<id>` | Worklog update / delete |
| GET | `/api/worklog/summary` | Daily summary (start/end filters) |
| GET/POST/PUT/DELETE | `/api/tags` | Tag CRUD |
| POST | `/api/tags/issues/<id>/tags` | Add tag to issue |
| DELETE | `/api/tags/issues/<id>/tags/<tid>` | Remove tag from issue |
| GET/POST/PUT/DELETE | `/api/calendar-entries` | Calendar entry CRUD |
| GET | `/api/search?q=` | Full-text search (issues + comments, min 2 chars) |
| GET | `/api/backup` | Download full backup ZIP |
| GET/PUT | `/api/user/settings` | User settings |
| GET | `/api/ai/status` | AI provider status |
| POST | `/api/ai/chat` | AI chat (message, context, history) |

#### Admin (admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/admin/users` | List / create users |
| GET/PUT/DELETE | `/api/admin/users/<id>` | User detail / update / delete |
| GET/PUT | `/api/admin/settings/ai` | AI config (API key masked) |
| GET/PUT | `/api/admin/settings/telegram` | Telegram bot config |

#### Python Scripts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/projects/<id>/python-scripts` | List / create scripts |
| GET/PUT/DELETE | `/api/python-scripts/<id>` | Get / update / delete |
| POST | `/api/python-scripts/<id>/run` | Run full script |
| POST | `/api/python-scripts/<id>/run-cells` | Run up to cell N (Developer Mode) |
| GET | `/api/python-scripts/<id>/runs` | Last 20 run results |
| GET | `/api/internal/script/projects` | axion: list projects (token auth) |
| GET | `/api/internal/script/projects/<id>` | axion: get project info (token auth) |

#### Ki Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/projects/<id>/ki-agents` | List / create agents |
| GET/PUT/DELETE | `/api/ki-agents/<id>` | Get / update / delete |
| POST | `/api/ki-agents/<id>/run` | Trigger manual run |
| GET | `/api/ki-agents/<id>/runs` | Last 20 run results |
| GET | `/api/ki-agents/<id>/files` | List workspace files |
| GET/DELETE | `/api/ki-agents/<id>/files/<filename>` | Download / delete file |

#### Wiki (in main-api)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/wiki/pages` | List / create pages |
| GET/PUT/DELETE | `/api/wiki/pages/<slug>` | Page detail / update / delete |
| GET | `/api/wiki/pages/<slug>/children` | Child pages |
| GET | `/api/wiki/search?q=` | Search wiki |
| GET | `/api/wiki/render` | Preview markdown |
| POST | `/api/wiki/pages/<slug>/attachments` | Upload attachment |
| GET/DELETE | `/api/wiki/attachments/<id>` | Get / delete attachment |

#### iCloud Kalender (in main-api)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calendar/events` | List events (start/end filters) |
| POST | `/api/calendar/events` | Create event (syncs to iCloud) |
| DELETE | `/api/calendar/events/<uid>` | Delete event |
| GET | `/api/calendar/status` | iCloud connection status |

#### Admin Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/admin/settings/ai` | KI-Konfiguration (API-Key maskiert) |
| GET/PUT | `/api/admin/settings/telegram` | Telegram Bot (Token maskiert) |
| GET/PUT | `/api/admin/settings/icloud` | iCloud-Konfiguration (Passwort maskiert) |

---

## Konfiguration

Alle Einstellungen werden in `data/main/settings.env` gespeichert und über `/settings` (Admin) verwaltet — kein Container-Neustart nötig.

Alternativ als Umgebungsvariablen beim Start übergeben:

```env
# KI-Assistent
AI_PROVIDER=ollama
OLLAMA_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.2
# CLAUDE_API_KEY=sk-ant-...
# CLAUDE_MODEL=claude-sonnet-4-6

# iCloud Kalender (optional)
ICLOUD_USERNAME=deine@email.com
ICLOUD_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
ICLOUD_CALENDAR_NAME=Axion

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_NOTIFY_INTERVAL_MIN=5       # 0 = sofort senden, >0 = gesammelt alle N Minuten
```
