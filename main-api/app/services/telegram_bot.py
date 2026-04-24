"""
Telegram Bot Service – Polling-basiert, kein externes Package nötig (nutzt requests).
Öffentliche API: start(app), stop(), restart(app), notify(text)
"""
import logging
import os
import threading
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_thread: Optional[threading.Thread] = None
_running = False
_app = None

_notify_queue: list = []
_notify_lock = threading.Lock()
_last_flush = 0.0  # Unix-Timestamp des letzten Flushes

DEFAULT_CONFIG = {
    'bot_token': '',
    'chat_id': '',
    'default_project_id': None,
    'notify_on_create': True,
    'notify_on_status_change': True,
}

STATUS_LABELS = {
    'open': 'Offen', 'in_progress': 'In Arbeit', 'hold': 'Pausiert',
    'in_review': 'Im Review', 'done': 'Erledigt', 'cancelled': 'Abgebrochen',
}
PRIORITY_LABELS = {
    'low': 'Niedrig', 'medium': 'Mittel', 'high': 'Hoch', 'critical': 'Kritisch',
}

BOT_COMMANDS = [
    ('issue',  'Neues Issue erstellen: /issue Mein Titel'),
    ('bug',    'Bug melden: /bug Beschreibung'),
    ('issues', 'Letzte offene Issues anzeigen'),
    ('done',   'Issue abschließen: /done 42'),
    ('suche',  'Issues durchsuchen: /suche Stichwort'),
    ('status', 'Projektstatistik anzeigen'),
    ('ki',     'KI-Assistent fragen: /ki Was sind offene Bugs?'),
    ('hilfe',  'Alle Befehle anzeigen'),
    ('confirm', 'Agent-Aktion bestätigen: /confirm AgentID'),
    ('deny',   'Agent-Aktion ablehnen: /deny AgentID'),
]


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def load_tg_config() -> dict:
    """Liest Telegram-Konfiguration aus settings.env (frisch bei jedem Aufruf)."""
    try:
        from app.services.settings_env import read
        raw_pid = read('TELEGRAM_DEFAULT_PROJECT_ID', os.getenv('TELEGRAM_DEFAULT_PROJECT_ID', ''))
        try:
            project_id = int(raw_pid) if raw_pid else None
        except ValueError:
            project_id = None
        raw_interval = read('TELEGRAM_NOTIFY_INTERVAL_MIN', os.getenv('TELEGRAM_NOTIFY_INTERVAL_MIN', '5'))
        try:
            notify_interval = max(0, int(raw_interval)) if raw_interval else 5
        except ValueError:
            notify_interval = 5
        return {
            'bot_token':               read('TELEGRAM_BOT_TOKEN', os.getenv('TELEGRAM_BOT_TOKEN', '')),
            'chat_id':                 read('TELEGRAM_CHAT_ID',   os.getenv('TELEGRAM_CHAT_ID',   '')),
            'default_project_id':      project_id,
            'notify_on_create':        read('TELEGRAM_NOTIFY_ON_CREATE',        os.getenv('TELEGRAM_NOTIFY_ON_CREATE',        'true')) == 'true',
            'notify_on_status_change': read('TELEGRAM_NOTIFY_ON_STATUS_CHANGE', os.getenv('TELEGRAM_NOTIFY_ON_STATUS_CHANGE', 'true')) == 'true',
            'notify_interval_min':     notify_interval,
            'context_minutes':         int(read('TELEGRAM_CONTEXT_MINUTES', '60') or 60),
            'context_max_messages':    int(read('TELEGRAM_CONTEXT_MAX_MESSAGES', '10') or 10),
        }
    except Exception:
        return DEFAULT_CONFIG.copy()


# ---------------------------------------------------------------------------
# Telegram API helpers
# ---------------------------------------------------------------------------

def _base(token: str) -> str:
    return f'https://api.telegram.org/bot{token}'


def _get_updates(token: str, offset: int) -> list:
    try:
        r = requests.get(
            f'{_base(token)}/getUpdates',
            params={'offset': offset, 'timeout': 10},
            timeout=15,
        )
        if r.ok:
            return r.json().get('result', [])
    except Exception:
        pass
    return []


