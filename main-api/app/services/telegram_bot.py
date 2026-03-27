"""
Telegram Bot Service – Polling-basiert, kein externes Package nötig (nutzt requests).
Öffentliche API: start(app), stop(), restart(app), notify(text)
"""
import logging
import os
import threading
import time
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
    'open': 'Offen', 'in_progress': 'In Arbeit', 'in_review': 'Im Review',
    'done': 'Erledigt', 'cancelled': 'Abgebrochen',
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


def _send(token: str, chat_id: str, text: str) -> None:
    try:
        requests.post(
            f'{_base(token)}/sendMessage',
            json={'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'},
            timeout=10,
        )
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
# AI helper (inline, identisch zu ai.py _get_ai_reply)
# ---------------------------------------------------------------------------

def _ai_reply(message: str) -> str:
    from app.routes.settings import load_ai_config
    cfg = load_ai_config()
    provider = cfg.get('provider', 'ollama')
    system = (
        'Du bist ein hilfreicher Projektmanagement-Assistent. '
        'Antworte kurz und auf Deutsch. Kein JSON, nur Fließtext.'
    )
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
    if not frage.strip():
        _send(token, chat_id, '⚠ Bitte eine Frage angeben: /ki Was sind offene Bugs?')
        return
    stop_typing = threading.Event()
    threading.Thread(target=_typing_loop, args=(token, chat_id, stop_typing), daemon=True).start()
    try:
        from app.models.issue import Issue
        issues = Issue.query.filter(Issue.status.notin_(['done', 'cancelled'])).all()
        context = 'Offene Issues im System:\n' + '\n'.join(
            f'  #{i.id} [{i.status}][{i.priority}] {i.title}' for i in issues
        ) if issues else 'Keine offenen Issues.'
        full_message = f'{context}\n\nFrage: {frage}'
        reply = _ai_reply(full_message)
        _send(token, chat_id, f'🤖 {reply}')
    except Exception as e:
        logger.error('Telegram /ki Fehler: %s', e)
        _send(token, chat_id, f'❌ KI-Fehler: {e}')
    finally:
        stop_typing.set()


# ---------------------------------------------------------------------------
# Message dispatcher
# ---------------------------------------------------------------------------

def _handle(msg: dict, token: str, chat_id: str) -> None:
    text = (msg.get('text') or '').strip()
    if not text:
        return
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
        _send(token, chat_id, header + combined)


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
