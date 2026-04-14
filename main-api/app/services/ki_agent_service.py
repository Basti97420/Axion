import html
import json
import os
import re
import requests as http
from datetime import datetime, timedelta

from app import db


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


def _is_verifiable_action(action_type):
    """Gibt True zurück wenn diese Aktion verifizierbar ist."""
    return action_type in (
        'create_issue', 'update_issue', 'add_comment',
        'set_assignee', 'set_due_date', 'add_worklog',
        'create_wiki_page', 'update_wiki_page',
        'create_milestone', 'update_milestone',
        'create_tag', 'create_subtask',
        'assign_milestone', 'set_dependency',
        'create_python_script',
    )


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
        title = action_data.get('title', '').strip()
        issue = Issue.query.filter(
            Issue.project_id == action.get('project_id') or 0,
            Issue.title == title
        ).order_by(Issue.created_at.desc()).first()
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
        if 'content' in action_data and page.content != action_data['content']:
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

    return _get_ai_reply(messages, config_override=override or None, return_usage=return_usage)


AGENT_SYSTEM_PROMPT = """Du bist ein autonomer KI-Agent im Projektmanagement-System Axion.
Du antwortest IMMER auf Deutsch und als valides JSON.

Du kannst folgende Aktionen ausführen:
- create_issue: Neues Issue erstellen
- update_issue: Issue-Status/Priorität/Titel/Beschreibung ändern
- add_comment: Kommentar zu einem Issue hinzufügen
- set_assignee: Issue zuweisen
- set_due_date: Fälligkeitsdatum setzen
- add_worklog: Arbeitszeit erfassen
- create_wiki_page: Wiki-Seite erstellen
- update_wiki_page: Wiki-Seite aktualisieren
- create_milestone: Meilenstein erstellen
- create_file: Datei im Workspace erstellen (.md, .txt, .csv)
- trigger_agent: Anderen Agenten im Projekt starten

Antworte IMMER als valides JSON:
{"reply": "Zusammenfassung was du getan hast", "action": null}

Oder mit Aktion:
{"reply": "...", "action": {"type": "create_issue", "data": {"title": "...", "description": "...", "type": "bug", "priority": "high"}}}
{"reply": "...", "action": {"type": "update_issue", "issue_id": 5, "data": {"status": "done"}}}
{"reply": "...", "action": {"type": "add_comment", "issue_id": 5, "data": {"content": "..."}}}
{"reply": "...", "action": {"type": "create_wiki_page", "data": {"title": "...", "content": "Markdown"}}}
{"reply": "...", "action": {"type": "set_assignee", "issue_id": 5, "data": {"assignee_id": 2}}}
{"reply": "...", "action": {"type": "set_due_date", "issue_id": 5, "data": {"due_date": "2026-04-15"}}}
{"reply": "...", "action": {"type": "add_worklog", "issue_id": 5, "data": {"hours": 2.5, "description": "Arbeit"}}}
{"reply": "...", "action": {"type": "create_milestone", "data": {"name": "v1.0", "due_date": "2026-05-01"}}}
{"reply": "...", "action": {"type": "create_file", "data": {"filename": "bericht.md", "content": "# Inhalt"}}}
{"reply": "...", "action": {"type": "trigger_agent", "data": {"agent_id": 2}}}

Status-Werte: open, in_progress, in_review, done, cancelled
Prioritäten: low, medium, high, critical
Typen: task, bug, story, epic
Erlaubte Dateiendungen: .md, .txt, .csv

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

        context_str = _build_context(agent, memory_content=memory_content)
        system_content = AGENT_SYSTEM_PROMPT + "\n\n# Dein Auftrag\n" + agent_prompt
        messages = [
            {'role': 'system', 'content': system_content},
            {'role': 'user', 'content': context_str},
        ]

        raw, t_in, t_out = _get_agent_ai_reply(messages, agent, return_usage=True)
        total_tokens_in += t_in
        total_tokens_out += t_out

        try:
            ai_resp = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            ai_resp = {'reply': raw, 'action': None}

        reply = ai_resp.get('reply') or raw
        action = ai_resp.get('action')

        output_parts.append(reply)

        # Bis zu 5 Aktionen ausführen (Loop für Folgeantworten)
        for _ in range(5):
            if not action or not isinstance(action, dict):
                break
            action_type = action.get('type')
            if not action_type or action_type == 'none':
                break

            if agent.dry_run:
                actions_log.append({'type': action_type, 'simulated': True})
                output_parts.append(f'\n[SIMULATION] Aktion würde ausgeführt: `{action_type}`')
                break

            # Aktion ausführen
            action_data = action.get('data') or {}
            if action_type == 'create_file':
                result = _execute_file_action(action_data, exec_context)
            elif action_type == 'trigger_agent':
                result = _execute_trigger_agent_action(action_data, exec_context)
            else:
                result = _execute_action(action, agent_id, exec_context)

            # Verifikation + Retry-Loop
            verify_result = None
            if _is_verifiable_action(action_type):
                retry_count = 0
                verified = False
                while retry_count <= agent.retry_max and not verified:
                    if retry_count > 0:
                        # Warten vor Retry
                        wait_min = agent.retry_delay_min or 1
                        import time as _time
                        _time.sleep(wait_min * 60)
                        output_parts.append(f'\n[RETRY] Versuch {retry_count}/{agent.retry_max} für `{action_type}`')
                    verify_result = _verify_action(action, result)
                    verified = verify_result.get('ok', False) if verify_result else True
                    if not verified:
                        retry_count += 1
                        # Nochmal ausführen
                        if action_type == 'create_file':
                            result = _execute_file_action(action_data, exec_context)
                        elif action_type == 'trigger_agent':
                            result = _execute_trigger_agent_action(action_data, exec_context)
                        else:
                            result = _execute_action(action, agent_id, exec_context)
                    else:
                        break
                if not verified:
                    actions_log.append({
                        'type': action_type,
                        'result': result,
                        'verified': False,
                        'retries': retry_count,
                        'error': verify_result.get('detail') if verify_result else 'Verifikation fehlgeschlagen',
                    })
                    output_parts.append(f'\n❌ Aktion `{action_type}` nach {retry_count} Versuchen nicht verifiziert: {verify_result.get("detail") if verify_result else "?"}')
                else:
                    actions_log.append({
                        'type': action_type,
                        'result': result,
                        'verified': True,
                        'retries': retry_count,
                    })
                    output_parts.append(f'\n✅ Aktion `{action_type}` verifiziert (nach {retry_count} Versuchen).')
            else:
                if result:
                    actions_log.append({'type': action_type, 'result': result})

            if result:
                output_parts.append(f'\nAktion ausgeführt: `{action_type}` → {json.dumps(result, ensure_ascii=False)}')

            # Folgeantwort holen
            messages.append({'role': 'assistant', 'content': raw})
            verify_text = f' Verifiziert: {verify_result.get("detail")}' if verify_result and isinstance(verify_result, dict) else ''
            follow_msg = f'Aktion abgeschlossen{verify_text}. Gibt es weitere Aktionen?'
            messages.append({'role': 'user', 'content': follow_msg})
            try:
                raw, t_in, t_out = _get_agent_ai_reply(messages, agent, return_usage=True)
                total_tokens_in += t_in
                total_tokens_out += t_out
                ai_resp = json.loads(raw)
            except Exception:
                break
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
