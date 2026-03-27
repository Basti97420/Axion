from app import create_app, db
from app.models.user import User

app = create_app()

_AXION_LIBRARY_CONTENT = """\
# Axion Python Library

Die `axion`-Library steht in jedem Python-Script automatisch zur Verfügung. Sie bietet direkten Zugriff auf das Projekt.

## Verwendung

```python
import axion
```

---

## Issues

### `axion.get_issues(status=None, type=None)`
Gibt alle Issues des Projekts zurück (optional gefiltert).

```python
issues = axion.get_issues()
open_bugs = axion.get_issues(status='open', type='bug')
for iss in issues:
    print(f"#{iss['id']} [{iss['status']}] {iss['title']}")
```

**Rückgabe**: Liste von Dicts mit `id`, `title`, `status`, `priority`, `type`, `description`

---

### `axion.create_issue(title, description='', type='task', priority='medium')`
Erstellt ein neues Issue im Projekt.

```python
iss = axion.create_issue(
    title='Neuer Bug gefunden',
    description='Beschreibung des Problems',
    type='bug',
    priority='high'
)
print(iss['id'])
```

**Typen**: `task`, `bug`, `story`, `epic`
**Prioritäten**: `low`, `medium`, `high`, `critical`

---

### `axion.update_issue(issue_id, **kwargs)`
Aktualisiert ein bestehendes Issue.

```python
axion.update_issue(42, status='done')
axion.update_issue(42, priority='critical', title='Neuer Titel')
```

**Felder**: `status`, `priority`, `title`, `description`
**Status-Werte**: `open`, `in_progress`, `in_review`, `done`, `cancelled`

---

### `axion.add_comment(issue_id, content)`
Fügt einen Kommentar zu einem Issue hinzu.

```python
axion.add_comment(42, 'Automatischer Kommentar: Überprüfung abgeschlossen.')
```

---

## Projekte

### `axion.get_project(project_id=None)`
Gibt Projektinformationen zurück. Ohne Argument = eigenes Projekt des Scripts.

```python
project = axion.get_project()
print(project['name'], project['key'])

# Anderes Projekt per ID abrufen
other = axion.get_project(project_id=2)
```

**Rückgabe**: Dict mit `id`, `name`, `key`, `description`

---

### `axion.list_projects()`
Gibt alle Projekte der Axion-Instanz zurück.

```python
projects = axion.list_projects()
for p in projects:
    print(f"[{p['key']}] {p['name']}")
```

---

## Wiki

### `axion.get_wiki_page(slug)`
Liest eine Wiki-Seite.

```python
page = axion.get_wiki_page('projekt-dokumentation')
print(page['title'])
print(page['content'])
```

---

### `axion.create_wiki_page(title, content, slug=None)`
Erstellt eine neue Wiki-Seite (Slug wird auto-generiert wenn nicht angegeben).

```python
axion.create_wiki_page(
    title='Wochenbericht KW 15',
    content='## Zusammenfassung\\n...',
)
```

---

### `axion.update_wiki_page(slug, content, title=None)`
Aktualisiert eine bestehende Wiki-Seite.

```python
axion.update_wiki_page('wochenbericht-kw-15', content='# Aktualisierter Inhalt')
```

---

## Workspace-Dateien

### `axion.write_file(filename, content)`
Schreibt eine Datei in den eigenen Script-Workspace (`.md`, `.txt`, `.csv`).

```python
axion.write_file('report.md', '# Bericht\\nErgebnis: ...')
```

---

### `axion.list_my_files()`
Listet alle Dateien im eigenen Workspace auf.

```python
files = axion.list_my_files()
for f in files:
    print(f['filename'], f['size'])
```

---

### `axion.read_my_file(filename)`
Liest eine Datei aus dem eigenen Workspace.

```python
content = axion.read_my_file('report.md')
```

---

### `axion.list_agent_workspaces()`
Listet alle Agent-Workspace-Verzeichnisse und deren Dateien auf.

```python
workspaces = axion.list_agent_workspaces()
for ws in workspaces:
    print(ws['name'], ws['files'])
```

---

### `axion.read_workspace_file(workspace_name, filename)`
Liest eine Datei aus einem Agent-Workspace.

```python
content = axion.read_workspace_file('wochenbericht-agent', 'report.md')
```

---

## Telegram

### `axion.notify_telegram(message)`
Sendet eine Telegram-Benachrichtigung. Die Nachricht wird in die Queue eingereiht und zusammen mit anderen Benachrichtigungen nach dem konfigurierten Intervall gesendet (Standard: 5 Minuten). Bei Intervall = 0 wird sofort gesendet.

```python
axion.notify_telegram('Skript abgeschlossen: 42 Issues geprüft.')
axion.notify_telegram(f'Neuer Bug gefunden: #{issue["id"]} – {issue["title"]}')
```

---

## Verfügbare Pakete

Neben `axion` stehen in jedem Script vorinstalliert zur Verfügung:

| Paket | Verwendung |
|-------|-----------|
| `requests` | HTTP-Anfragen |
| `beautifulsoup4` | HTML/XML-Parsing (`from bs4 import BeautifulSoup`) |
| `lxml` | Schneller XML/HTML-Parser (BS4-Backend: `BeautifulSoup(html, 'lxml')`) |
| `matplotlib` | Diagramme & Plots — headless: `matplotlib.use('Agg')` vor pyplot |
| `numpy` | Numerische Berechnungen, Arrays |
| `scipy` | Wissenschaftliche Berechnungen, Statistik |
| `scikit-learn` | Machine Learning |
| `json`, `os`, `sys`, `datetime`, `re`, `math` | Python-Stdlib |

**Hinweis matplotlib** (kein Display im Container):
```python
import matplotlib
matplotlib.use('Agg')           # VOR pyplot-Import setzen
import matplotlib.pyplot as plt
plt.savefig('output.png')       # als Datei speichern statt anzeigen
```
"""

