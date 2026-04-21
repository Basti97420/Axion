import json
import os
import threading
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_login import login_required
from app import db
from app.models.ki_agent import KiAgent, KiAgentRun

bp = Blueprint('ki_agents', __name__)

# ---------------------------------------------------------------------------
# Standard-Agenten Prompts
# ---------------------------------------------------------------------------

_BIBLIOTEKAR_PROMPT = """Du bist der Bibliotekar für dieses Projekt. Deine Aufgabe ist die wöchentliche Pflege der Knowledge-Base.

Führe folgende Schritte durch:
1. Liste alle Knowledge-Seiten auf (list_wiki_pages).
2. Lies jede Seite und suche nach [[Wiki-Links]] — prüfe, ob die Zielseite existiert.
3. Finde Seiten, die von keiner anderen Seite verlinkt werden (verwaist).
4. Erstelle oder aktualisiere die Seite "Bibliotheks-Status" mit:
   - Geprüft am: {heutiges Datum}
   - Seiten gesamt
   - Defekte Links: Seite → fehlender Zielname
   - Verwaiste Seiten (niemand verlinkt auf sie)
   - Empfehlungen (fehlende Kategorien, unklare Titel, Duplikate)
5. Sende eine kurze Zusammenfassung per Telegram.

Wichtig: Ändere keine Seiteninhalte — nur den Bibliotheks-Status-Report."""

_WOCHENBERICHT_FREITAG_PROMPT = """Du bist der Wochenbericht-Agent. Heute ist Freitag — erstelle den Wochenschluss-Bericht.

Schritte:
1. Suche Issues mit Status 'done' oder 'cancelled' (diese Woche abgeschlossen).
2. Suche Issues, die diese Woche neu erstellt wurden.
3. Prüfe offene Meilensteine und ihren Fortschritt.
4. Identifiziere kritische oder überfällige Issues, die noch offen sind.
5. Erstelle die Knowledge-Seite "Wochenbericht KW {KW}" (oder aktualisiere sie) mit:

   ## ✅ Diese Woche erledigt
   {Liste abgeschlossener Issues mit ID und Titel}

   ## 🆕 Neu erstellt
   {Liste neuer Issues}

   ## 📊 Meilenstein-Fortschritt
   {Offene Meilensteine, wie viele Issues offen/done}

   ## ⚠️ Offene Probleme
   {Kritische oder überfällige Issues}

6. Sende Telegram-Highlight (max. 5 Punkte, knapp und klar)."""

_WOCHENBERICHT_MONTAG_PROMPT = """Du bist der Planungs-Agent. Heute ist Montag — erstelle das Wochen-Briefing.

Schritte:
1. Suche alle offenen Issues (open, in_progress, in_review, hold).
2. Identifiziere überfällige Issues (due_date in der Vergangenheit).
3. Finde Issues ohne Zuweisung (kein Assignee).
4. Prüfe, welche Meilensteine diese Woche fällig sind.
5. Erstelle die Knowledge-Seite "Wochen-Briefing KW {KW}" mit:

   ## 🔥 Kritisch / Sofort
   {Issues mit Priorität critical oder high}

   ## ⏰ Überfällig
   {Issues mit abgelaufenem Fälligkeitsdatum}

   ## 👤 Nicht zugewiesen
   {Issues ohne Assignee}

   ## 🎯 Diese Woche fällig
   {Meilensteine und Issues bis Freitag}

   ## 📋 Alle offenen Issues (nach Priorität)
   {Vollständige Liste}

6. Sende Telegram-Briefing mit den wichtigsten Punkten."""

