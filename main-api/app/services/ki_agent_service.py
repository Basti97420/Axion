import html
import json
import os
import re
import requests as http
from datetime import datetime, timedelta

from app import db
from app.constants import READ_ACTIONS, WRITE_ACTIONS, ADMIN_ACTIONS, FETCH_ACTIONS


def _parse_ai_json(raw):
    """Parst die KI-Antwort robust zu einem Dict.
    Unterstützt:
    - Normales einzelnes JSON-Objekt
    - Mehrere JSON-Objekte (JSONL) – nimmt das erste
    - JSON in ```json ... ``` Codeblöcken
    Gibt immer ein Dict zurück (Fallback: {'reply': raw, 'action': None}).
    """
    if not raw or not raw.strip():
        return {'reply': '', 'action': None}

    text = raw.strip()

    # 1. Direkt parsen
    try:
        result = json.loads(text)
        if isinstance(result, dict):
            return result
    except (json.JSONDecodeError, ValueError):
        pass

    # 2. ```json ... ``` Codeblock extrahieren
    m = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if m:
        try:
            result = json.loads(m.group(1))
            if isinstance(result, dict):
                return result
        except (json.JSONDecodeError, ValueError):
            pass

    # 3. Zeilenweise: erstes valides JSON-Objekt nehmen (JSONL-Format)
    for line in text.splitlines():
        line = line.strip()
        if line.startswith('{'):
            try:
                result = json.loads(line)
                if isinstance(result, dict):
                    return result
            except (json.JSONDecodeError, ValueError):
                pass

    # 4. Erstes { ... } per Tiefenzähler extrahieren
    start = text.find('{')
    if start != -1:
        depth = 0
        for i, ch in enumerate(text[start:], start):
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    try:
                        result = json.loads(text[start:i + 1])
                        if isinstance(result, dict):
                            return result
                    except (json.JSONDecodeError, ValueError):
                        break

    return {'reply': raw, 'action': None}


def _fetch_website(url):
    """Holt Textinhalt einer Website (max 8000 Zeichen)."""
    try:
        r = http.get(url, timeout=10, headers={'User-Agent': 'Axion-Agent/1.0'})
        text = re.sub(r'<[^>]+>', ' ', r.text)
        text = html.unescape(text)
        return ' '.join(text.split())[:8000]
    except Exception as e:
        return f'[Fehler beim Abrufen der Website: {e}]'


def _get_workspace_dir(agent):
    """Ermittelt den Workspace-Ordner für den Agenten."""
    from flask import current_app
    try:
        from slugify import slugify
        slug = slugify(agent.name)
    except Exception:
        slug = re.sub(r'[^a-z0-9]+', '-', agent.name.lower()).strip('-')
    return os.path.join(
        current_app.instance_path, 'agent-workspaces',
        f'{agent.id}-{slug}'
    )


def _build_context(agent, memory_content=''):
    """Baut den Kontext-String für den Agenten auf."""
    from app.models.project import Project
    from app.models.issue import Issue
    from app.models.wiki_page import WikiPage
    from app.models.ki_agent import KiAgent
    from datetime import date

    parts = [f'Heute: {date.today().isoformat()}']

    if memory_content:
        parts.append(f'## Dein Gedächtnis (memory.md)\n{memory_content[:2000]}')

    proj = Project.query.get(agent.project_id)
    if proj:
        parts.append(f'Projekt: {proj.name} (ID: {proj.id})')

    issues = Issue.query.filter_by(project_id=agent.project_id).all()
    if issues:
        lines = ['Issues im Projekt:']
        for iss in issues:
            lines.append(f'  #{iss.id} [{iss.status}][{iss.priority}] {iss.title}')
        parts.append('\n'.join(lines))

    wiki_pages = WikiPage.query.filter_by(project_id=agent.project_id).all()
    if not wiki_pages:
        wiki_pages = WikiPage.query.filter_by(project_id=None).limit(10).all()
    if wiki_pages:
        parts.append('Wiki-Seiten: ' + ', '.join(p.slug for p in wiki_pages))

    if agent.workspace:
        parts.append(f'Letzter Workspace-Inhalt (vorheriger Agenten-Output):\n{agent.workspace[:2000]}')

    if agent.website_url:
        content = _fetch_website(agent.website_url)
        parts.append(f'Website-Inhalt ({agent.website_url}):\n{content}')

    # Andere Agenten im Projekt (für Ketten)
    other_agents = KiAgent.query.filter_by(project_id=agent.project_id)\
        .filter(KiAgent.id != agent.id).all()
    if other_agents:
        parts.append('Andere Agenten im Projekt:\n' + '\n'.join(
            f'  ID {a.id}: {a.name}' for a in other_agents))

    # Workspace-Dateien
    try:
        workspace_dir = _get_workspace_dir(agent)
        if os.path.isdir(workspace_dir):
            file_parts = []
            for fname in os.listdir(workspace_dir):
                if os.path.splitext(fname)[1].lower() in ('.md', '.txt', '.csv'):
                    fpath = os.path.join(workspace_dir, fname)
                    try:
                        with open(fpath, 'r', encoding='utf-8') as f:
                            content = f.read(500)
                        file_parts.append(f'  {fname}: {content}{"…" if len(content) == 500 else ""}')
                    except Exception:
                        file_parts.append(f'  {fname}: [Lesefehler]')
            if file_parts:
                parts.append('Workspace-Dateien:\n' + '\n'.join(file_parts))
    except Exception:
        pass

    return '\n\n'.join(parts)