_KI_AGENTS_CONTENT = """\
# Ki Agenten – Aktionen & Konfiguration

Ki Agenten sind autonome KI-Programme, die Aufgaben selbstständig ausführen, Issues verwalten, Wiki-Seiten schreiben und andere Agenten starten können.

## Konfigurationsoptionen

| Feld | Beschreibung |
|------|-------------|
| **Name** | Eindeutiger Name des Agenten |
| **Prompt** | Aufgabenbeschreibung – was soll der Agent tun? |
| **KI-Provider** | `global` (Standard), `ollama` (eigene URL), `claude` (eigener Key) |
| **Häufigkeit** | `manual` oder `interval` (alle X Minuten) |
| **Website URL** | Optionale URL – Inhalt wird beim Run abgerufen und als Kontext mitgegeben |
| **Dry-Run** | Aktionen werden simuliert aber nicht ausgeführt |
| **Telegram** | Benachrichtigung nach jedem Run |
| **Retry** | Automatischer Neuversuch bei Fehler (max. X mal, alle Y Minuten) |

---

## Verfügbare Aktionen

Der Agent gibt seine Aktionen als JSON zurück. Er kann bis zu 5 Aktionen pro Run ausführen.

### Issue-Verwaltung

```json
{"type": "update_issue", "issue_id": 5, "data": {"status": "done"}}
{"type": "add_comment", "issue_id": 5, "data": {"content": "Kommentar"}}
{"type": "create_issue", "data": {"title": "Titel", "type": "bug", "priority": "high", "description": "..."}}
{"type": "create_subtask", "issue_id": 5, "data": {"title": "Unteraufgabe"}}
{"type": "set_assignee", "issue_id": 5, "data": {"assignee_id": 1}}
{"type": "set_due_date", "issue_id": 5, "data": {"due_date": "2026-05-01"}}
{"type": "add_tag", "issue_id": 5, "data": {"tag_id": 3}}
{"type": "remove_tag", "issue_id": 5, "data": {"tag_id": 3}}
{"type": "add_worklog", "issue_id": 5, "data": {"hours": 2.5, "description": "Bugfix"}}
{"type": "assign_milestone", "issue_id": 5, "data": {"milestone_id": 2}}
{"type": "set_dependency", "issue_id": 5, "data": {"blocks_issue_id": 7}}
```

### Suche & Lesen

```json
{"type": "search_issues", "data": {"query": "login", "status": "open"}}
{"type": "read_wiki_page", "data": {"slug": "seitenname"}}
{"type": "search_wiki", "data": {"query": "suchbegriff"}}
{"type": "list_wiki_pages"}
```

### Wiki & Meilensteine

```json
{"type": "create_wiki_page", "data": {"title": "Titel", "content": "Markdown-Inhalt"}}
{"type": "update_wiki_page", "data": {"slug": "seitenname", "content": "Neuer Inhalt"}}
{"type": "create_milestone", "data": {"name": "v1.0", "due_date": "2026-06-01"}}
{"type": "update_milestone", "data": {"milestone_id": 2, "name": "v2.0"}}
```

### Workspace-Dateien

```json
{"type": "create_file", "data": {"filename": "report.md", "content": "# Bericht\\n..."}}
```

Erlaubte Dateitypen: `.md`, `.txt`, `.csv`

### Agenten-Kette

```json
{"type": "trigger_agent", "data": {"agent_id": 3}}
{"type": "trigger_agent", "data": {"agent_name": "Wochenbericht"}}
```

Ein Agent darf sich **nicht selbst** triggern.

---

## Beispiel-Prompts

### Wochenbericht
```
Erstelle einen Wochenbericht für dieses Projekt. Fasse alle offenen und diese Woche
geschlossenen Issues zusammen. Beschreibe Fortschritt und Risiken. Speichere das
Ergebnis als Markdown-Datei im Workspace und erstelle eine Wiki-Seite dafür.
```

### Bug-Tracker
```
Prüfe alle offenen Bug-Issues. Für jeden Bug, der seit mehr als 7 Tagen keinen
Kommentar erhalten hat, füge einen Kommentar hinzu: "Automatische Erinnerung:
Dieses Issue wartet seit über 7 Tagen auf Bearbeitung."
```

### Website-Monitor
```
Vergleiche den aktuellen Website-Inhalt mit dem letzten Workspace-Inhalt.
Bei relevanten Änderungen: erstelle ein Issue "Website-Änderung erkannt".
Speichere den aktuellen Inhalt dann als neue Baseline in report.md.
```

---

## Kontext des Agenten

Beim Run erhält der Agent automatisch:
- Alle Issues des Projekts (ID, Titel, Status, Priorität)
- Alle Tags und Meilensteine
- Alle verfügbaren Nutzer (für Zuweisung)
- Website-Inhalt (wenn `website_url` konfiguriert)
- Eigene Workspace-Dateien aus vorherigen Runs
"""


