import os
import json
import threading
import requests as http
from datetime import date as _date
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from app import db
from app.models.issue import Issue
from app.models.comment import Comment
from app.models.activity import ActivityLog
from app.routes.settings import load_ai_config
from app.constants import FETCH_ACTIONS

bp = Blueprint('ai', __name__, url_prefix='/api/ai')

SYSTEM_PROMPT_TEMPLATE = """Du bist ein hilfreicher Projektmanagement-Assistent für Axion.
Heute ist: {date}
Aktuell angemeldeter Nutzer: {user_name} (ID: {user_id})
Du hast Zugriff auf die Issues des aktuellen Projekts (siehe unten im Kontext).
Du antwortest IMMER auf Deutsch.

Du kannst folgende Aktionen ausführen:
- update_issue: Status, Priorität, Titel oder Beschreibung eines Issues ändern
- add_comment: Einen Kommentar zu einem Issue hinzufügen
- create_issue: Ein neues Issue im aktuellen Projekt erstellen
- set_assignee: Issue einem Benutzer zuweisen (assignee_id aus dem Kontext, null = entfernen)
- set_due_date: Fälligkeitsdatum setzen (ISO-Format YYYY-MM-DD, null = löschen)
- add_worklog: Arbeitszeit auf einem Issue erfassen (hours als Dezimalzahl)
- add_tag: Tag zu einem Issue hinzufügen (tag_id aus dem Kontext)
- remove_tag: Tag von einem Issue entfernen (tag_id aus dem Kontext)
- create_subtask: Unteraufgabe zu einem Issue erstellen
- create_milestone: Neuen Meilenstein im Projekt erstellen
- assign_milestone: Issue einem Meilenstein zuweisen (milestone_id aus dem Kontext, null = entfernen)
- set_dependency: Issue blockiert ein anderes Issue
- list_projects: Alle verfügbaren Projekte auflisten (nützlich wenn kein Projektkontext vorhanden)
- search_issues: Issues projektübergreifend suchen (liefert Ergebnisse im nächsten Schritt)
- read_wiki_page: Eine Wiki-Seite lesen (du bekommst dann den Inhalt)
- search_wiki: Wiki nach einem Begriff durchsuchen
- create_wiki_page: Eine neue Wiki-Seite erstellen
- update_wiki_page: Eine bestehende Wiki-Seite aktualisieren
- create_python_script: Ein neues Python-Script im Projekt anlegen
- run_python_script: Ein bestehendes Python-Script ausführen (per script_id oder name)
- create_ki_agent: Einen neuen KI-Agenten im Projekt anlegen
- run_ki_agent: Einen bestehenden KI-Agenten starten (per agent_id oder name)
- create_tag: Einen neuen Tag im Projekt erstellen
- update_milestone: Einen bestehenden Meilenstein aktualisieren (name, description, due_date)
- list_wiki_pages: Alle Wiki-Seiten des Projekts auflisten (liefert Ergebnisse im nächsten Schritt)
- read_issue: Ein einzelnes Issue vollständig lesen inkl. aller Kommentare (zum Verifizieren nach Änderungen)
- read_script_output: Den letzten Output eines Python-Scripts lesen (stdout, stderr, exit_code)
- read_agent_output: Den letzten Output eines KI-Agenten lesen (output, Fehler)

Antworte IMMER als valides JSON-Objekt in genau diesem Format:
{{"reply": "Deine Antwort an den Nutzer", "action": null}}

Wenn du eine Aktion ausführst:
{{"reply": "...", "action": {{"type": "update_issue", "issue_id": 5, "data": {{"status": "done"}}}}}}
{{"reply": "...", "action": {{"type": "add_comment", "issue_id": 5, "data": {{"content": "Text"}}}}}}
{{"reply": "...", "action": {{"type": "create_issue", "data": {{"title": "Titel", "description": "...", "type": "bug", "priority": "high"}}}}}}
{{"reply": "...", "action": {{"type": "set_assignee", "issue_id": 5, "data": {{"assignee_id": 2}}}}}}
{{"reply": "...", "action": {{"type": "set_due_date", "issue_id": 5, "data": {{"due_date": "2026-04-15"}}}}}}
{{"reply": "...", "action": {{"type": "add_worklog", "issue_id": 5, "data": {{"hours": 2.5, "description": "Bugfix"}}}}}}
{{"reply": "...", "action": {{"type": "add_tag", "issue_id": 5, "data": {{"tag_id": 3}}}}}}
{{"reply": "...", "action": {{"type": "remove_tag", "issue_id": 5, "data": {{"tag_id": 3}}}}}}
{{"reply": "...", "action": {{"type": "create_subtask", "issue_id": 5, "data": {{"title": "Unteraufgabe", "description": "..."}}}}}}
{{"reply": "...", "action": {{"type": "create_milestone", "data": {{"name": "v1.0", "description": "...", "due_date": "2026-05-01"}}}}}}
{{"reply": "...", "action": {{"type": "assign_milestone", "issue_id": 5, "data": {{"milestone_id": 2}}}}}}
{{"reply": "...", "action": {{"type": "set_dependency", "issue_id": 5, "data": {{"blocks_issue_id": 7}}}}}}
{{"reply": "Ich suche...", "action": {{"type": "search_issues", "data": {{"query": "login", "status": "open", "priority": "high"}}}}}}
{{"reply": "Ich lese...", "action": {{"type": "read_wiki_page", "data": {{"slug": "seitenname"}}}}}}
{{"reply": "Ich suche im Wiki...", "action": {{"type": "search_wiki", "data": {{"query": "suchbegriff"}}}}}}
{{"reply": "...", "action": {{"type": "create_wiki_page", "data": {{"title": "Titel", "content": "Markdown"}}}}}}
{{"reply": "...", "action": {{"type": "update_wiki_page", "data": {{"slug": "seitenname", "title": "Neuer Titel", "content": "Inhalt"}}}}}}
{{"reply": "Ich liste die Projekte...", "action": {{"type": "list_projects"}}}}
{{"reply": "...", "action": {{"type": "create_python_script", "data": {{"name": "Mein Script", "description": "...", "code": "print('Hallo')", "timeout_sec": 30}}}}}}
{{"reply": "...", "action": {{"type": "run_python_script", "data": {{"script_id": 3}}}}}}
{{"reply": "...", "action": {{"type": "run_python_script", "data": {{"name": "Mein Script"}}}}}}
{{"reply": "...", "action": {{"type": "create_ki_agent", "data": {{"name": "Wochenbericht", "prompt": "Erstelle wöchentlichen Bericht...", "schedule_type": "interval", "interval_min": 10080}}}}}}
{{"reply": "...", "action": {{"type": "run_ki_agent", "data": {{"agent_id": 2}}}}}}
{{"reply": "...", "action": {{"type": "run_ki_agent", "data": {{"name": "Wochenbericht"}}}}}}
{{"reply": "...", "action": {{"type": "create_tag", "data": {{"name": "urgent", "color": "#ef4444"}}}}}}
{{"reply": "...", "action": {{"type": "update_milestone", "data": {{"milestone_id": 2, "name": "v2.0", "description": "...", "due_date": "2026-06-01"}}}}}}
{{"reply": "Ich liste Wiki-Seiten...", "action": {{"type": "list_wiki_pages"}}}}
{{"reply": "Ich lese Issue #5 zur Überprüfung...", "action": {{"type": "read_issue", "data": {{"issue_id": 5}}}}}}
{{"reply": "Ich prüfe den Script-Output...", "action": {{"type": "read_script_output", "data": {{"script_id": 3}}}}}}
{{"reply": "Ich prüfe den Agenten-Output...", "action": {{"type": "read_agent_output", "data": {{"agent_id": 2}}}}}}

- create_calendar_entry: Einen Termin/Kalender-Eintrag erstellen (title, start_dt, end_dt im ISO-Format)
- list_calendar_entries: Kalendereinträge des Projekts auflisten (optional: start, end als ISO-Datum)
- save_memory: Inhalt dauerhaft in einer Datei im Chat-Workspace speichern
- read_memory: Eine Memory-Datei lesen — du bekommst dann den Inhalt (wie read_wiki_page)

{{"reply": "Ich merke mir...", "action": {{"type": "save_memory", "data": {{"filename": "todo.md", "content": "# Offene Punkte\n- ..."}}}}}},
{{"reply": "Ich merke mir...", "action": {{"type": "save_memory", "data": {{"filename": "todo.md", "content": "# Offene Punkte\n- ..."}}}}}},
{{"reply": "Ich lese...", "action": {{"type": "read_memory", "data": {{"filename": "todo.md"}}}}}}
{{"reply": "...", "action": {{"type": "create_calendar_entry", "data": {{"title": "Meeting", "start_dt": "2026-05-01T10:00:00", "end_dt": "2026-05-01T11:00:00"}}}}}}
{{"reply": "Ich liste Termine...", "action": {{"type": "list_calendar_entries", "data": {{"start": "2026-05-01", "end": "2026-05-31"}}}}}}

Verfügbare Status-Werte: open, in_progress, hold, in_review, done, cancelled
Verfügbare Prioritäten: low, medium, high, critical

Issue-Typen und Hierarchie:
- epic: Übergeordnete Sammlung von mehreren Storys/Tasks
- story: Beschreibt ein User-Feature; kann Unteraufgaben (Subtasks) haben
- task: Einzelne technische Aufgabe
- bug: Fehler oder Problem

Unteraufgaben (Subtasks) einer Story erstellen:
- Zuerst die Story mit create_issue (type=story) erstellen
- Dann create_subtask mit issue_id = ID der Story verwenden
- Beispiel für Story mit Unteraufgaben:
  1. {{"reply": "Erstelle Story...", "action": {{"type": "create_issue", "data": {{"title": "User Login", "type": "story", "priority": "high"}}}}}}
  2. Nach Bestätigung: {{"reply": "Erstelle Unteraufgabe...", "action": {{"type": "create_subtask", "issue_id": <story_id>, "data": {{"title": "Login-Formular bauen"}}}}}}
- create_subtask funktioniert für jeden Issue-Typ als Parent (story, epic, task)

Wichtige Regeln:
- "auf mich zuweisen" → set_assignee mit assignee_id = {user_id}
- "für nächste Woche" → due_date = {next_week}
- Ohne Projektkontext → list_projects verwenden, dann Nutzer fragen
- Immer zuerst reply schreiben, was du getan hast oder tun wirst
- Bei mehreren zusammengehörigen Aktionen (z.B. Story + Unteraufgaben): alle nacheinander ausführen ohne Bestätigung

Aktions-Feedback:
- Nach jeder Aktion bekommst du eine [Systemrückmeldung] mit dem Ergebnis
- issue_id, milestone_id etc. stehen explizit im Feedback — verwende sie direkt für Folgeaktionen
- Beispiel: create_issue → Feedback enthält issue_id = 42 → add_comment mit issue_id: 42
- Bei Fehler (❌) kannst du es korrigieren oder die nächste sinnvolle Aktion ausführen
"""