def _save_checkpoint(agent, workspace_dir, step, action_type, result, verified, retry_count, output_parts):
    """Schreibt Checkpoint-Info nach memory.md (am Ende jeder Aktion)."""
    try:
        from datetime import datetime
        memory_md_path = os.path.join(workspace_dir, 'memory.md')
        # Bisherigen Inhalt lesen
        existing = ''
        if os.path.exists(memory_md_path):
            with open(memory_md_path, 'r', encoding='utf-8') as f:
                existing = f.read()
        # Checkpoint-Eintrag
        status = '✅' if verified else ('🔄' if retry_count > 0 else '❌')
        ts = datetime.utcnow().strftime('%Y-%m-%d %H:%M')
        line = f'\n- [{ts}] {status} {action_type}: {result} (Retries: {retry_count})'
        # An "Aktionen"-Sektion anfügen oder neu erstellen
        if '## Letzte Aktionen' in existing:
            existing = existing.split('## Letzte Aktionen')[0]
        checkpoint = f'## Letzte Aktionen{line}\n'
        with open(memory_md_path, 'w', encoding='utf-8') as f:
            f.write(existing.rstrip() + '\n' + checkpoint)
    except Exception:
        pass


def _is_verifiable_action(action_type):
    """Gibt True zurück wenn diese Aktion verifizierbar ist."""
    return action_type in (
        'create_issue', 'update_issue', 'add_comment',
        'set_assignee', 'set_due_date', 'add_worklog',
        'create_wiki_page', 'update_wiki_page',
        'create_milestone',
        'create_tag', 'create_subtask',
        'assign_milestone', 'set_dependency',
        'create_python_script',
    )


def _is_action_allowed(agent, action_type):
    """Prüft ob die Aktion für die Rolle des Agenten erlaubt ist."""
    role = getattr(agent, 'role', None) or 'maker'
    if role == 'admin':
        return True
    if role == 'reporter':
        return action_type in READ_ACTIONS
    if role == 'maker':
        return action_type in WRITE_ACTIONS or action_type in READ_ACTIONS
    return True


DEPENDENCY_GRAPH = {
    'create_issue': [],
    'update_issue': [],
    'add_comment': [],
    'set_assignee': [],
    'set_due_date': [],
    'add_worklog': [],
    'create_wiki_page': [],
    'update_wiki_page': [],
    'create_milestone': [],
    'update_milestone': [],
    'add_tag': [],
    'create_subtask': [],
    'assign_milestone': [],
    'set_dependency': [],
    'create_tag': [],
    'create_python_script': [],
}


def _execute_single_action(action_type, action_data, issue_id, agent, agent_id, exec_context):
    """Führt eine einzelne Aktion aus und gibt (result, error) zurück."""
    try:
        from app.routes.ai import _execute_action, _execute_file_action, _execute_trigger_agent_action
        if action_type == 'create_file':
            return _execute_file_action(action_data, exec_context), None
        elif action_type == 'trigger_agent':
            return _execute_trigger_agent_action(action_data, exec_context), None
        elif action_type == 'trigger_self':
            return {'trigger_self': True}, None
        else:
            return _execute_action({'type': action_type, 'data': action_data, 'issue_id': issue_id}, agent_id, exec_context), None
    except Exception as e:
        return None, str(e)