def _send(token: str, chat_id: str, text: str, log_outgoing: bool = True) -> None:
    try:
        requests.post(
            f'{_base(token)}/sendMessage',
            json={'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'},
            timeout=10,
        )
        if log_outgoing:
            _log_telegram_message(chat_id, text, 'outgoing')
    except Exception as e:
        logger.warning('Telegram sendMessage Fehler: %s', e)


def _send_typing(token: str, chat_id: str) -> None:
    try:
        requests.post(
            f'{_base(token)}/sendChatAction',
            json={'chat_id': chat_id, 'action': 'typing'},
            timeout=5,
        )
    except Exception:
        pass


def _typing_loop(token: str, chat_id: str, stop_event: threading.Event) -> None:
    while not stop_event.is_set():
        _send_typing(token, chat_id)
        stop_event.wait(4)


def _register_commands(token: str) -> None:
    """Registriert alle Bot-Befehle bei Telegram (erscheinen bei /-Eingabe)."""
    try:
        requests.post(
            f'{_base(token)}/setMyCommands',
            json={'commands': [{'command': c, 'description': d} for c, d in BOT_COMMANDS]},
            timeout=10,
        )
        logger.info('Telegram Bot-Befehle registriert')
    except Exception as e:
        logger.warning('setMyCommands Fehler: %s', e)


# ---------------------------------------------------------------------------
# Telegram message logging (for KI context)
# ---------------------------------------------------------------------------

def _log_telegram_message(chat_id: str, text: str, direction: str) -> None:
    """Speichert eine Nachricht für den KI-Kontext."""
    try:
        from app import db
        from app.models.telegram_message import TelegramMessage
        msg = TelegramMessage(chat_id=chat_id, text=text[:4000], direction=direction)
        db.session.add(msg)
        db.session.commit()
    except Exception as e:
        logger.warning('TelegramMessage log error: %s', e)


def _build_telegram_context(chat_id: str) -> str:
    """Baut Kontext-String aus den letzten Nachrichten des Chats."""
    try:
        cfg = load_tg_config()
        minutes = cfg.get('context_minutes', 60)
        max_msgs = cfg.get('context_max_messages', 10)
        since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        from app.models.telegram_message import TelegramMessage
        msgs = (
            TelegramMessage.query
            .filter(TelegramMessage.chat_id == chat_id)
            .filter(TelegramMessage.created_at >= since)
            .order_by(TelegramMessage.created_at.desc())
            .limit(max_msgs)
            .all()
        )
        if not msgs:
            return ''
        lines = ['--- Vorherige Nachrichten in diesem Chat ---']
        for m in reversed(msgs):
            direction = 'Du' if m.direction == 'incoming' else 'Bot'
            ts = m.created_at.strftime('%H:%M') if m.created_at else ''
            lines.append(f'[{ts}] {direction}: {m.text[:500]}')
        return '\n'.join(lines)
    except Exception as e:
        logger.warning('build_telegram_context error: %s', e)
        return ''


# ---------------------------------------------------------------------------
# AI helper (inline, identisch zu ai.py _get_ai_reply)
# ---------------------------------------------------------------------------

def _ai_reply(message: str, chat_id: str = None) -> str:
    from app.routes.settings import load_ai_config
    cfg = load_ai_config()
    provider = cfg.get('provider', 'ollama')
    system = (
        'Du bist ein hilfreicher Projektmanagement-Assistent. '
        'Antworte kurz und auf Deutsch. Kein JSON, nur Fließtext.'
    )
    # Chat-Kontext aus letzten Nachrichten hinzufügen
    if chat_id:
        context_text = _build_telegram_context(chat_id)
        if context_text:
            system += '\n\n' + context_text
    messages = [
        {'role': 'system', 'content': system},
        {'role': 'user', 'content': message},
    ]
    if provider == 'claude':
        import anthropic
        client = anthropic.Anthropic(api_key=cfg['claude_api_key'])
        resp = client.messages.create(
            model=cfg['claude_model'],
            max_tokens=512,
            system=system,
            messages=[{'role': 'user', 'content': message}],
        )
        return resp.content[0].text
    else:
        r = requests.post(
            f'{cfg["ollama_url"]}/api/chat',
            json={'model': cfg['ollama_model'], 'messages': messages, 'stream': False},
            timeout=120,
        )
        r.raise_for_status()
        return r.json()['message']['content']


# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------

def _cmd_hilfe(token: str, chat_id: str) -> None:
    text = (
        '🤖 <b>Axion Bot – Befehle</b>\n\n'
        '/issue &lt;Titel&gt; – Neues Issue erstellen\n'
        '/bug &lt;Titel&gt; – Bug melden (Priorität: Hoch)\n'
        '/issues – Letzte offene Issues anzeigen\n'
        '/done &lt;ID&gt; – Issue als erledigt markieren\n'
        '/suche &lt;Begriff&gt; – Issues durchsuchen\n'
        '/status – Projektstatistik\n'
        '/ki &lt;Frage&gt; – KI-Assistent fragen\n'
        '/confirm &lt;AgentID&gt; – Agent-Aktion bestätigen\n'
        '/deny &lt;AgentID&gt; – Agent-Aktion ablehnen\n'
        '/hilfe – Diese Hilfe anzeigen\n\n'
        '💡 Oder einfach eine Frage schreiben – die KI antwortet direkt.'
    )
    _send(token, chat_id, text)


def _cmd_issue(token: str, chat_id: str, titel: str, issue_type: str = 'task', priority: str = 'medium') -> None:
    if not titel.strip():
        _send(token, chat_id, '⚠ Bitte einen Titel angeben: /issue Mein Titel')
        return
    cfg = load_tg_config()
    project_id = cfg.get('default_project_id')
    if not project_id:
        _send(token, chat_id, '⚠ Kein Standard-Projekt konfiguriert. Bitte in den Admin-Einstellungen hinterlegen.')
        return
    try:
        from app import db
        from app.models.issue import Issue
        from app.models.user import User
        admin = User.query.filter_by(is_admin=True).first()
        creator_id = admin.id if admin else 1
        issue = Issue(
            project_id=int(project_id),
            title=titel.strip(),
            status='open',
            priority=priority,
            type=issue_type,
            creator_id=creator_id,
        )
        db.session.add(issue)
        db.session.commit()
        type_label = '🐛 Bug' if issue_type == 'bug' else '📌 Task'
        _send(token, chat_id, f'✅ {type_label} <b>#{issue.id}</b> erstellt: „{issue.title}"')
    except Exception as e:
        logger.error('Telegram /issue Fehler: %s', e)
        _send(token, chat_id, f'❌ Fehler beim Erstellen: {e}')


def _cmd_issues(token: str, chat_id: str) -> None:
    try:
        from app.models.issue import Issue
        issues = (
            Issue.query
            .filter(Issue.status.notin_(['done', 'cancelled']))
            .order_by(Issue.created_at.desc())
            .limit(5)
            .all()
        )
        if not issues:
            _send(token, chat_id, 'Keine offenen Issues gefunden.')
            return
        lines = ['📋 <b>Offene Issues:</b>']
        for iss in issues:
            prio = PRIORITY_LABELS.get(iss.priority, iss.priority)
            status = STATUS_LABELS.get(iss.status, iss.status)
            lines.append(f'#{iss.id} [{prio}] {iss.title} – {status}')
        _send(token, chat_id, '\n'.join(lines))
    except Exception as e:
        logger.error('Telegram /issues Fehler: %s', e)
        _send(token, chat_id, f'❌ Fehler: {e}')