def _fetch_context_for_ai(action):
    """Holt Inhalt für KI-Kontext (Wiki-Aktionen und Issue-Suche) direkt aus der DB."""
    action_type = action.get('type')
    data = action.get('data') or {}

    if action_type == 'read_wiki_page':
        slug = (data.get('slug') or '').strip()
        if not slug:
            return None
        from app.models.wiki_page import WikiPage
        page = WikiPage.query.filter_by(slug=slug).first()
        if not page:
            return f'Wiki-Seite "{slug}" wurde nicht gefunden.'
        return f'# {page.title}\n\n{page.content or ""}'

    if action_type == 'search_wiki':
        query = (data.get('query') or '').strip()
        if not query:
            return None
        from app.services.wiki_search_service import search as wiki_search
        results = wiki_search(query)
        if not results:
            return f'Keine Wiki-Ergebnisse für "{query}" gefunden.'
        lines = [f'Suchergebnisse für "{query}":']
        for r in results[:5]:
            lines.append(f'- {r.get("title", "?")} (Slug: {r.get("slug", "?")})')
        return '\n'.join(lines)

    if action_type == 'list_projects':
        from app.models.project import Project
        projects = Project.query.order_by(Project.id).all()
        if not projects:
            return 'Keine Projekte vorhanden.'
        lines = ['Verfügbare Projekte:']
        for p in projects:
            lines.append(f'  ID {p.id}: {p.name}')
        return '\n'.join(lines)

    if action_type == 'search_issues':
        query = (data.get('query') or '').strip()
        status_filter = data.get('status')
        priority_filter = data.get('priority')
        q = Issue.query
        if query:
            q = q.filter(Issue.title.ilike(f'%{query}%'))
        if status_filter:
            q = q.filter_by(status=status_filter)
        if priority_filter:
            q = q.filter_by(priority=priority_filter)
        results = q.order_by(Issue.created_at.desc()).limit(10).all()
        if not results:
            return f'Keine Issues gefunden für Suche "{query}".'
        lines = [f'Suchergebnisse für "{query}":']
        for i in results:
            lines.append(f'  #{i.id} [{i.status}][{i.priority}] {i.title}')
        return '\n'.join(lines)

    if action_type == 'list_wiki_pages':
        from app.models.wiki_page import WikiPage
        project_id = data.get('project_id')
        q = WikiPage.query
        if project_id:
            q = q.filter_by(project_id=project_id)
        pages = q.order_by(WikiPage.title).all()
        if not pages:
            return 'Keine Wiki-Seiten gefunden.'
        lines = ['Wiki-Seiten:']
        for p in pages:
            lines.append(f'  Slug: {p.slug} | Titel: {p.title}')
        return '\n'.join(lines)

    if action_type == 'read_issue':
        from app.models.comment import Comment
        issue_id = data.get('issue_id')
        if not issue_id:
            return 'issue_id fehlt.'
        issue = Issue.query.get(issue_id)
        if not issue:
            return f'Issue #{issue_id} nicht gefunden.'
        lines = [
            f'# Issue #{issue.id}: {issue.title}',
            f'Status: {issue.status} | Priorität: {issue.priority} | Typ: {issue.type}',
            f'Beschreibung: {issue.description or "(keine)"}',
            f'Fällig: {issue.due_date.isoformat() if issue.due_date else "(kein Datum)"}',
        ]
        comments = Comment.query.filter_by(issue_id=issue_id).order_by(Comment.created_at.asc()).all()
        if comments:
            lines.append(f'\nKommentare ({len(comments)}):')
            for c in comments:
                lines.append(f'  [{c.created_at.strftime("%d.%m.%Y %H:%M")}] {c.content}')
        else:
            lines.append('\nKeine Kommentare.')
        return '\n'.join(lines)

    if action_type == 'read_script_output':
        from app.models.python_script import PythonScript, PythonScriptRun
        script_id = data.get('script_id')
        script_name = data.get('name')
        if script_id:
            script = PythonScript.query.get(script_id)
        elif script_name:
            script = PythonScript.query.filter_by(name=script_name).first()
        else:
            return 'script_id oder name fehlt.'
        if not script:
            return 'Script nicht gefunden.'
        runs = PythonScriptRun.query.filter_by(script_id=script.id).order_by(PythonScriptRun.id.desc()).limit(3).all()
        if not runs:
            return f'Script "{script.name}" wurde noch nie ausgeführt.'
        lines = [f'Letzte Ausführungen von "{script.name}":']
        for r in runs:
            status = f'exit {r.exit_code}' if r.exit_code is not None else ('Fehler' if r.error else 'läuft noch')
            lines.append(f'\n--- Run {r.id} ({status}, {r.triggered_by}) ---')
            if r.error:
                lines.append(f'Fehler: {r.error}')
            if r.stdout:
                lines.append(f'stdout:\n{r.stdout[:2000]}{"..." if len(r.stdout) > 2000 else ""}')
            if r.stderr:
                lines.append(f'stderr:\n{r.stderr[:500]}{"..." if len(r.stderr) > 500 else ""}')
        return '\n'.join(lines)

    if action_type == 'read_agent_output':
        from app.models.ki_agent import KiAgent, KiAgentRun
        agent_id = data.get('agent_id')
        agent_name = data.get('name')
        if agent_id:
            agent = KiAgent.query.get(agent_id)
        elif agent_name:
            agent = KiAgent.query.filter_by(name=agent_name).first()
        else:
            return 'agent_id oder name fehlt.'
        if not agent:
            return 'Agent nicht gefunden.'
        runs = KiAgentRun.query.filter_by(agent_id=agent.id).order_by(KiAgentRun.id.desc()).limit(2).all()
        if not runs:
            return f'Agent "{agent.name}" wurde noch nie ausgeführt.'
        lines = [f'Letzte Ausführungen von Agent "{agent.name}":']
        for r in runs:
            status = 'Fehler' if r.error else 'OK'
            lines.append(f'\n--- Run {r.id} ({status}, {r.triggered_by}) ---')
            if r.error:
                lines.append(f'Fehler: {r.error}')
            if r.output:
                lines.append(f'Output:\n{r.output[:2000]}{"..." if len(r.output) > 2000 else ""}')
        return '\n'.join(lines)

    if action_type == 'read_memory':
        from flask import current_app
        from werkzeug.utils import secure_filename
        filename = secure_filename((data.get('filename') or '').strip())
        if not filename:
            return 'Dateiname fehlt.'
        fpath = os.path.join(current_app.instance_path, 'chat-workspace', filename)
        if not os.path.isfile(fpath):
            return f'Memory-Datei "{filename}" nicht gefunden. Verfügbare Dateien per save_memory anlegen.'
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()
            return f'# Inhalt von {filename}\n\n{content}'
        except Exception as e:
            return f'Fehler beim Lesen von "{filename}": {e}'

    if action_type == 'list_calendar_entries':
        from app.models.calendar_entry import CalendarEntry
        from datetime import datetime as _dt
        project_id = data.get('project_id')
        q = CalendarEntry.query
        if project_id:
            q = q.filter_by(project_id=int(project_id))
        if data.get('start'):
            try:
                q = q.filter(CalendarEntry.start_dt >= _dt.fromisoformat(data['start']))
            except ValueError:
                pass
        if data.get('end'):
            try:
                q = q.filter(CalendarEntry.end_dt <= _dt.fromisoformat(data['end']))
            except ValueError:
                pass
        entries = q.order_by(CalendarEntry.start_dt).limit(50).all()
        if not entries:
            return 'Keine Kalendereinträge gefunden.'
        lines = [f'Kalendereinträge ({len(entries)}):']
        for e in entries:
            title = e.title or (e.issue.title if e.issue else '(kein Titel)')
            lines.append(f'  #{e.id} | {e.start_dt.strftime("%d.%m.%Y %H:%M")} – {e.end_dt.strftime("%H:%M")} | {title}')
        return '\n'.join(lines)

    return None