def _run_action_with_retry(action, agent, agent_id, exec_context):
    """Führt eine Aktion mit Verifikation + Retry aus. Gibt (result, verified, retries, error) zurück."""
    action_type = action.get('type')
    action_data = action.get('data') or {}
    issue_id = action.get('issue_id')

    result, err = _execute_single_action(action_type, action_data, issue_id, agent, agent_id, exec_context)
    if err:
        return result, False, 0, err

    if not _is_verifiable_action(action_type):
        return result, True, 0, None

    retry_count = 0
    verified = False
    while retry_count <= agent.retry_max and not verified:
        if retry_count > 0:
            base = agent.retry_delay_min or 1
            wait_min = min(base * (2 ** (retry_count - 1)), 15)
            import time as _time
            _time.sleep(wait_min * 60)
        verify_result = _verify_action(action, result)
        verified = verify_result.get('ok', False) if verify_result else True
        if not verified:
            retry_count += 1
            result, err = _execute_single_action(action_type, action_data, issue_id, agent, agent_id, exec_context)
            if err:
                return result, False, retry_count, err
        else:
            break

    if not verified:
        detail = verify_result.get('detail') if verify_result else 'Verifikation fehlgeschlagen'
        return result, False, retry_count, detail
    return result, True, retry_count, None


def _verify_action(action, result):
    """Prüft ob eine Aktion erfolgreich war. Gibt {'ok': bool, 'detail': str} zurück."""
    from app.models.issue import Issue
    from app.models.wiki_page import WikiPage
    from app.models.milestone import Milestone
    from app.models.tag import Tag

    action_type = action.get('type')
    action_data = action.get('data') or {}
    result = result or {}

    # create_issue → Issue muss in DB existieren
    if action_type == 'create_issue':
        # Erst per result-ID prüfen (direkteste Methode)
        issue_id = result.get('id') or result.get('issue_id')
        if issue_id:
            issue = Issue.query.get(issue_id)
            if issue:
                return {'ok': True, 'detail': f'Issue #{issue.id} "{issue.title}" existiert.'}
        # Fallback: per Titel suchen
        title = action_data.get('title', '').strip()
        if title:
            issue = Issue.query.filter(Issue.title == title).order_by(Issue.created_at.desc()).first()
            if issue:
                return {'ok': True, 'detail': f'Issue #{issue.id} "{issue.title}" existiert.'}
        return {'ok': False, 'detail': f'Issue "{title}" wurde nicht gefunden.'}

    # update_issue / set_assignee / set_due_date / add_worklog / add_comment
    if action_type in ('update_issue', 'set_assignee', 'set_due_date', 'add_comment', 'add_worklog', 'create_subtask', 'assign_milestone', 'set_dependency'):
        issue_id = result.get('issue_id') or action.get('issue_id')
        if not issue_id:
            return {'ok': False, 'detail': 'Keine Issue-ID für Verifikation.'}
        issue = Issue.query.get(issue_id)
        if not issue:
            return {'ok': False, 'detail': f'Issue #{issue_id} nicht mehr vorhanden.'}
        checks = []
        if action_type == 'update_issue':
            if 'status' in action_data and issue.status != action_data['status']:
                checks.append(f'Status={issue.status} (erwartet={action_data["status"]})')
            if 'priority' in action_data and issue.priority != action_data['priority']:
                checks.append(f'Priorität={issue.priority} (erwartet={action_data["priority"]})')
            if 'title' in action_data and issue.title != action_data['title']:
                checks.append(f'Titel="{issue.title}" (erwartet="{action_data["title"]}")')
        if checks:
            return {'ok': False, 'detail': f'Issue #{issue.id} stimmt nicht überein: {", ".join(checks)}'}
        return {'ok': True, 'detail': f'Issue #{issue.id} stimmt überein.'}

    # create_wiki_page → Wiki-Seite muss existieren
    if action_type == 'create_wiki_page':
        slug = result.get('slug') or action_data.get('slug')
        if not slug:
            return {'ok': False, 'detail': 'Kein Slug für Verifikation.'}
        page = WikiPage.query.filter_by(slug=slug).first()
        if page:
            return {'ok': True, 'detail': f'Wiki-Seite "{slug}" existiert.'}
        return {'ok': False, 'detail': f'Wiki-Seite "{slug}" nicht gefunden.'}

    # update_wiki_page → Content muss übereinstimmen
    if action_type == 'update_wiki_page':
        slug = action_data.get('slug') or (result.get('slug') if isinstance(result.get('slug'), str) else None)
        if not slug:
            return {'ok': False, 'detail': 'Kein Slug für Verifikation.'}
        page = WikiPage.query.filter_by(slug=slug).first()
        if not page:
            return {'ok': False, 'detail': f'Wiki-Seite "{slug}" nicht mehr vorhanden.'}
        if 'content' in action_data and (page.content or '').strip() != action_data['content'].strip():
            return {'ok': False, 'detail': f'Wiki-Seite "{slug}" Content stimmt nicht überein.'}
        return {'ok': True, 'detail': f'Wiki-Seite "{slug}" stimmt überein.'}

    # create_milestone → Meilenstein muss existieren
    if action_type == 'create_milestone':
        name = action_data.get('name', '').strip()
        ms = Milestone.query.filter_by(name=name).order_by(Milestone.id.desc()).first()
        if ms:
            return {'ok': True, 'detail': f'Meilenstein #{ms.id} "{ms.name}" existiert.'}
        return {'ok': False, 'detail': f'Meilenstein "{name}" nicht gefunden.'}

    # create_tag
    if action_type == 'create_tag':
        name = action_data.get('name', '').strip()
        tag = Tag.query.filter_by(name=name).first()
        if tag:
            return {'ok': True, 'detail': f'Tag "#{tag.id}" "{tag.name}" existiert.'}
        return {'ok': False, 'detail': f'Tag "{name}" nicht gefunden.'}

    # create_python_script → Script muss existieren
    if action_type == 'create_python_script':
        from app.models.python_script import PythonScript
        name = action_data.get('name', '').strip()
        script = PythonScript.query.filter_by(name=name).order_by(PythonScript.id.desc()).first()
        if script:
            return {'ok': True, 'detail': f'Script #{script.id} "{script.name}" existiert.'}
        return {'ok': False, 'detail': f'Script "{name}" nicht gefunden.'}

    return None