_ISSUES_BETREUER_PROMPT = """Du bist der Issues-Betreuer. Täglich prüfst du alle Issues und hältst sie aktuell.

Schritte:
1. Suche alle offenen Issues des Projekts.
2. Analysiere und kategorisiere:
   - Überfällig: due_date überschritten, Status nicht done/cancelled
   - Ohne Zuweisung: kein Assignee gesetzt
   - Bugs ohne Meilenstein: type=bug, keine milestone_id
   - Sehr alte offene Issues (lange keine Änderung sichtbar)
3. Aktionen die du ausführen darfst:
   - Priorität erhöhen: Überfällige Bugs → auf 'high' oder 'critical' setzen (update_issue)
   - Meilenstein anlegen: Wenn mehrere zusammengehörige Issues ohne Meilenstein existieren (create_milestone)
   - Nachfragen per Telegram: Bei unklaren Issues (fehlende Beschreibung, kein Typ, keine Priorität)
     Beispiel: "Issues-Betreuer: Issue #42 'X' hat keine Priorität — Bug oder Task?"
4. Sende Telegram-Zusammenfassung:
   - Geprüfte Issues gesamt
   - Durchgeführte Änderungen (Prioritäten, Meilensteine)
   - Offene Rückfragen

Konservativ vorgehen: Nur klare Fälle ändern, bei Unsicherheit lieber nachfragen."""


def _next_weekday(weekday: int, hour: int) -> datetime:
    """Nächste UTC-Zeit für gegebenen Wochentag (0=Mo, 6=So) um hour:00."""
    now = datetime.utcnow()
    days = (weekday - now.weekday()) % 7 or 7  # mindestens 1 Tag in der Zukunft
    return (now + timedelta(days=days)).replace(hour=hour, minute=0, second=0, microsecond=0)


@bp.get('/api/projects/<int:project_id>/ki-agents')
@login_required
def list_agents(project_id):
    agents = KiAgent.query.filter_by(project_id=project_id).order_by(KiAgent.created_at).all()
    return jsonify([a.to_dict() for a in agents])


@bp.post('/api/projects/<int:project_id>/ki-agents')
@login_required
def create_agent(project_id):
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name fehlt'}), 400
    schedule_days_raw = data.get('schedule_days')
    agent = KiAgent(
        project_id=project_id,
        name=name,
        api_provider=data.get('api_provider', 'global'),
        api_url=data.get('api_url', ''),
        api_model=data.get('api_model', ''),
        api_key=data.get('api_key', ''),
        schedule_type=data.get('schedule_type', 'manual'),
        interval_min=int(data.get('interval_min') or 60),
        schedule_days=json.dumps(schedule_days_raw) if schedule_days_raw else None,
        website_url=data.get('website_url', ''),
        is_active=data.get('is_active', True),
        dry_run=data.get('dry_run', False),
        notify_telegram=data.get('notify_telegram', False),
        retry_on_error=data.get('retry_on_error', False),
        retry_max=int(data.get('retry_max') or 3),
        retry_delay_min=int(data.get('retry_delay_min') or 5),
        role=data.get('role', 'maker'),
    )
    db.session.add(agent)
    db.session.commit()
    return jsonify(agent.to_dict()), 201


@bp.get('/api/ki-agents/<int:agent_id>')
@login_required
def get_agent(agent_id):
    agent = db.get_or_404(KiAgent, agent_id)
    return jsonify(agent.to_dict())


@bp.put('/api/ki-agents/<int:agent_id>')
@login_required
def update_agent(agent_id):
    agent = db.get_or_404(KiAgent, agent_id)
    data = request.get_json() or {}
    for field in ('name', 'api_provider', 'api_url', 'api_model', 'website_url',
                  'schedule_type', 'is_active', 'dry_run', 'notify_telegram',
                  'retry_on_error', 'retry_max', 'retry_delay_min', 'role'):
        if field in data:
            setattr(agent, field, data[field])
    if 'interval_min' in data:
        agent.interval_min = int(data['interval_min'] or 60)
    if 'api_key' in data and data['api_key'] != '***':
        agent.api_key = data['api_key']
    if 'schedule_days' in data:
        v = data['schedule_days']
        agent.schedule_days = json.dumps(v) if v else None
    db.session.commit()
    return jsonify(agent.to_dict())


@bp.delete('/api/ki-agents/<int:agent_id>')
@login_required
def delete_agent(agent_id):
    agent = db.get_or_404(KiAgent, agent_id)
    db.session.delete(agent)
    db.session.commit()
    return jsonify({'ok': True})