def _cmd_done(token: str, chat_id: str, arg: str) -> None:
    arg = arg.strip()
    if not arg.isdigit():
        _send(token, chat_id, '⚠ Bitte eine Issue-ID angeben: /done 42')
        return
    try:
        from app import db
        from app.models.issue import Issue
        issue = Issue.query.get(int(arg))
        if not issue:
            _send(token, chat_id, f'❌ Issue #{arg} nicht gefunden.')
            return
        # Story-Constraint prüfen
        if issue.type == 'story':
            subtasks = Issue.query.filter_by(parent_id=issue.id).all()
            incomplete = [s for s in subtasks if s.status not in ('done', 'cancelled')]
            if incomplete:
                _send(token, chat_id,
                      f'⚠ Story #{issue.id} hat noch {len(incomplete)} offene Unteraufgaben.')
                return
        issue.status = 'done'
        db.session.commit()
        _send(token, chat_id, f'✅ Issue <b>#{issue.id}</b> „{issue.title}" als erledigt markiert.')
    except Exception as e:
        logger.error('Telegram /done Fehler: %s', e)
        _send(token, chat_id, f'❌ Fehler: {e}')


def _cmd_suche(token: str, chat_id: str, query: str) -> None:
    if not query.strip():
        _send(token, chat_id, '⚠ Bitte einen Suchbegriff angeben: /suche Docker')
        return
    try:
        from app.models.issue import Issue
        results = (
            Issue.query
            .filter(Issue.title.ilike(f'%{query.strip()}%'))
            .order_by(Issue.created_at.desc())
            .limit(5)
            .all()
        )
        if not results:
            _send(token, chat_id, f'Keine Issues gefunden für „{query}".')
            return
        lines = [f'🔍 <b>Suchergebnisse für „{query}":</b>']
        for iss in results:
            status = STATUS_LABELS.get(iss.status, iss.status)
            lines.append(f'#{iss.id} {iss.title} – {status}')
        _send(token, chat_id, '\n'.join(lines))
    except Exception as e:
        logger.error('Telegram /suche Fehler: %s', e)
        _send(token, chat_id, f'❌ Fehler: {e}')


def _cmd_status(token: str, chat_id: str) -> None:
    try:
        from sqlalchemy import func
        from app import db
        from app.models.issue import Issue
        rows = db.session.query(Issue.status, func.count(Issue.id)).group_by(Issue.status).all()
        total = sum(c for _, c in rows)
        lines = ['📊 <b>Projektstatistik:</b>']
        order = ['open', 'in_progress', 'in_review', 'done', 'cancelled']
        counts = {status: count for status, count in rows}
        for s in order:
            if s in counts:
                label = STATUS_LABELS.get(s, s)
                lines.append(f'{label}: {counts[s]}')
        lines.append(f'\nGesamt: {total} Issues')
        _send(token, chat_id, '\n'.join(lines))
    except Exception as e:
        logger.error('Telegram /status Fehler: %s', e)
        _send(token, chat_id, f'❌ Fehler: {e}')