def _get_ai_reply(messages, config_override=None, return_usage=False):
    """Sendet Nachrichten an den konfigurierten KI-Provider und gibt den Antwort-Text zurück.
    config_override: optionales Dict mit Schlüsseln provider/ollama_url/ollama_model/claude_api_key/claude_model
    return_usage: wenn True, wird (text, tokens_in, tokens_out) zurückgegeben
    """
    cfg = {**load_ai_config(), **(config_override or {})}
    provider = cfg['provider']

    if provider == 'claude':
        import anthropic
        client = anthropic.Anthropic(api_key=cfg['claude_api_key'])
        system = next((m['content'] for m in messages if m['role'] == 'system'), '')
        chat_messages = [m for m in messages if m['role'] != 'system']
        response = client.messages.create(
            model=cfg['claude_model'],
            max_tokens=1024,
            system=system,
            messages=chat_messages,
        )
        text = response.content[0].text
        if return_usage:
            return text, response.usage.input_tokens, response.usage.output_tokens
        return text
    else:
        r = http.post(
            f'{cfg["ollama_url"]}/api/chat',
            json={
                'model': cfg['ollama_model'],
                'messages': messages,
                'stream': False,
                'format': 'json',
            },
            timeout=120,
        )
        r.raise_for_status()
        data = r.json()
        text = data['message']['content']
        if return_usage:
            return text, data.get('prompt_eval_count', 0), data.get('eval_count', 0)
        return text