def _get_agent_ai_reply(messages, agent, return_usage=False):
    """Ruft die KI entsprechend der Agenten-Konfiguration auf.
    return_usage=True → gibt (text, tokens_in, tokens_out) zurück.
    """
    from app.routes.ai import _get_ai_reply
    from app.routes.settings import load_ai_config

    override = {}
    if agent.api_provider != 'global':
        override['provider'] = agent.api_provider
    if agent.api_url:
        override['ollama_url'] = agent.api_url
    if agent.api_model:
        override['ollama_model'] = agent.api_model
        override['claude_model'] = agent.api_model
    if agent.api_key:
        override['claude_api_key'] = agent.api_key

    try:
        return _get_ai_reply(messages, config_override=override or None, return_usage=return_usage)
    except Exception as e:
        err_str = str(e)
        # Verbindungsfehler: hilfreiche Fehlermeldung mit der verwendeten URL
        if any(kw in err_str for kw in ('Connection', 'refused', 'ECONNREFUSED', 'ConnectionError', 'Failed to establish')):
            cfg = {**load_ai_config(), **override}
            url = cfg.get('ollama_url', 'unbekannt')
            raise Exception(
                f'Verbindung zur KI fehlgeschlagen (URL: {url}). '
                f'Tipp: Unter Docker http://host.docker.internal:11434 statt localhost verwenden. '
                f'URL ändern unter Einstellungen → KI-Konfiguration oder direkt im Agenten.'
            ) from e
        raise