def _cmd_ki(token: str, chat_id: str, frage: str) -> None:
    """KI-Assistent mit vollständigem Aktions-Support (create_issue, save_memory, read_memory, etc.)"""
    if not frage.strip():
        _send(token, chat_id, '⚠ Bitte eine Frage angeben: /ki Was sind offene Bugs?')
        return
    stop_typing = threading.Event()
    threading.Thread(target=_typing_loop, args=(token, chat_id, stop_typing), daemon=True).start()
    try:
        import json as _json
        import os as _os
        from datetime import date as _date, timedelta
        from flask import current_app
        from app.models.user import User
        from app.models.issue import Issue
        from app.routes.ai import (
            SYSTEM_PROMPT_TEMPLATE, _get_ai_reply, _fetch_context_for_ai,
            _execute_action, _execute_python_script_action, _execute_ki_agent_action,
        )

        # System-User für Aktionsausführung
        admin = User.query.filter_by(is_admin=True).first()
        user_id = admin.id if admin else 1

        # Vollständigen System-Prompt aufbauen
        today = _date.today()
        next_week = (today + timedelta(days=7)).isoformat()
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            date=today.isoformat(),
            user_name=f'Telegram ({admin.name if admin else "Bot"})',
            user_id=user_id,
            next_week=next_week,
        )

        # Projekt-Kontext
        cfg = load_tg_config()
        project_id = cfg.get('default_project_id')
        action_context = {'project_id': project_id}
        context_parts = []

        if project_id:
            from app.models.project import Project
            proj = Project.query.get(project_id)
            if proj:
                context_parts.append(f'Aktuelles Projekt: {proj.name} (ID: {project_id})')
            issues = Issue.query.filter_by(project_id=project_id).all()
            if issues:
                lines = ['Issues im Projekt:']
                for iss in issues:
                    lines.append(f'  #{iss.id} [{iss.status}] [{iss.priority}] {iss.title}')
                context_parts.append('\n'.join(lines))

        # Chat-Workspace: anweisungen.md immer laden, andere Dateien als Namen listen
        try:
            workspace_dir = _os.path.join(current_app.instance_path, 'chat-workspace')
            if _os.path.isdir(workspace_dir):
                anw_path = _os.path.join(workspace_dir, 'anweisungen.md')
                if _os.path.isfile(anw_path):
                    with open(anw_path, 'r', encoding='utf-8') as f:
                        anw = f.read().strip()
                    if anw:
                        system_prompt += f'\n\n## Deine Anweisungen (anweisungen.md)\n{anw}'
                mem_files = [fn for fn in _os.listdir(workspace_dir)
                             if fn != 'anweisungen.md'
                             and _os.path.splitext(fn)[1].lower() in ('.md', '.txt', '.csv')]
                if mem_files:
                    context_parts.append('Verfügbare Memories (per read_memory lesbar): ' + ', '.join(sorted(mem_files)))
        except Exception:
            pass

        # Telegram-Chatverlauf als Kontext
        ctx_text = _build_telegram_context(chat_id)
        if ctx_text:
            context_parts.append(ctx_text)

        system_content = system_prompt
        if context_parts:
            system_content += '\n\n' + '\n\n'.join(context_parts)

        messages = [
            {'role': 'system', 'content': system_content},
            {'role': 'user', 'content': frage},
        ]

        from app.services.ki_agent_service import _parse_ai_json as _parse_json

        raw = _get_ai_reply(messages)
        ai_resp = _parse_json(raw)

        reply = ai_resp.get('reply') or raw
        action = ai_resp.get('action')

        READ_ACTIONS = (
            'read_wiki_page', 'search_wiki', 'search_issues', 'list_projects', 'list_wiki_pages',
            'read_issue', 'read_script_output', 'read_agent_output', 'read_memory',
        )
        SCRIPT_ACTIONS = ('create_python_script', 'run_python_script')
        KI_AGENT_ACTIONS_TG = ('create_ki_agent', 'run_ki_agent', 'save_memory')

        def dispatch(act):
            t = act.get('type')
            if t in SCRIPT_ACTIONS:
                return _execute_python_script_action(t, act.get('data') or {}, action_context)
            if t in KI_AGENT_ACTIONS_TG:
                return _execute_ki_agent_action(t, act.get('data') or {}, action_context)
            return _execute_action(act, user_id, action_context)

        # Zweistufig für Lese-Aktionen
        if action and isinstance(action, dict) and action.get('type') in READ_ACTIONS:
            fetched = _fetch_context_for_ai(action)
            if fetched:
                messages.append({'role': 'assistant', 'content': raw})
                messages.append({'role': 'user', 'content': f'[Abgerufene Daten]:\n{fetched}\n\nBeantworte nun die Frage auf Basis dieser Informationen.'})
                raw2 = _get_ai_reply(messages)
                ai_resp2 = _parse_json(raw2)
                reply = ai_resp2.get('reply') or raw2
                action = None

        # Aktions-Loop (bis zu 14 Folgeaktionen = 15 gesamt)
        if action and isinstance(action, dict) and action.get('type') not in (None, 'none'):
            dispatch(action)
            for _ in range(14):
                messages.append({'role': 'assistant', 'content': raw})
                follow = f'Aktion abgeschlossen: {_json.dumps(ai_resp.get("action") or {}, ensure_ascii=False)}. Führe alle weiteren nötigen Aktionen aus. Wenn alles erledigt ist, antworte mit action: null.'
                messages.append({'role': 'user', 'content': follow})
                try:
                    raw = _get_ai_reply(messages)
                except Exception:
                    break
                ai_resp = _parse_json(raw)
                next_action = ai_resp.get('action')
                if not next_action or not isinstance(next_action, dict):
                    break
                if next_action.get('type') in (None, 'none'):
                    break
                if next_action.get('type') in READ_ACTIONS:
                    fetched = _fetch_context_for_ai(next_action)
                    if fetched:
                        messages.append({'role': 'assistant', 'content': raw})
                        messages.append({'role': 'user', 'content': f'[Abgerufene Daten]:\n{fetched}\n\nFahre fort.'})
                        try:
                            raw = _get_ai_reply(messages)
                        except Exception:
                            break
                        ai_resp = _parse_json(raw)
                else:
                    dispatch(next_action)
                reply = ai_resp.get('reply') or reply

        _send(token, chat_id, f'🤖 {reply}')
    except Exception as e:
        logger.error('Telegram KI Fehler: %s', e)
        _send(token, chat_id, f'❌ KI-Fehler: {e}')
    finally:
        stop_typing.set()