def _execute_action(action, user_id, context=None):
    """Führt eine KI-Aktion aus und gibt das Ergebnis zurück."""
    action_type = action.get('type')
    issue_id = action.get('issue_id')
    action_data = action.get('data') or {}
    context = context or {}

    # --- Wiki-Aktionen ---
    if action_type == 'create_wiki_page':
        from app.models.wiki_page import WikiPage
        from slugify import slugify as _slugify
        title = (action_data.get('title') or '').strip()
        if not title:
            return {'type': 'error', 'message': 'Wiki-Titel fehlt'}
        project_id = action_data.get('project_id') or context.get('project_id')
        slug = _slugify(title)
        base_slug = slug
        counter = 1
        while WikiPage.query.filter_by(slug=slug).first():
            slug = f'{base_slug}-{counter}'
            counter += 1
        page = WikiPage(
            slug=slug,
            title=title,
            content=action_data.get('content', ''),
            project_id=int(project_id) if project_id else None,
            created_by=user_id,
        )
        db.session.add(page)
        db.session.commit()
        return {'type': 'wiki_page_created', 'slug': page.slug, 'title': page.title}

    if action_type == 'update_wiki_page':
        from app.models.wiki_page import WikiPage
        slug = (action_data.get('slug') or '').strip()
        if not slug:
            return {'type': 'error', 'message': 'Wiki-Slug fehlt'}
        page = WikiPage.query.filter_by(slug=slug).first()
        if not page:
            return {'type': 'error', 'message': f'Wiki-Seite "{slug}" nicht gefunden'}
        if 'title' in action_data:
            page.title = action_data['title'].strip()
        if 'content' in action_data:
            page.content = action_data['content']
        db.session.commit()
        return {'type': 'wiki_page_updated', 'slug': page.slug, 'title': page.title}

    # --- Meilenstein erstellen (kein issue_id nötig) ---
    if action_type == 'create_milestone':
        from app.models.milestone import Milestone
        from datetime import date as dt_date
        name = (action_data.get('name') or '').strip()
        if not name:
            return {'type': 'error', 'message': 'Meilenstein-Name fehlt'}
        project_id = action_data.get('project_id') or context.get('project_id')
        if not project_id:
            return {'type': 'error', 'message': 'Kein Projekt-Kontext für Meilenstein'}
        raw_due = action_data.get('due_date')
        ms = Milestone(
            name=name,
            description=action_data.get('description', ''),
            project_id=int(project_id),
            due_date=dt_date.fromisoformat(raw_due) if raw_due else None,
        )
        db.session.add(ms)
        db.session.commit()
        return {'type': 'milestone_created', 'milestone_id': ms.id, 'name': ms.name}

    # --- Tag erstellen ---
    if action_type == 'create_tag':
        from app.models.tag import Tag
        name = (action_data.get('name') or '').strip()
        if not name:
            return {'type': 'error', 'message': 'Tag-Name fehlt'}
        project_id = action_data.get('project_id') or context.get('project_id')
        color = action_data.get('color', '#6366f1')
        tag = Tag(name=name, color=color,
                  project_id=int(project_id) if project_id else None)
        db.session.add(tag)
        db.session.commit()
        return {'type': 'tag_created', 'tag_id': tag.id, 'name': tag.name}

    # --- Meilenstein aktualisieren ---
    if action_type == 'update_milestone':
        from app.models.milestone import Milestone
        from datetime import date as dt_date
        milestone_id = action_data.get('milestone_id')
        ms = Milestone.query.get(milestone_id) if milestone_id else None
        if not ms:
            return {'type': 'error', 'message': f'Meilenstein #{milestone_id} nicht gefunden'}
        if 'name' in action_data:
            ms.name = action_data['name'].strip()
        if 'description' in action_data:
            ms.description = action_data['description']
        if 'due_date' in action_data:
            raw = action_data['due_date']
            ms.due_date = dt_date.fromisoformat(raw) if raw else None
        db.session.commit()
        return {'type': 'milestone_updated', 'milestone_id': ms.id, 'name': ms.name}

    # search_issues wird zweistufig behandelt (wie read_wiki_page)
    if action_type == 'search_issues':
        return {'type': '_search_result', 'action_data': action_data}

    # --- Issue-Aktionen ---
    if action_type == 'create_issue':
        project_id = action_data.get('project_id') or context.get('project_id')
        if not project_id:
            return {'type': 'error', 'message': 'Kein Projekt-Kontext für Issue-Erstellung'}
        title = (action_data.get('title') or '').strip()
        if not title:
            return {'type': 'error', 'message': 'Titel fehlt'}
        issue = Issue(
            title=title,
            description=action_data.get('description', ''),
            type=action_data.get('type', 'task'),
            priority=action_data.get('priority', 'low'),
            status='open',
            project_id=int(project_id),
            creator_id=user_id,
        )
        db.session.add(issue)
        db.session.flush()
        db.session.add(ActivityLog(
            issue_id=issue.id,
            project_id=int(project_id),
            user_id=user_id,
            action='ki_create',
        ))
        db.session.commit()
        return {'type': 'create_issue', 'issue_id': issue.id, 'title': issue.title}

    if not issue_id:
        return None

    issue = Issue.query.get(issue_id)
    if not issue:
        return {'error': f'Issue #{issue_id} nicht gefunden'}

    if action_type == 'set_assignee':
        issue.assignee_id = action_data.get('assignee_id')
        db.session.add(ActivityLog(issue_id=issue.id, user_id=user_id, action='ki_update',
                                   field_changed='assignee_id',
                                   new_value=str(issue.assignee_id)))
        db.session.commit()
        return {'type': 'issue_updated', 'issue_id': issue.id, 'changes': {'assignee_id': issue.assignee_id}}

    if action_type == 'set_due_date':
        from datetime import date as dt_date
        raw = action_data.get('due_date')
        issue.due_date = dt_date.fromisoformat(raw) if raw else None
        db.session.add(ActivityLog(issue_id=issue.id, user_id=user_id, action='ki_update',
                                   field_changed='due_date', new_value=str(raw)))
        db.session.commit()
        return {'type': 'issue_updated', 'issue_id': issue.id, 'changes': {'due_date': raw}}

    if action_type == 'add_worklog':
        from app.models.worklog import Worklog
        from datetime import date as dt_date
        hours = float(action_data.get('hours', 1))
        duration_min = int(hours * 60)
        wl = Worklog(
            issue_id=issue_id,
            user_id=user_id,
            duration_min=duration_min,
            date=dt_date.today(),
            description=action_data.get('description', ''),
        )
        db.session.add(wl)
        db.session.add(ActivityLog(issue_id=issue.id, user_id=user_id, action='ki_worklog',
                                   new_value=f'{duration_min}min'))
        db.session.commit()
        return {'type': 'worklog_added', 'issue_id': issue_id, 'hours': hours}

    if action_type == 'add_tag':
        from app.models.tag import Tag
        tag = Tag.query.get(action_data.get('tag_id'))
        if tag and tag not in issue.tags:
            issue.tags.append(tag)
            db.session.add(ActivityLog(issue_id=issue.id, user_id=user_id, action='ki_update',
                                       field_changed='tag', new_value=tag.name))
            db.session.commit()
        return {'type': 'tag_added', 'issue_id': issue_id}

    if action_type == 'remove_tag':
        from app.models.tag import Tag
        tag = Tag.query.get(action_data.get('tag_id'))
        if tag and tag in issue.tags:
            issue.tags.remove(tag)
            db.session.add(ActivityLog(issue_id=issue.id, user_id=user_id, action='ki_update',
                                       field_changed='tag_removed', new_value=tag.name))
            db.session.commit()
        return {'type': 'tag_removed', 'issue_id': issue_id}

    if action_type == 'create_subtask':
        title = (action_data.get('title') or '').strip()
        if not title:
            return {'type': 'error', 'message': 'Titel für Unteraufgabe fehlt'}
        subtask = Issue(
            title=title,
            description=action_data.get('description', ''),
            type='subtask',
            priority=issue.priority,
            status='open',
            project_id=issue.project_id,
            creator_id=user_id,
            parent_id=issue_id,
        )
        db.session.add(subtask)
        db.session.commit()
        return {'type': 'create_issue', 'issue_id': subtask.id, 'title': subtask.title}

    if action_type == 'assign_milestone':
        issue.milestone_id = action_data.get('milestone_id')
        db.session.add(ActivityLog(issue_id=issue.id, user_id=user_id, action='ki_update',
                                   field_changed='milestone_id', new_value=str(issue.milestone_id)))
        db.session.commit()
        return {'type': 'issue_updated', 'issue_id': issue.id,
                'changes': {'milestone_id': issue.milestone_id}}

    if action_type == 'set_dependency':
        target_id = action_data.get('blocks_issue_id')
        target = Issue.query.get(target_id) if target_id else None
        if not target:
            return {'type': 'error', 'message': f'Ziel-Issue #{target_id} nicht gefunden'}
        if target not in issue.blocks:
            issue.blocks.append(target)
            db.session.commit()
        return {'type': 'dependency_set', 'issue_id': issue.id, 'blocks': target.id}

    if action_type == 'update_issue':
        allowed = {'status', 'priority', 'title', 'description', 'eisenhower'}
        changes = {}
        for field in allowed:
            if field in action_data:
                old_val = str(getattr(issue, field) or '')
                setattr(issue, field, action_data[field])
                changes[field] = action_data[field]
                db.session.add(ActivityLog(
                    issue_id=issue.id,
                    user_id=user_id,
                    action='ki_update',
                    field_changed=field,
                    old_value=old_val,
                    new_value=str(action_data[field]),
                ))
        db.session.commit()
        return {'type': 'issue_updated', 'issue_id': issue.id, 'changes': changes}

    elif action_type == 'add_comment':
        content = (action_data.get('content') or '').strip()
        if not content:
            return None
        comment = Comment(issue_id=issue_id, author_id=user_id, content=content)
        db.session.add(comment)
        db.session.add(ActivityLog(
            issue_id=issue_id,
            user_id=user_id,
            action='ki_comment',
        ))
        db.session.commit()
        return {'type': 'comment_added', 'issue_id': issue.id}

    # --- Kalender-Aktionen ---
    if action_type == 'create_calendar_entry':
        from app.models.calendar_entry import CalendarEntry
        from datetime import datetime as _dt
        d = action_data
        title = (d.get('title') or '').strip()
        start_raw = d.get('start_dt') or ''
        end_raw = d.get('end_dt') or ''
        if not start_raw or not end_raw:
            return {'type': 'error', 'message': 'start_dt und end_dt sind Pflichtfelder (ISO-Format)'}
        try:
            start_dt = _dt.fromisoformat(start_raw)
            end_dt = _dt.fromisoformat(end_raw)
        except ValueError:
            return {'type': 'error', 'message': f'Ungültiges Datumsformat: {start_raw} / {end_raw}'}
        project_id = d.get('project_id') or context.get('project_id')
        entry = CalendarEntry(
            title=title or None,
            start_dt=start_dt,
            end_dt=end_dt,
            issue_id=d.get('issue_id'),
            project_id=int(project_id) if project_id else None,
        )
        db.session.add(entry)
        db.session.commit()
        return {'type': 'calendar_entry_created', 'id': entry.id, 'title': entry.title,
                'start_dt': start_raw, 'end_dt': end_raw}

    if action_type == 'list_calendar_entries':
        from app.models.calendar_entry import CalendarEntry
        from datetime import datetime as _dt
        d = action_data
        project_id = d.get('project_id') or context.get('project_id')
        q = CalendarEntry.query
        if project_id:
            q = q.filter_by(project_id=int(project_id))
        if d.get('start'):
            try:
                q = q.filter(CalendarEntry.start_dt >= _dt.fromisoformat(d['start']))
            except ValueError:
                pass
        if d.get('end'):
            try:
                q = q.filter(CalendarEntry.end_dt <= _dt.fromisoformat(d['end']))
            except ValueError:
                pass
        entries = q.order_by(CalendarEntry.start_dt).limit(50).all()
        return [e.to_dict() for e in entries]

    return None