AGENT_SYSTEM_PROMPT = """Du bist ein autonomer KI-Agent im Projektmanagement-System Axion.
Du antwortest IMMER auf Deutsch und als valides JSON.

Du kannst folgende Aktionen ausführen:

# Schreib-Aktionen:
- create_issue: Neues Issue erstellen
- update_issue: Issue-Status/Priorität/Titel/Beschreibung/Eisenhower ändern
- add_comment: Kommentar zu einem Issue hinzufügen
- set_assignee: Issue zuweisen
- set_due_date: Fälligkeitsdatum setzen
- add_worklog: Arbeitszeit erfassen
- create_wiki_page: Wiki-Seite erstellen
- update_wiki_page: Wiki-Seite aktualisieren
- create_milestone: Meilenstein erstellen
- update_milestone: Bestehenden Meilenstein aktualisieren
- assign_milestone: Issue einem Meilenstein zuweisen
- create_file: Datei im Workspace erstellen (.md, .txt, .csv)
- trigger_agent: Anderen Agenten im Projekt starten
- trigger_self: Eigenen neuen Run starten (nur wenn 15 Schritte nicht reichen — vorher memory.md aktualisieren!). ACHTUNG: trigger_self funktioniert NUR in manuellen oder scheduler-gestarteten Runs, NICHT in bereits durch chain gestarteten Runs (Endlosschutz).

# Lese-Aktionen (du bekommst die Daten automatisch zurück):
- search_issues: Issues projektübergreifend suchen
- read_issue: Ein Issue vollständig lesen inkl. Kommentare
- read_wiki_page: Eine Wiki-Seite lesen
- search_wiki: Wiki nach einem Begriff durchsuchen
- list_projects: Alle Projekte auflisten

Antworte IMMER als valides JSON:
{"reply": "Zusammenfassung was du getan hast", "action": null}

Oder mit Aktion:
{"reply": "...", "action": {"type": "create_issue", "data": {"title": "...", "description": "...", "type": "bug", "priority": "high"}}}
{"reply": "...", "action": {"type": "update_issue", "issue_id": 5, "data": {"status": "done"}}}
{"reply": "...", "action": {"type": "update_issue", "issue_id": 5, "data": {"eisenhower": "do_first"}}}
{"reply": "...", "action": {"type": "add_comment", "issue_id": 5, "data": {"content": "..."}}}
{"reply": "...", "action": {"type": "set_assignee", "issue_id": 5, "data": {"assignee_id": 2}}}
{"reply": "...", "action": {"type": "set_due_date", "issue_id": 5, "data": {"due_date": "2026-04-15"}}}
{"reply": "...", "action": {"type": "add_worklog", "issue_id": 5, "data": {"hours": 2.5, "description": "Arbeit"}}}
{"reply": "...", "action": {"type": "create_milestone", "data": {"name": "v1.0", "due_date": "2026-05-01"}}}
{"reply": "...", "action": {"type": "update_milestone", "data": {"milestone_id": 2, "name": "v2.0", "due_date": "2026-06-01"}}}
{"reply": "...", "action": {"type": "assign_milestone", "issue_id": 5, "data": {"milestone_id": 2}}}
{"reply": "...", "action": {"type": "create_wiki_page", "data": {"title": "...", "content": "Markdown"}}}
{"reply": "...", "action": {"type": "create_file", "data": {"filename": "bericht.md", "content": "# Inhalt"}}}
{"reply": "...", "action": {"type": "trigger_agent", "data": {"agent_id": 2}}}
{"reply": "Ich starte mich neu...", "action": {"type": "trigger_self", "data": {"reason": "Mehr als 15 Schritte nötig"}}}
{"reply": "Ich suche...", "action": {"type": "search_issues", "data": {"query": "login", "status": "open"}}}
{"reply": "Ich lese...", "action": {"type": "read_issue", "data": {"issue_id": 5}}}
{"reply": "Ich lese...", "action": {"type": "read_wiki_page", "data": {"slug": "seitenname"}}}

Status-Werte: open, in_progress, hold, in_review, done, cancelled
Prioritäten: low, medium, high, critical
Typen: task, bug, story, epic
Erlaubte Dateiendungen: .md, .txt, .csv

Eisenhower-Matrix (eisenhower-Feld bei update_issue):
- do_first:  Wichtig + Dringend → sofort erledigen (Q1)
- schedule:  Wichtig + Nicht dringend → einplanen (Q2)
- delegate:  Nicht wichtig + Dringend → delegieren (Q3)
- eliminate: Nicht wichtig + Nicht dringend → eliminieren (Q4)
- null: nicht gesetzt

Du kannst bis zu 15 Aktionen pro Run ausführen. Wenn du mehr Schritte benötigst, aktualisiere zuerst memory.md und verwende dann trigger_self.

WICHTIG – Gedächtnis:
Am Ende jedes Runs aktualisierst du deine memory.md im Workspace mit:
- Was du in diesem Run getan hast
- Wichtige Erkenntnisse und offene Punkte
- Den aktuellen Status deiner Aufgabe
Nutze dafür die create_file-Aktion mit filename="memory.md".
"""