@bp.post('/api/ki-agents/<int:agent_id>/run')
@login_required
def run_agent_endpoint(agent_id):
    from flask import current_app
    agent = db.get_or_404(KiAgent, agent_id)
    from app.services.ki_agent_service import run_agent
    run = KiAgentRun(agent_id=agent.id, triggered_by='manual')
    db.session.add(run)
    db.session.commit()
    run_id = run.id
    app = current_app._get_current_object()
    threading.Thread(target=run_agent, args=(app, agent.id, run_id), daemon=True).start()
    return jsonify({'run_id': run_id, 'status': 'started'})


@bp.get('/api/ki-agents/<int:agent_id>/runs')
@login_required
def get_runs(agent_id):
    db.get_or_404(KiAgent, agent_id)
    runs = KiAgentRun.query.filter_by(agent_id=agent_id)\
        .order_by(KiAgentRun.started_at.desc()).limit(20).all()
    return jsonify([r.to_dict() for r in runs])


def _agent_workspace_dir(agent):
    from app.services.ki_agent_service import _get_workspace_dir
    return _get_workspace_dir(agent)


@bp.get('/api/ki-agents/<int:agent_id>/files')
@login_required
def list_files(agent_id):
    agent = db.get_or_404(KiAgent, agent_id)
    workspace_dir = _agent_workspace_dir(agent)
    if not os.path.isdir(workspace_dir):
        return jsonify([])
    files = []
    for fname in sorted(os.listdir(workspace_dir)):
        if os.path.splitext(fname)[1].lower() in ('.md', '.txt', '.csv'):
            fpath = os.path.join(workspace_dir, fname)
            stat = os.stat(fpath)
            files.append({
                'filename': fname,
                'size': stat.st_size,
                'modified_at': stat.st_mtime,
            })
    return jsonify(files)


@bp.get('/api/ki-agents/<int:agent_id>/files/<path:filename>')
@login_required
def download_file(agent_id, filename):
    from werkzeug.utils import secure_filename
    agent = db.get_or_404(KiAgent, agent_id)
    safe_name = secure_filename(filename)
    workspace_dir = _agent_workspace_dir(agent)
    fpath = os.path.join(workspace_dir, safe_name)
    if not os.path.isfile(fpath):
        return jsonify({'error': 'Datei nicht gefunden'}), 404
    return send_file(fpath, as_attachment=False, download_name=safe_name)


@bp.delete('/api/ki-agents/<int:agent_id>/files/<path:filename>')
@login_required
def delete_file(agent_id, filename):
    from werkzeug.utils import secure_filename
    agent = db.get_or_404(KiAgent, agent_id)
    safe_name = secure_filename(filename)
    workspace_dir = _agent_workspace_dir(agent)
    fpath = os.path.join(workspace_dir, safe_name)
    if not os.path.isfile(fpath):
        return jsonify({'error': 'Datei nicht gefunden'}), 404
    os.remove(fpath)
    return jsonify({'ok': True})