def _execute_python_script_action(action_type, action_data, context):
    """Erstellt oder startet ein Python-Script."""
    from app.models.python_script import PythonScript, PythonScriptRun
    from flask import current_app

    if action_type == 'create_python_script':
        project_id = action_data.get('project_id') or context.get('project_id')
        name = (action_data.get('name') or '').strip()
        if not project_id or not name:
            return {'type': 'error', 'message': 'Projekt oder Name fehlt'}
        script = PythonScript(
            project_id=int(project_id),
            name=name,
            description=action_data.get('description', ''),
            code=action_data.get('code', ''),
            timeout_sec=int(action_data.get('timeout_sec') or 30),
            is_active=True,
        )
        db.session.add(script)
        db.session.commit()
        return {'type': 'script_created', 'script_id': script.id, 'name': script.name}

    if action_type == 'run_python_script':
        from app.services.python_script_service import run_script as _run_script
        script_id = action_data.get('script_id')
        script_name = action_data.get('name')
        if script_id:
            script = PythonScript.query.get(script_id)
        elif script_name:
            project_id = context.get('project_id')
            script = PythonScript.query.filter_by(name=script_name, project_id=project_id).first()
        else:
            return {'type': 'error', 'message': 'script_id oder name erforderlich'}
        if not script:
            return {'type': 'error', 'message': 'Script nicht gefunden'}
        run = PythonScriptRun(script_id=script.id, triggered_by='ki')
        db.session.add(run)
        db.session.commit()
        app = current_app._get_current_object()
        threading.Thread(target=_run_script, args=(app, script.id, run.id), daemon=True).start()
        return {'type': 'script_started', 'script_id': script.id, 'run_id': run.id}

    return None