def run_agent(app, agent_id, run_id, triggered_by='manual'):
    """Führt einen KI-Agenten in einem eigenen App-Context aus (für Daemon-Threads)."""
    with app.app_context():
        _run_agent_inner(agent_id, run_id, triggered_by)


def _run_agent_inner(agent_id, run_id, triggered_by):
    from app.models.ki_agent import KiAgent, KiAgentRun
    from app.routes.ai import _execute_action, _execute_file_action, _execute_trigger_agent_action

    agent = KiAgent.query.get(agent_id)
    run = KiAgentRun.query.get(run_id)
    if not agent or not run:
        return

    actions_log = []
    output_parts = []
    total_tokens_in = 0
    total_tokens_out = 0

    try:
        workspace_dir = _get_workspace_dir(agent)
        exec_context = {
            'project_id': agent.project_id,
            'workspace_dir': workspace_dir,
            'current_agent_id': agent.id,
        }

        # agenten.md lesen → Auftrag des Agenten
        agent_prompt = ''
        agenten_md_path = os.path.join(workspace_dir, 'agenten.md')
        if os.path.exists(agenten_md_path):
            try:
                with open(agenten_md_path, 'r', encoding='utf-8') as f:
                    agent_prompt = f.read()
            except Exception:
                pass

        # memory.md lesen → persistentes Gedächtnis
        memory_content = ''
        memory_md_path = os.path.join(workspace_dir, 'memory.md')
        if os.path.exists(memory_md_path):
            try:
                with open(memory_md_path, 'r', encoding='utf-8') as f:
                    memory_content = f.read()
            except Exception:
                pass

        # Rolle in den Kontext einbauen
        role = getattr(agent, 'role', None) or 'maker'
        role_info = ''
        if role == 'reporter':
            role_info = '\n\n🚨 Du hast die Rolle "Reporter" — du darfst nur LESE-Aktionen ausführen (search_issues, read_wiki_page, search_wiki, list_wiki_pages, list_projects, search, read_issue). Keine Erstellungs- oder Änderungsaktionen!'
        elif role == 'maker':
            role_info = '\n\n🔧 Du hast die Rolle "Maker" — LESE- und SCHREIB-Aktionen erlaubt. Keine Script-Ausführungen oder Agent-Ketten.'
        elif role == 'admin':
            role_info = '\n\n🛡 Du hast die Rolle "Admin" — alle Aktionen erlaubt.'

        context_str = _build_context(agent, memory_content=memory_content)
        system_content = AGENT_SYSTEM_PROMPT + role_info + "\n\n# Dein Auftrag\n" + agent_prompt
        messages = [
            {'role': 'system', 'content': system_content},
            {'role': 'user', 'content': context_str},
        ]

        raw, t_in, t_out = _get_agent_ai_reply(messages, agent, return_usage=True)
        total_tokens_in += t_in
        total_tokens_out += t_out

        ai_resp = _parse_ai_json(raw)

        reply = ai_resp.get('reply') or raw
        action = ai_resp.get('action')

        output_parts.append(f'💭 {reply}')

        # Bis zu 15 Aktionen ausführen (Loop für Folgeantworten)
        for _ in range(15):
            if not action or not isinstance(action, dict):
                break
            action_type = action.get('type')
            if not action_type or action_type == 'none':
                break

            # Lese-Aktionen: zweistufig (Daten holen, dann KI erneut mit Daten)
            if action_type in FETCH_ACTIONS:
                from app.routes.ai import _fetch_context_for_ai
                fetched = _fetch_context_for_ai(action)
                if fetched:
                    messages.append({'role': 'assistant', 'content': raw})
                    messages.append({'role': 'user', 'content': f'[Abgerufene Daten]:\n{fetched}\n\nFahre mit dem ursprünglichen Auftrag fort.'})
                    try:
                        raw, t_in, t_out = _get_agent_ai_reply(messages, agent, return_usage=True)
                        total_tokens_in += t_in
                        total_tokens_out += t_out
                    except Exception:
                        break
                    ai_resp = _parse_ai_json(raw)
                    reply = ai_resp.get('reply') or reply
                    output_parts.append(f'\n\n↻ **Daten abgerufen ({action_type})**')
                    if reply:
                        output_parts.append(f'\n💭 {reply}')
                    actions_log.append({'type': action_type, 'thinking': reply, 'result': {'type': 'read_done'}, 'verified': True, 'retries': 0})
                    action = ai_resp.get('action')
                    continue

            # trigger_self: Neuen eigenen Run starten
            # Schutz gegen Endlosschleifen: nur erlaubt wenn dieser Run NICHT selbst per chain gestartet wurde
            if action_type == 'trigger_self':
                if triggered_by == 'chain':
                    actions_log.append({'type': 'trigger_self', 'thinking': reply, 'result': None, 'verified': False, 'retries': 0, 'error': 'Endlosschutz: trigger_self ist in chain-Runs nicht erlaubt'})
                    output_parts.append('\n\n⛔ **`trigger_self` abgebrochen** — bereits ein chain-Run, Endlosschutz aktiv.')
                    break
                agent.workspace = '\n'.join(output_parts)
                db.session.commit()
                from app.models.ki_agent import KiAgentRun as _SelfRun
                import threading as _threading
                new_run = _SelfRun(agent_id=agent.id, triggered_by='chain', started_at=datetime.utcnow())
                db.session.add(new_run)
                db.session.commit()
                from flask import current_app as _cur_app
                _threading.Thread(
                    target=run_agent,
                    args=(_cur_app._get_current_object(), agent.id, new_run.id, 'chain'),
                    daemon=True,
                ).start()
                reason = (action.get('data') or {}).get('reason', '')
                actions_log.append({'type': 'trigger_self', 'thinking': reply, 'result': {'new_run_id': new_run.id}, 'verified': True, 'retries': 0})
                output_parts.append(f'\n\n🔄 **Neuen eigenen Run gestartet (Run #{new_run.id})**{(" — " + reason) if reason else ""}')
                break

            # Rolle prüfen
            if not _is_action_allowed(agent, action_type):
                output_parts.append(f'\n⛔ Aktion `{action_type}` ist für Rolle "{agent.role}" nicht erlaubt.')
                action = None
                continue

            if agent.dry_run:
                actions_log.append({'type': action_type, 'simulated': True})
                output_parts.append(f'\n[SIMULATION] Aktion würde ausgeführt: `{action_type}`')
                break

            # Human-in-the-Loop
            if action.get('await_human') and agent.notify_telegram:
                agent.pending_confirmation = action_type
                db.session.commit()
                try:
                    from app.services import telegram_bot as tg
                    tg.notify(
                        f'🤖 Agent „{agent.name}" wartet auf Bestätigung:\n\n'
                        f'🔔 <b>{action_type}</b>\n'
                        f'Details: {json.dumps(action.get("data") or {}, ensure_ascii=False)}\n\n'
                        f'Bestätigen: /confirm {agent.id}\n'
                        f'Ablehnen: /deny {agent.id}'
                    )
                except Exception:
                    pass
                output_parts.append(f'\n⏳ Aktion `{action_type}` wartet auf menschliche Bestätigung...')
                import time as _time
                for _ in range(60):
                    _time.sleep(5)
                    db.session.refresh(agent)
                    if not agent.pending_confirmation:
                        break
                if agent.pending_confirmation:
                    output_parts.append(f'\n⏰ Timeout bei Bestätigung für `{action_type}` — übersprungen.')
                    actions_log.append({'type': action_type, 'result': None, 'verified': False, 'retries': 0, 'error': 'Timeout'})
                    agent.pending_confirmation = None
                    db.session.commit()
                    action = None
                    continue
                output_parts.append(f'\n✅ Bestätigung erhalten für `{action_type}` — wird ausgeführt.')

            # Aktion mit Retry ausführen
            current_thinking = reply  # Denk-Schritt der zu dieser Aktion geführt hat
            result, verified, retries, err = _run_action_with_retry(action, agent, agent_id, exec_context)
            if err:
                actions_log.append({'type': action_type, 'thinking': current_thinking, 'result': result, 'verified': False, 'retries': retries, 'error': err})
                output_parts.append(f'\n\n❌ **Aktion `{action_type}` fehlgeschlagen:** {err}')
            elif not verified:
                actions_log.append({'type': action_type, 'thinking': current_thinking, 'result': result, 'verified': False, 'retries': retries, 'error': 'Verifikation fehlgeschlagen'})
                output_parts.append(f'\n\n❌ **Aktion `{action_type}`** nach {retries} Versuchen nicht verifiziert.')
            else:
                actions_log.append({'type': action_type, 'thinking': current_thinking, 'result': result, 'verified': True, 'retries': retries})
                result_summary = ''
                if isinstance(result, dict):
                    if result.get('id'):
                        result_summary = f' → #{result["id"]}'
                    elif result.get('title'):
                        result_summary = f' → „{result["title"]}"'
                output_parts.append(f'\n\n✅ **`{action_type}`{result_summary}**')
            _save_checkpoint(agent, workspace_dir, len(actions_log), action_type, result, verified, retries, output_parts)

            # Progressiver Output-Update für Live-Polling
            try:
                run.output = '\n'.join(output_parts)
                db.session.commit()
            except Exception:
                db.session.rollback()

            # Folgeantwort holen
            messages.append({'role': 'assistant', 'content': raw})
            follow_result = json.dumps(result or {}, ensure_ascii=False)
            # Bei create_file: Dateiinhalt sofort zurückgeben damit der Agent damit weiterarbeiten kann
            if action_type == 'create_file' and not err and verified:
                filename = (action.get('data') or {}).get('filename', '')
                if filename:
                    try:
                        fpath = os.path.join(workspace_dir, filename)
                        if os.path.exists(fpath):
                            with open(fpath, 'r', encoding='utf-8') as _f:
                                file_content = _f.read(3000)
                            follow_result = f'Datei "{filename}" wurde erstellt. Inhalt:\n{file_content}'
                    except Exception:
                        pass
            follow = f'Aktion abgeschlossen: {follow_result}. Führe alle weiteren nötigen Aktionen für den ursprünglichen Auftrag aus. Wenn alles erledigt ist, antworte mit action: null.'
            messages.append({'role': 'user', 'content': follow})
            try:
                raw, t_in, t_out = _get_agent_ai_reply(messages, agent, return_usage=True)
                total_tokens_in += t_in
                total_tokens_out += t_out
            except Exception:
                break
            ai_resp = _parse_ai_json(raw)
            reply = ai_resp.get('reply') or ''
            if reply:
                output_parts.append(f'\n\n💭 {reply}')
            action = ai_resp.get('action')

        final_output = '\n'.join(output_parts)

        # Workspace aktualisieren
        agent.workspace = final_output
        agent.last_run_at = datetime.utcnow()
        if agent.schedule_type == 'interval' and agent.interval_min:
            agent.next_run_at = datetime.utcnow() + timedelta(minutes=agent.interval_min)

        run.output = final_output
        run.actions = json.dumps(actions_log, ensure_ascii=False)
        run.finished_at = datetime.utcnow()
        run.triggered_by = triggered_by
        run.tokens_in = total_tokens_in
        run.tokens_out = total_tokens_out
        db.session.commit()

        # Telegram-Benachrichtigung
        if agent.notify_telegram:
            try:
                from app.services import telegram_bot as tg
                summary = final_output[:300]
                mode = ' [SIMULATION]' if agent.dry_run else ''
                tg.notify(f'🤖 Agent „{agent.name}"{mode} abgeschlossen:\n{summary}')
            except Exception:
                pass

    except Exception as e:
        run.error = str(e)[:500]
        run.finished_at = datetime.utcnow()
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            return

        # Retry-Logik
        if agent.retry_on_error:
            from app.models.ki_agent import KiAgentRun as _Run
            recent_errors = _Run.query.filter_by(agent_id=agent.id)\
                .filter(_Run.error.isnot(None))\
                .order_by(_Run.started_at.desc()).limit(agent.retry_max).all()
            if len(recent_errors) < agent.retry_max:
                agent.next_run_at = datetime.utcnow() + timedelta(minutes=agent.retry_delay_min)
                try:
                    db.session.commit()
                except Exception:
                    db.session.rollback()