# ---------------------------------------------------------------------------
# Human-in-the-Loop command handlers
# ---------------------------------------------------------------------------

def _cmd_agent_confirm(token: str, chat_id: str, arg: str) -> None:
    arg = arg.strip()
    if not arg.isdigit():
        _send(token, chat_id, '⚠ Bitte eine Agent-ID angeben: /confirm 3')
        return
    try:
        import requests as http
        resp = http.post(
            f'http://localhost:5050/api/ki-agents/{arg}/confirm',
            timeout=10,
        )
        if resp.ok and resp.json().get('ok'):
            _send(token, chat_id, f'✅ Aktion bestätigt für Agent #{arg}.')
        else:
            _send(token, chat_id, f'⚠ Keine ausstehende Aktion für Agent #{arg} oder bereits abgeschlossen.')
    except Exception as e:
        _send(token, chat_id, f'❌ Fehler: {e}')


def _cmd_agent_deny(token: str, chat_id: str, arg: str) -> None:
    arg = arg.strip()
    if not arg.isdigit():
        _send(token, chat_id, '⚠ Bitte eine Agent-ID angeben: /deny 3')
        return
    try:
        import requests as http
        resp = http.post(
            f'http://localhost:5050/api/ki-agents/{arg}/deny',
            timeout=10,
        )
        if resp.ok and resp.json().get('ok'):
            _send(token, chat_id, f'🚫 Aktion abgelehnt für Agent #{arg}.')
        else:
            _send(token, chat_id, f'⚠ Keine ausstehende Aktion für Agent #{arg} oder bereits abgeschlossen.')
    except Exception as e:
        _send(token, chat_id, f'❌ Fehler: {e}')


# ---------------------------------------------------------------------------
# Message dispatcher
# ---------------------------------------------------------------------------

def _handle(msg: dict, token: str, chat_id: str) -> None:
    text = (msg.get('text') or '').strip()
    if not text:
        return
    # Log incoming message for KI context
    _log_telegram_message(chat_id, text, 'incoming')
    if text.startswith('/hilfe') or text == '/start':
        _cmd_hilfe(token, chat_id)
    elif text.startswith('/issue '):
        _cmd_issue(token, chat_id, text[7:])
    elif text == '/issue':
        _send(token, chat_id, '⚠ Bitte einen Titel angeben: /issue Mein Titel')
    elif text.startswith('/bug '):
        _cmd_issue(token, chat_id, text[5:], issue_type='bug', priority='high')
    elif text == '/bug':
        _send(token, chat_id, '⚠ Bitte eine Beschreibung angeben: /bug Login funktioniert nicht')
    elif text == '/issues':
        _cmd_issues(token, chat_id)
    elif text.startswith('/done '):
        _cmd_done(token, chat_id, text[6:])
    elif text == '/done':
        _send(token, chat_id, '⚠ Bitte eine Issue-ID angeben: /done 42')
    elif text.startswith('/suche '):
        _cmd_suche(token, chat_id, text[7:])
    elif text == '/suche':
        _send(token, chat_id, '⚠ Bitte einen Suchbegriff angeben: /suche Docker')
    elif text == '/status':
        _cmd_status(token, chat_id)
    elif text.startswith('/ki '):
        _cmd_ki(token, chat_id, text[4:])
    elif text == '/ki':
        _send(token, chat_id, '⚠ Bitte eine Frage angeben: /ki Was sind offene Bugs?')
    elif text.startswith('/confirm '):
        _cmd_agent_confirm(token, chat_id, text[9:].strip())
    elif text.startswith('/deny '):
        _cmd_agent_deny(token, chat_id, text[6:].strip())
    elif not text.startswith('/'):
        _cmd_ki(token, chat_id, text)
    else:
        _send(token, chat_id, '❓ Unbekannter Befehl. Tippe /hilfe für eine Übersicht.')


