import json
import os
import threading
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_login import login_required
from app import db
from app.models.ki_agent import KiAgent, KiAgentRun

bp = Blueprint('ki_agents', __name__)


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