_API_REFERENCE_CONTENT = """\
# Axion API-Referenz

Alle Endpunkte erfordern eine aktive Session (Cookie-Auth via `POST /api/auth/login`).
Admin-Endpunkte zusätzlich `is_admin=true`.

## Authentifizierung

| Methode | Endpunkt | Beschreibung |
|---------|----------|-------------|
| POST | `/api/auth/login` | Anmelden (`username`, `password`) |
| POST | `/api/auth/logout` | Abmelden |
| GET | `/api/auth/me` | Aktuelle Session-Info |

## Projekte

| Methode | Endpunkt | Beschreibung |
|---------|----------|-------------|
| GET | `/api/projects` | Alle Projekte auflisten |
| POST | `/api/projects` | Neues Projekt anlegen |
| GET | `/api/projects/<id>` | Projekt-Detail |
| PUT | `/api/projects/<id>` | Projekt aktualisieren |
| DELETE | `/api/projects/<id>` | Projekt löschen |

## Issues

| Methode | Endpunkt | Beschreibung |
|---------|----------|-------------|
| GET | `/api/projects/<id>/issues` | Issues auflisten |
| POST | `/api/projects/<id>/issues` | Issue erstellen |
| GET | `/api/issues/<id>` | Issue-Detail |
| PUT | `/api/issues/<id>` | Issue aktualisieren |
| DELETE | `/api/issues/<id>` | Issue löschen |
| PATCH | `/api/issues/<id>/status` | Status ändern (Kanban) |
| PATCH | `/api/issues/<id>/due_date` | Fälligkeitsdatum setzen |
| POST | `/api/issues/<id>/attachments` | Datei anhängen |
| GET | `/api/issues/<id>/attachments` | Anhänge auflisten |
| GET | `/api/attachments/<id>/download` | Anhang herunterladen |
| GET | `/api/attachments/<id>/preview` | Anhang vorschauen |
| DELETE | `/api/attachments/<id>` | Anhang löschen |

## Wiki

| Methode | Endpunkt | Beschreibung |
|---------|----------|-------------|
| GET | `/api/wiki/pages` | Alle Wiki-Seiten |
| POST | `/api/wiki/pages` | Neue Seite erstellen |
| GET | `/api/wiki/pages/<slug>` | Seite lesen |
| PUT | `/api/wiki/pages/<slug>` | Seite aktualisieren |
| DELETE | `/api/wiki/pages/<slug>` | Seite löschen |
| GET | `/api/wiki/search?q=<query>` | Wiki durchsuchen |

## KI-Assistent

| Methode | Endpunkt | Beschreibung |
|---------|----------|-------------|
| GET | `/api/ai/status` | Provider-Status prüfen |
| POST | `/api/ai/chat` | Chat-Nachricht senden |

## Python Scripts

| Methode | Endpunkt | Beschreibung |
|---------|----------|-------------|
| GET | `/api/projects/<id>/python-scripts` | Scripts auflisten |
| POST | `/api/projects/<id>/python-scripts` | Script anlegen |
| GET | `/api/python-scripts/<id>` | Script-Detail |
| PUT | `/api/python-scripts/<id>` | Script aktualisieren |
| DELETE | `/api/python-scripts/<id>` | Script löschen |
| POST | `/api/python-scripts/<id>/run` | Script ausführen |
| POST | `/api/python-scripts/<id>/run-cells` | Zelle ausführen (Developer-Modus) |
| GET | `/api/python-scripts/<id>/runs` | Letzte 20 Runs |

## Ki Agenten

| Methode | Endpunkt | Beschreibung |
|---------|----------|-------------|
| GET | `/api/projects/<id>/ki-agents` | Agenten auflisten |
| POST | `/api/projects/<id>/ki-agents` | Agent anlegen |
| GET | `/api/ki-agents/<id>` | Agent-Detail |
| PUT | `/api/ki-agents/<id>` | Agent aktualisieren |
| DELETE | `/api/ki-agents/<id>` | Agent löschen |
| POST | `/api/ki-agents/<id>/run` | Agent starten |
| GET | `/api/ki-agents/<id>/runs` | Letzte 20 Runs |
| GET | `/api/ki-agents/<id>/files` | Workspace-Dateien |
| GET | `/api/ki-agents/<id>/files/<fn>` | Datei herunterladen |
| DELETE | `/api/ki-agents/<id>/files/<fn>` | Datei löschen |

## Admin-Einstellungen

| Methode | Endpunkt | Beschreibung |
|---------|----------|-------------|
| GET/PUT | `/api/admin/settings/ai` | KI-Konfiguration |
| GET/PUT | `/api/admin/settings/telegram` | Telegram-Bot-Konfiguration |
| GET/PUT | `/api/admin/settings/icloud` | iCloud-Konfiguration |
| GET | `/api/admin/users` | Nutzerverwaltung |

## Suche

| Methode | Endpunkt | Beschreibung |
|---------|----------|-------------|
| GET | `/api/search?q=<query>` | Volltext-Suche (Issues + Kommentare, min. 2 Zeichen) |
"""