# ---------------------------------------------------------------------------
# Notification flush loop (Batching)
# ---------------------------------------------------------------------------

def _flush_loop() -> None:
    """Sendet gesammelte Benachrichtigungen alle N Minuten als eine Nachricht."""
    global _last_flush
    _last_flush = time.time()
    while _running:
        time.sleep(60)
        if not _running:
            break
        cfg = load_tg_config()
        interval_min = cfg.get('notify_interval_min', 5)
        if interval_min <= 0:
            _last_flush = time.time()
            continue
        elapsed = time.time() - _last_flush
        if elapsed < interval_min * 60:
            continue
        with _notify_lock:
            if not _notify_queue:
                _last_flush = time.time()
                continue
            msgs = list(_notify_queue)
            _notify_queue.clear()
        _last_flush = time.time()
        token = cfg.get('bot_token', '')
        chat_id = str(cfg.get('chat_id', ''))
        if not token or not chat_id:
            continue
        combined = '\n\n'.join(msgs)
        count = len(msgs)
        header = f'📬 <b>{count} Benachrichtigung{"en" if count > 1 else ""}</b>\n\n'
        _send(token, chat_id, header + combined, log_outgoing=False)


# ---------------------------------------------------------------------------
# Polling loop
# ---------------------------------------------------------------------------

def _poll(app) -> None:
    offset = 0
    while _running:
        cfg = load_tg_config()
        token = cfg.get('bot_token', '')
        chat_id = str(cfg.get('chat_id', ''))
        if not token or not chat_id:
            time.sleep(5)
            continue
        updates = _get_updates(token, offset)
        for upd in updates:
            offset = upd['update_id'] + 1
            msg = upd.get('message') or {}
            if str(msg.get('chat', {}).get('id', '')) != chat_id:
                continue
            with app.app_context():
                _handle(msg, token, chat_id)
        time.sleep(1)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def start(app) -> None:
    global _thread, _running, _app
    if _running:
        return
    _app = app
    _running = True
    _thread = threading.Thread(target=_poll, args=(app,), daemon=True, name='telegram-bot')
    _thread.start()
    threading.Thread(target=_flush_loop, daemon=True, name='telegram-flush').start()
    # Befehle mit kurzem Delay registrieren (sicherstellen dass Token gültig ist)
    cfg = load_tg_config()
    if cfg.get('bot_token'):
        def _delayed_register():
            time.sleep(2)
            _register_commands(cfg['bot_token'])
        threading.Thread(target=_delayed_register, daemon=True).start()
    logger.info('Telegram Bot gestartet')


def stop() -> None:
    global _running
    _running = False
    logger.info('Telegram Bot gestoppt')


def restart(app) -> None:
    stop()
    time.sleep(1.5)
    start(app)


def notify(text: str) -> None:
    """Reiht eine Benachrichtigung in die Queue ein (wird gesammelt gesendet).
    Bei notify_interval_min=0 wird sofort gesendet."""
    cfg = load_tg_config()
    token = cfg.get('bot_token', '')
    chat_id = str(cfg.get('chat_id', ''))
    if not token or not chat_id:
        return
    interval = cfg.get('notify_interval_min', 5)
    if interval == 0:
        threading.Thread(target=_send, args=(token, chat_id, text), daemon=True).start()
        return
    with _notify_lock:
        _notify_queue.append(text)