def _execute_ki_agent_action(action_type, action_data, context):
    """Erstellt oder startet einen KI-Agenten."""
    from app.models.ki_agent import KiAgent, KiAgentRun
    from flask import current_app

    if action_type == 'create_ki_agent':
        project_id = action_data.get('project_id') or context.get('project_id')
        name = (action_data.get('name') or '').strip()
        if not project_id or not name:
            return {'type': 'error', 'message': 'Projekt oder Name fehlt'}
        agent = KiAgent(
            project_id=int(project_id),
            name=name,
            prompt=action_data.get('prompt', ''),
            schedule_type=action_data.get('schedule_type', 'manual'),
            interval_min=int(action_data.get('interval_min') or 60),
            is_active=True,
        )
        db.session.add(agent)
        db.session.commit()
        return {'type': 'ki_agent_created', 'agent_id': agent.id, 'name': agent.name}

    if action_type == 'run_ki_agent':
        from app.services.ki_agent_service import run_agent
        agent_id = action_data.get('agent_id')
        agent_name = action_data.get('name')
        if agent_id:
            agent = KiAgent.query.get(agent_id)
        elif agent_name:
            project_id = context.get('project_id')
            agent = KiAgent.query.filter_by(name=agent_name, project_id=project_id).first()
        else:
            return {'type': 'error', 'message': 'agent_id oder name erforderlich'}
        if not agent:
            return {'type': 'error', 'message': 'Agent nicht gefunden'}
        run = KiAgentRun(agent_id=agent.id, triggered_by='ki')
        db.session.add(run)
        db.session.commit()
        app = current_app._get_current_object()
        threading.Thread(target=run_agent, args=(app, agent.id, run.id, 'ki'), daemon=True).start()
        return {'type': 'ki_agent_started', 'agent_id': agent.id, 'run_id': run.id}

    if action_type == 'save_memory':
        from flask import current_app
        from werkzeug.utils import secure_filename
        filename = secure_filename((action_data.get('filename') or '').strip())
        if not filename:
            return {'type': 'error', 'message': 'Dateiname fehlt'}
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ('.md', '.txt', '.csv'):
            return {'type': 'error', 'message': 'Nur .md, .txt, .csv erlaubt'}
        workspace = os.path.join(current_app.instance_path, 'chat-workspace')
        os.makedirs(workspace, exist_ok=True)
        fpath = os.path.join(workspace, filename)
        content = action_data.get('content', '')
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        return {'type': 'memory_saved', 'filename': filename}

    return None