@bp.get('/api/ki-agents/<int:agent_id>/prompt')
@login_required
def get_prompt(agent_id):
    """Liest agenten.md aus dem Workspace und gibt den Inhalt zurück."""
    agent = db.get_or_404(KiAgent, agent_id)
    workspace_dir = _agent_workspace_dir(agent)
    fpath = os.path.join(workspace_dir, 'agenten.md')
    if not os.path.isfile(fpath):
        return jsonify({'content': ''})
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            return jsonify({'content': f.read()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.put('/api/ki-agents/<int:agent_id>/prompt')
@login_required
def save_prompt(agent_id):
    """Schreibt agenten.md in den Workspace des Agenten."""
    agent = db.get_or_404(KiAgent, agent_id)
    data = request.get_json() or {}
    content = data.get('content', '')
    workspace_dir = _agent_workspace_dir(agent)
    os.makedirs(workspace_dir, exist_ok=True)
    fpath = os.path.join(workspace_dir, 'agenten.md')
    try:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Human-in-the-Loop: Telegram-Bot pollt damit
@bp.get('/api/ki-agents/<int:agent_id>/pending-confirmation')
def get_pending_confirmation(agent_id):
    """Gibt den aktuellen pending_confirmation-Status zurück."""
    agent = db.get_or_404(KiAgent, agent_id)
    return jsonify({'pending_confirmation': agent.pending_confirmation or ''})


# Human-in-the-Loop: Telegram-Bot ruft diese auf
@bp.post('/api/ki-agents/<int:agent_id>/confirm')
def confirm_pending(agent_id):
    """Bestätigt eine ausstehende Aktion (vom Telegram-Bot aufgerufen)."""
    agent = db.get_or_404(KiAgent, agent_id)
    if not agent.pending_confirmation:
        return jsonify({'ok': False, 'error': 'Keine ausstehende Bestätigung'})
    confirmed_action = agent.pending_confirmation
    agent.pending_confirmation = None
    db.session.commit()
    return jsonify({'ok': True, 'confirmed': confirmed_action})


@bp.post('/api/ki-agents/<int:agent_id>/deny')
def deny_pending(agent_id):
    """Verweigert eine ausstehende Aktion (vom Telegram-Bot aufgerufen)."""
    agent = db.get_or_404(KiAgent, agent_id)
    if not agent.pending_confirmation:
        return jsonify({'ok': False, 'error': 'Keine ausstehende Bestätigung'})
    denied_action = agent.pending_confirmation
    agent.pending_confirmation = None
    db.session.commit()
    return jsonify({'ok': True, 'denied': denied_action})


@bp.post('/api/projects/<int:project_id>/ki-agents/setup-standard')
@login_required
def setup_standard_agents(project_id):
    """Legt die vier Standard-Agenten für ein Projekt an (überspringt vorhandene)."""
    existing_names = {a.name for a in KiAgent.query.filter_by(project_id=project_id).all()}

    tomorrow_9 = (datetime.utcnow() + timedelta(days=1)).replace(
        hour=9, minute=0, second=0, microsecond=0
    )

    configs = [
        {
            'name': 'Bibliotekar',
            'schedule_days': json.dumps([6]),   # Sonntag
            'next_run_at': _next_weekday(6, 10),
            'prompt': _BIBLIOTEKAR_PROMPT,
            'retry_on_error': False,
        },
        {
            'name': 'Wochenbericht (Freitag)',
            'schedule_days': json.dumps([4]),   # Freitag
            'next_run_at': _next_weekday(4, 17),
            'prompt': _WOCHENBERICHT_FREITAG_PROMPT,
            'retry_on_error': False,
        },
        {
            'name': 'Wochenbericht (Montag)',
            'schedule_days': json.dumps([0]),   # Montag
            'next_run_at': _next_weekday(0, 8),
            'prompt': _WOCHENBERICHT_MONTAG_PROMPT,
            'retry_on_error': False,
        },
        {
            'name': 'Issues-Betreuer',
            'schedule_days': None,              # täglich
            'next_run_at': tomorrow_9,
            'prompt': _ISSUES_BETREUER_PROMPT,
            'retry_on_error': True,
        },
    ]

    created = []
    for cfg in configs:
        if cfg['name'] in existing_names:
            continue
        agent = KiAgent(
            project_id=project_id,
            name=cfg['name'],
            schedule_type='interval',
            interval_min=1440,
            schedule_days=cfg['schedule_days'],
            next_run_at=cfg['next_run_at'],
            role='maker',
            notify_telegram=True,
            is_active=True,
            retry_on_error=cfg['retry_on_error'],
            retry_max=3,
            retry_delay_min=5,
        )
        db.session.add(agent)
        db.session.flush()  # ID generieren

        # agenten.md in Workspace schreiben
        workspace_dir = _agent_workspace_dir(agent)
        os.makedirs(workspace_dir, exist_ok=True)
        prompt_path = os.path.join(workspace_dir, 'agenten.md')
        with open(prompt_path, 'w', encoding='utf-8') as f:
            f.write(cfg['prompt'])

        created.append(agent.to_dict())

    db.session.commit()
    return jsonify({'created': created, 'skipped': len(configs) - len(created)}), 201