def create_default_user():
    """Legt beim ersten Start einen Standard-Admin an, falls keine Nutzer existieren."""
    with app.app_context():
        if User.query.count() == 0:
            user = User(name="admin", is_admin=True)
            user.set_password("admin")
            db.session.add(user)
            db.session.commit()
            print("=" * 50)
            print("Standard-Admin wurde angelegt:")
            print("  Benutzername: admin")
            print("  Passwort:     admin")
            print("Bitte nach dem ersten Login das Passwort ändern!")
            print("=" * 50)


def create_default_wiki_pages():
    """Legt Standard-Wiki-Seiten an, falls sie noch nicht existieren."""
    with app.app_context():
        from app.models.wiki_page import WikiPage
        pages = [
            {
                'slug': 'axion-python-bibliothek',
                'title': 'Axion Python Library',
                'content': _AXION_LIBRARY_CONTENT,
            },
            {
                'slug': 'ki-agenten-aktionen',
                'title': 'Ki Agenten – Aktionen & Konfiguration',
                'content': _KI_AGENTS_CONTENT,
            },
            {
                'slug': 'api-referenz',
                'title': 'Axion API-Referenz',
                'content': _API_REFERENCE_CONTENT,
            },
        ]
        created = updated = 0
        for p in pages:
            existing = WikiPage.query.filter_by(slug=p['slug']).first()
            if not existing:
                db.session.add(WikiPage(
                    slug=p['slug'],
                    title=p['title'],
                    content=p['content'],
                    created_by=None,
                ))
                created += 1
            elif 'beautifulsoup4' in p['content'] and 'beautifulsoup4' not in (existing.content or ''):
                # Inhalt veraltet – neue Funktionen fehlen → aktualisieren
                existing.content = p['content']
                updated += 1
        if created or updated:
            db.session.commit()
            if created:
                print(f"{created} Standard-Wiki-Seite(n) angelegt.")
            if updated:
                print(f"{updated} Wiki-Seite(n) aktualisiert.")


if __name__ == "__main__":
    create_default_user()
    create_default_wiki_pages()
    app.run(host="0.0.0.0", port=5050, debug=True, use_reloader=False)