def _execute_file_action(action_data, context):
    """Datei im Agent-Workspace anlegen/überschreiben."""
    from werkzeug.utils import secure_filename
    workspace_dir = context.get('workspace_dir')
    if not workspace_dir:
        return {'type': 'error', 'message': 'Kein Workspace-Verzeichnis konfiguriert'}
    filename = secure_filename(action_data.get('filename') or 'output.md')
    if not filename:
        filename = 'output.md'
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ('.md', '.txt', '.csv'):
        return {'type': 'error', 'message': 'Nur .md, .txt, .csv erlaubt'}
    os.makedirs(workspace_dir, exist_ok=True)
    filepath = os.path.join(workspace_dir, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(action_data.get('content', ''))
    return {'type': 'file_created', 'filename': filename}


def _execute_trigger_agent_action(action_data, context):
    """Anderen Agenten im gleichen Projekt asynchron starten."""
    from flask import current_app
    from app.models.ki_agent import KiAgent, KiAgentRun
    from app.services.ki_agent_service import run_agent

    target_id = action_data.get('agent_id')
    target_name = action_data.get('agent_name')
    if target_id:
        target = KiAgent.query.get(target_id)
    elif target_name:
        target = KiAgent.query.filter_by(name=target_name).first()
    else:
        return {'type': 'error', 'message': 'agent_id oder agent_name erforderlich'}

    if not target:
        return {'type': 'error', 'message': 'Ziel-Agent nicht gefunden'}
    if target.id == context.get('current_agent_id'):
        return {'type': 'error', 'message': 'Agent darf sich nicht selbst triggern'}

    run = KiAgentRun(agent_id=target.id, triggered_by='chain')
    db.session.add(run)
    db.session.commit()
    app = current_app._get_current_object()
    threading.Thread(target=run_agent, args=(app, target.id, run.id, 'chain'), daemon=True).start()
    return {'type': 'agent_triggered', 'agent_id': target.id, 'run_id': run.id}


def _build_result_feedback(result):
    """Erstellt eine strukturierte, KI-lesbare Systemrückmeldung nach einer Aktion.
    Hebt wichtige IDs explizit hervor, damit die KI sie für Folgeaktionen nutzen kann.
    """
    if not result:
        return 'Aktion wurde ausgeführt (kein Ergebnis zurückgegeben).'
    if isinstance(result, dict) and result.get('type') == 'error':
        return f'❌ Fehler: {result.get("message", "Unbekannter Fehler")}'

    lines = ['✅ Aktion erfolgreich ausgeführt.']
    r = result
    # Issue-Erstellung / Subtask / Kommentar
    if r.get('issue_id'):
        lines.append(f'   issue_id = {r["issue_id"]}   ← Diese ID für Folgeaktionen verwenden (add_comment, set_assignee, create_subtask, assign_milestone, …)')
    if r.get('title'):
        lines.append(f'   title = "{r["title"]}"')
    # Meilenstein
    if r.get('milestone_id'):
        lines.append(f'   milestone_id = {r["milestone_id"]}   ← Für assign_milestone verwenden')
    # Wiki
    if r.get('slug'):
        lines.append(f'   slug = "{r["slug"]}"')
    # Tag
    if r.get('tag_id'):
        lines.append(f'   tag_id = {r["tag_id"]}')
    # Allgemeiner Name (Meilenstein, Agent, Script, Tag)
    if r.get('name') and not r.get('title'):
        lines.append(f'   name = "{r["name"]}"')
    # Script/Agent IDs
    if r.get('script_id'):
        lines.append(f'   script_id = {r["script_id"]}')
    if r.get('agent_id'):
        lines.append(f'   agent_id = {r["agent_id"]}')
    # Falls nichts Spezifisches → rohe JSON-Ausgabe
    if len(lines) == 1:
        lines.append(f'   {json.dumps(r, ensure_ascii=False)}')
    return '\n'.join(lines)


@bp.get('/status')
@login_required
def status():
    cfg = load_ai_config()
    provider = cfg['provider']
    if provider == 'claude':
        available = bool(cfg['claude_api_key'])
        return jsonify({'provider': 'claude', 'available': available, 'model': cfg['claude_model']})
    try:
        r = http.get(f'{cfg["ollama_url"]}/api/tags', timeout=3)
        models = [m['name'] for m in r.json().get('models', [])]
        return jsonify({'provider': 'ollama', 'available': True, 'models': models, 'model': cfg['ollama_model']})
    except Exception:
        return jsonify({'provider': 'ollama', 'available': False, 'models': [], 'model': cfg['ollama_model']})


@bp.post('/chat')
@login_required
def chat():
    data = request.get_json()
    message = (data.get('message') or '').strip()
    context = data.get('context') or {}
    history = data.get('history') or []

    if not message:
        return jsonify({'error': 'Nachricht fehlt'}), 400

    project_id = context.get('project_id')
    issue_id = context.get('issue_id')
    wiki_slug = context.get('wiki_slug')

    context_parts = []

    # System-Prompt mit aktuellem Datum + User befüllen
    from app.models.user import User
    from datetime import timedelta
    today = _date.today()
    next_week = (today + timedelta(days=7)).isoformat()
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        date=today.isoformat(),
        user_name=current_user.name,
        user_id=current_user.id,
        next_week=next_week,
    )

    # Benutzer-Liste (für set_assignee)
    users = User.query.all()
    if users:
        context_parts.append('Benutzer:\n' + '\n'.join(f'  ID {u.id}: {u.name}' for u in users))

    if project_id:
        from app.models.project import Project
        proj = Project.query.get(project_id)
        if proj:
            context_parts.append(f'Aktuelles Projekt: {proj.name} (ID: {project_id})')
        issues = Issue.query.filter_by(project_id=project_id).all()
        lines = ['Issues im Projekt:']
        for iss in issues:
            lines.append(f'  #{iss.id} [{iss.status}] [{iss.priority}] {iss.title}')
        context_parts.append('\n'.join(lines))

        # Tags des Projekts
        from app.models.tag import Tag
        tags = Tag.query.filter_by(project_id=project_id).all()
        if tags:
            context_parts.append('Tags im Projekt:\n' + '\n'.join(
                f'  ID {t.id}: {t.name}' for t in tags))

        # Meilensteine des Projekts
        from app.models.milestone import Milestone
        milestones = Milestone.query.filter_by(project_id=project_id).all()
        if milestones:
            context_parts.append('Meilensteine:\n' + '\n'.join(
                f'  ID {m.id}: {m.name} (fällig: {m.due_date})' for m in milestones))

        # Python Scripts des Projekts
        from app.models.python_script import PythonScript
        scripts = PythonScript.query.filter_by(project_id=project_id).all()
        if scripts:
            context_parts.append('Python Scripts im Projekt:\n' + '\n'.join(
                f'  ID {s.id}: {s.name}' + (f' – {s.description}' if s.description else '')
                for s in scripts))

        # KI-Agenten des Projekts
        from app.models.ki_agent import KiAgent
        agents = KiAgent.query.filter_by(project_id=project_id).all()
        if agents:
            context_parts.append('KI-Agenten im Projekt:\n' + '\n'.join(
                f'  ID {a.id}: {a.name}'
                + (f' [⏱ {a.interval_min}min]' if a.schedule_type == 'interval' else '')
                for a in agents))

    iss = None
    if issue_id:
        iss = Issue.query.get(issue_id)
        if iss:
            parts = [
                'Aktuell geöffnetes Issue:',
                f'  #{iss.id}: {iss.title}',
                f'  Status: {iss.status} | Priorität: {iss.priority} | Typ: {iss.type}',
            ]
            if iss.description:
                parts.append(f'  Beschreibung: {iss.description}')
            if iss.assignee_id:
                assignee = User.query.get(iss.assignee_id)
                parts.append(f'  Zugewiesen an: {assignee.name if assignee else iss.assignee_id}')
            if iss.due_date:
                parts.append(f'  Fällig: {iss.due_date}')
            if iss.milestone_id:
                from app.models.milestone import Milestone
                ms = Milestone.query.get(iss.milestone_id)
                parts.append(f'  Meilenstein: {ms.name if ms else iss.milestone_id}')
            if hasattr(iss, 'tags') and iss.tags:
                parts.append(f'  Tags: {", ".join(t.name for t in iss.tags)}')
            subtask_count = Issue.query.filter_by(parent_id=iss.id).count()
            if subtask_count:
                parts.append(f'  Unteraufgaben: {subtask_count}')
            context_parts.append('\n'.join(parts))

            # Letzte Kommentare des Issues
            recent_comments = Comment.query.filter_by(issue_id=issue_id)\
                .order_by(Comment.created_at.desc()).limit(5).all()
            if recent_comments:
                comment_lines = ['Letzte Kommentare:']
                for c in reversed(recent_comments):
                    author = User.query.get(c.author_id)
                    name = author.name if author else 'Unbekannt'
                    comment_lines.append(f'  [{name}]: {c.content[:120]}')
                context_parts.append('\n'.join(comment_lines))

    if wiki_slug:
        from app.models.wiki_page import WikiPage
        page = WikiPage.query.filter_by(slug=wiki_slug).first()
        if page:
            context_parts.append(
                f'Aktuell angezeigte Wiki-Seite:\n'
                f'  Slug: {page.slug}\n'
                f'  Titel: {page.title}\n'
                f'  Inhalt:\n{page.content or ""}'
            )

    # Chat-Workspace: anweisungen.md immer laden, andere Dateien als Namen listen
    try:
        workspace_dir = os.path.join(current_app.instance_path, 'chat-workspace')
        if os.path.isdir(workspace_dir):
            anweisungen_path = os.path.join(workspace_dir, 'anweisungen.md')
            if os.path.isfile(anweisungen_path):
                with open(anweisungen_path, 'r', encoding='utf-8') as f:
                    anweisungen = f.read().strip()
                if anweisungen:
                    system_prompt += f'\n\n## Deine Anweisungen (anweisungen.md)\n{anweisungen}'
            memory_files = [
                fn for fn in os.listdir(workspace_dir)
                if fn != 'anweisungen.md' and os.path.splitext(fn)[1].lower() in ('.md', '.txt', '.csv')
            ]
            if memory_files:
                context_parts.append(
                    'Verfügbare Memories (per read_memory lesbar): ' + ', '.join(sorted(memory_files))
                )
    except Exception:
        pass

    system_content = system_prompt
    if context_parts:
        system_content += '\n\n' + '\n\n'.join(context_parts)

    messages = [{'role': 'system', 'content': system_content}]
    for h in history[-10:]:
        if h.get('role') in ('user', 'assistant'):
            messages.append({'role': h['role'], 'content': h['content']})
    messages.append({'role': 'user', 'content': message})

    try:
        raw = _get_ai_reply(messages)
    except Exception as e:
        return jsonify({'error': f'KI-Fehler: {str(e)}'}), 502

    try:
        ai_resp = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        ai_resp = {'reply': raw, 'action': None}

    reply = ai_resp.get('reply') or raw
    action = ai_resp.get('action')
    action_result = None

    # Zweistufiger Ablauf für Lese-/Suchaktionen
    if action and isinstance(action, dict) and action.get('type') in FETCH_ACTIONS:
        fetched_context = _fetch_context_for_ai(action)
        if fetched_context:
            messages.append({'role': 'assistant', 'content': raw})
            messages.append({
                'role': 'user',
                'content': f'[Abgerufene Daten]:\n{fetched_context}\n\nBeantworte nun die Frage des Nutzers auf Basis dieser Informationen.',
            })
            try:
                raw2 = _get_ai_reply(messages)
                ai_resp2 = json.loads(raw2)
            except Exception:
                ai_resp2 = {'reply': fetched_context, 'action': None}
            reply = ai_resp2.get('reply') or raw2
            # Folge-Aktion der KI übernehmen (z.B. create_issue nach search_issues)
            raw = raw2
            ai_resp = ai_resp2
            action = ai_resp2.get('action')  # kann None sein → Loop wird nicht betreten
        else:
            action = None

    SCRIPT_ACTIONS = ('create_python_script', 'run_python_script')
    KI_AGENT_ACTIONS = ('create_ki_agent', 'run_ki_agent', 'save_memory')

    def _dispatch_action(act):
        if act.get('type') in SCRIPT_ACTIONS:
            return _execute_python_script_action(act['type'], act.get('data') or {}, context)
        if act.get('type') in KI_AGENT_ACTIONS:
            return _execute_ki_agent_action(act['type'], act.get('data') or {}, context)
        return _execute_action(act, current_user.id, context)

    def _enrich(result, prompt_text, raw_response):
        """Fügt _prompt und _raw als Metafelder zum Ergebnis hinzu."""
        if not result:
            return result
        enriched = dict(result)
        enriched['_prompt'] = prompt_text
        enriched['_raw'] = raw_response
        return enriched

    all_results = []
    if action and isinstance(action, dict) and action.get('type') not in (None, 'none'):
        action_result = _dispatch_action(action)
        if action_result:
            all_results.append(_enrich(action_result, message, raw))

        # Multi-Aktions-Loop: bis zu 10 Folgeaktionen ohne Nutzereingabe
        for _ in range(10):
            messages.append({'role': 'assistant', 'content': raw})
            follow = (
                f'[Systemrückmeldung]\n'
                f'{_build_result_feedback(action_result)}\n\n'
                f'Führe alle weiteren nötigen Aktionen für den ursprünglichen Auftrag aus. '
                f'Wenn alles erledigt ist, antworte mit {{"reply": "Zusammenfassung", "action": null}}'
            )
            messages.append({'role': 'user', 'content': follow})
            try:
                raw = _get_ai_reply(messages)
                ai_resp = json.loads(raw)
            except Exception:
                break
            next_action = ai_resp.get('action')
            if not next_action or not isinstance(next_action, dict):
                break
            if next_action.get('type') in (None, 'none'):
                break
            # Read-Aktion auch im Loop: zweistufig abhandeln
            if next_action.get('type') in FETCH_ACTIONS:
                fetched = _fetch_context_for_ai(next_action)
                if fetched:
                    messages.append({'role': 'assistant', 'content': raw})
                    messages.append({'role': 'user', 'content': f'[Abgerufene Daten]:\n{fetched}\n\nFahre mit dem ursprünglichen Auftrag fort.'})
                    try:
                        raw = _get_ai_reply(messages)
                        ai_resp = json.loads(raw)
                    except Exception:
                        break
                read_result = {'type': 'read_done', 'action': next_action.get('type')}
                all_results.append(_enrich(read_result, follow, raw))
                reply = ai_resp.get('reply') or reply
                # KI hat nach den Daten möglicherweise direkt eine Folge-Aktion formuliert
                # → als action_result setzen und Loop-Top überspringen (direkt als nächste Iteration)
                post_read_action = ai_resp.get('action')
                if post_read_action and isinstance(post_read_action, dict) and post_read_action.get('type') not in (None, 'none'):
                    post_result = _dispatch_action(post_read_action)
                    if post_result:
                        all_results.append(_enrich(post_result, raw, raw))
                    action_result = post_result or read_result
                else:
                    action_result = read_result
                continue
            else:
                action_result = _dispatch_action(next_action)
            if action_result:
                all_results.append(_enrich(action_result, follow, raw))
            # Letzte Antwort der KI als reply verwenden
            reply = ai_resp.get('reply') or reply

    return jsonify({
        'reply': reply,
        'action_results': all_results,
        'action_result': all_results[-1] if all_results else None,
    })
