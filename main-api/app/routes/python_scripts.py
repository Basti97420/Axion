import os
import threading
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required
from werkzeug.utils import secure_filename
from app import db
from app.models.python_script import PythonScript, PythonScriptRun


def _script_workspace_dir(script):
    from slugify import slugify
    slug = slugify(script.name or 'script', max_length=40)
    return os.path.join(current_app.instance_path, 'python-scripts',
                        str(script.project_id), f"{script.id}-{slug}")

bp = Blueprint('python_scripts', __name__)
internal_bp = Blueprint('internal_scripts', __name__)


# ---------------------------------------------------------------------------
# Hilfsfunktion: Token-Prüfung für interne Endpoints
# ---------------------------------------------------------------------------

def _check_internal_token():
    from app.services.python_script_service import _get_script_token
    token = request.headers.get('X-Script-Token', '')
    return token and token == _get_script_token()


# ---------------------------------------------------------------------------
# Script CRUD
# ---------------------------------------------------------------------------

@bp.get('/api/projects/<int:project_id>/python-scripts')
@login_required
def list_scripts(project_id):
    scripts = PythonScript.query.filter_by(project_id=project_id)\
        .order_by(PythonScript.created_at).all()
    return jsonify([s.to_dict() for s in scripts])


@bp.post('/api/projects/<int:project_id>/python-scripts')
@login_required
def create_script(project_id):
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name fehlt'}), 400
    schedule_type = data.get('schedule_type', 'manual')
    interval_min  = int(data.get('interval_min') or 60)
    next_run_at   = None
    if schedule_type == 'interval':
        next_run_at = datetime.utcnow() + timedelta(minutes=interval_min)
    import json as _json2
    schedule_days_raw = data.get('schedule_days')
    schedule_days = _json2.dumps(schedule_days_raw) if schedule_days_raw else None

    script = PythonScript(
        project_id=project_id,
        name=name,
        description=data.get('description', ''),
        code=data.get('code', ''),
        timeout_sec=int(data.get('timeout_sec') or 30),
        is_active=data.get('is_active', True),
        schedule_type=schedule_type,
        interval_min=interval_min,
        next_run_at=next_run_at,
        schedule_days=schedule_days,
    )
    db.session.add(script)
    db.session.commit()
    return jsonify(script.to_dict()), 201


@bp.get('/api/python-scripts/<int:script_id>')
@login_required
def get_script(script_id):
    script = db.get_or_404(PythonScript, script_id)
    return jsonify(script.to_dict())


@bp.put('/api/python-scripts/<int:script_id>')
@login_required
def update_script(script_id):
    script = db.get_or_404(PythonScript, script_id)
    import json as _json
    data = request.get_json() or {}
    for field in ('name', 'description', 'code', 'is_active'):
        if field in data:
            setattr(script, field, data[field])
    if 'timeout_sec' in data:
        script.timeout_sec = int(data['timeout_sec'] or 30)
    if 'interval_min' in data:
        script.interval_min = int(data['interval_min'] or 60)
    if 'schedule_type' in data:
        script.schedule_type = data['schedule_type']
        if data['schedule_type'] == 'interval':
            script.next_run_at = datetime.utcnow() + timedelta(minutes=script.interval_min)
        else:
            script.next_run_at = None
    if 'cells' in data:
        cells = data['cells']
        if cells is None:
            script.cells = None
        else:
            script.cells = _json.dumps(cells)
            script.code = '\n\n'.join(cells)
    if 'schedule_days' in data:
        v = data['schedule_days']
        script.schedule_days = _json.dumps(v) if v else None
    db.session.commit()
    return jsonify(script.to_dict())


@bp.delete('/api/python-scripts/<int:script_id>')
@login_required
def delete_script(script_id):
    script = db.get_or_404(PythonScript, script_id)
    db.session.delete(script)
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

@bp.post('/api/python-scripts/<int:script_id>/run')
@login_required
def run_script_endpoint(script_id):
    script = db.get_or_404(PythonScript, script_id)
    from app.services.python_script_service import run_script
    run = PythonScriptRun(script_id=script.id, triggered_by='manual')
    db.session.add(run)
    db.session.commit()
    run_id = run.id
    app = current_app._get_current_object()
    threading.Thread(target=run_script, args=(app, script.id, run_id), daemon=True).start()
    return jsonify({'run_id': run_id, 'status': 'started'})


@bp.post('/api/python-scripts/<int:script_id>/run-cells')
@login_required
def run_cells_endpoint(script_id):
    script = db.get_or_404(PythonScript, script_id)
    data = request.get_json() or {}
    cell_index = data.get('cell_index', 0)
    cells = data.get('cells', [])
    if not cells:
        return jsonify({'error': 'Keine Zellen übergeben'}), 400
    from app.services.python_script_service import run_script_with_code, build_cell_code
    code_to_run = build_cell_code(cells, cell_index)
    run = PythonScriptRun(script_id=script.id, triggered_by='cell')
    db.session.add(run)
    db.session.commit()
    run_id = run.id
    app = current_app._get_current_object()
    threading.Thread(
        target=run_script_with_code,
        args=(app, script.id, run_id, code_to_run, True),
        daemon=True,
    ).start()
    return jsonify({'run_id': run_id, 'status': 'started'})


@bp.get('/api/python-scripts/<int:script_id>/runs')
@login_required
def get_runs(script_id):
    db.get_or_404(PythonScript, script_id)
    runs = PythonScriptRun.query.filter_by(script_id=script_id)\
        .order_by(PythonScriptRun.started_at.desc()).limit(20).all()
    return jsonify([r.to_dict() for r in runs])


# ---------------------------------------------------------------------------
# Workspace-Dateien
# ---------------------------------------------------------------------------

@bp.get('/api/python-scripts/<int:script_id>/files')
@login_required
def list_script_files(script_id):
    script = db.get_or_404(PythonScript, script_id)
    ws = _script_workspace_dir(script)
    if not os.path.isdir(ws):
        return jsonify([])
    files = []
    for fn in sorted(os.listdir(ws)):
        fp = os.path.join(ws, fn)
        if os.path.isfile(fp) and fn.lower().endswith(('.md', '.txt', '.csv', '.py')):
            stat = os.stat(fp)
            files.append({
                'filename': fn,
                'size': stat.st_size,
                'modified_at': datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
            })
    return jsonify(files)


@bp.get('/api/python-scripts/<int:script_id>/files/<path:filename>')
@login_required
def get_script_file(script_id, filename):
    script = db.get_or_404(PythonScript, script_id)
    ws = _script_workspace_dir(script)
    safe_fn = secure_filename(filename)
    path = os.path.join(ws, safe_fn)
    if not os.path.isfile(path):
        return jsonify({'error': 'Datei nicht gefunden'}), 404
    return send_file(path, as_attachment=False)


@bp.delete('/api/python-scripts/<int:script_id>/files/<path:filename>')
@login_required
def delete_script_file(script_id, filename):
    script = db.get_or_404(PythonScript, script_id)
    ws = _script_workspace_dir(script)
    safe_fn = secure_filename(filename)
    path = os.path.join(ws, safe_fn)
    if not os.path.isfile(path):
        return jsonify({'error': 'Datei nicht gefunden'}), 404
    os.remove(path)
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Interne Endpoints (für axion.py im subprocess)
# ---------------------------------------------------------------------------

@internal_bp.get('/api/internal/script/issues')
def internal_get_issues():
    if not _check_internal_token():
        return jsonify({'error': 'Unauthorized'}), 401
    from app.models.issue import Issue
    project_id = request.args.get('project_id', type=int)
    q = Issue.query
    if project_id:
        q = q.filter_by(project_id=project_id)
    if request.args.get('status'):
        q = q.filter_by(status=request.args['status'])
    if request.args.get('type'):
        q = q.filter_by(type=request.args['type'])
    return jsonify([i.to_dict(include_tags=False) for i in q.all()])


@internal_bp.post('/api/internal/script/issues')
def internal_create_issue():
    if not _check_internal_token():
        return jsonify({'error': 'Unauthorized'}), 401
    from app.models.issue import Issue
    from app.models.activity import ActivityLog
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Titel fehlt'}), 400
    issue = Issue(
        title=title,
        description=data.get('description', ''),
        type=data.get('type', 'task'),
        priority=data.get('priority', 'medium'),
        status='open',
        project_id=int(data['project_id']),
        creator_id=1,  # System-User
    )
    db.session.add(issue)
    db.session.flush()
    db.session.add(ActivityLog(issue_id=issue.id, project_id=issue.project_id,
                                user_id=1, action='script_create'))
    db.session.commit()
    return jsonify(issue.to_dict(include_tags=False)), 201


@internal_bp.put('/api/internal/script/issues/<int:issue_id>')
def internal_update_issue(issue_id):
    if not _check_internal_token():
        return jsonify({'error': 'Unauthorized'}), 401
    from app.models.issue import Issue
    issue = db.get_or_404(Issue, issue_id)
    data = request.get_json() or {}
    for field in ('status', 'priority', 'title', 'description'):
        if field in data:
            setattr(issue, field, data[field])
    db.session.commit()
    return jsonify(issue.to_dict(include_tags=False))


@internal_bp.post('/api/internal/script/issues/<int:issue_id>/comments')
def internal_add_comment(issue_id):
    if not _check_internal_token():
        return jsonify({'error': 'Unauthorized'}), 401
    from app.models.comment import Comment
    data = request.get_json() or {}
    content = (data.get('content') or '').strip()
    if not content:
        return jsonify({'error': 'Inhalt fehlt'}), 400
    comment = Comment(issue_id=issue_id, author_id=1, content=content)
    db.session.add(comment)
    db.session.commit()
    return jsonify({'id': comment.id, 'content': comment.content}), 201


@internal_bp.get('/api/internal/script/wiki/<slug>')
def internal_get_wiki(slug):
    if not _check_internal_token():
        return jsonify({'error': 'Unauthorized'}), 401
    from app.models.wiki_page import WikiPage
    page = WikiPage.query.filter_by(slug=slug).first()
    if not page:
        return jsonify({'error': 'Seite nicht gefunden'}), 404
    return jsonify({'slug': page.slug, 'title': page.title, 'content': page.content})


@internal_bp.post('/api/internal/script/wiki')
def internal_create_wiki():
    if not _check_internal_token():
        return jsonify({'error': 'Unauthorized'}), 401
    from app.models.wiki_page import WikiPage
    from slugify import slugify
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Titel fehlt'}), 400
    slug = data.get('slug') or slugify(title)
    base_slug = slug
    counter = 1
    while WikiPage.query.filter_by(slug=slug).first():
        slug = f'{base_slug}-{counter}'
        counter += 1
    page = WikiPage(slug=slug, title=title, content=data.get('content', ''),
                    project_id=data.get('project_id'), created_by=1)
    db.session.add(page)
    db.session.commit()
    return jsonify({'slug': page.slug, 'title': page.title}), 201


@internal_bp.put('/api/internal/script/wiki/<slug>')
def internal_update_wiki(slug):
    if not _check_internal_token():
        return jsonify({'error': 'Unauthorized'}), 401
    from app.models.wiki_page import WikiPage
    page = WikiPage.query.filter_by(slug=slug).first()
    if not page:
        return jsonify({'error': 'Seite nicht gefunden'}), 404
    data = request.get_json() or {}
    if 'content' in data:
        page.content = data['content']
    if 'title' in data:
        page.title = data['title']
    db.session.commit()
    return jsonify({'slug': page.slug, 'title': page.title})


@internal_bp.post('/api/internal/script/notify')
def internal_notify():
    if not _check_internal_token():
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json() or {}
    message = str(data.get('message', '')).strip()
    if message:
        from app.services import telegram_bot as tg
        tg.notify(message)
    return jsonify({'ok': True})


@internal_bp.get('/api/internal/script/projects')
def internal_list_projects():
    if not _check_internal_token():
        return jsonify({'error': 'Unauthorized'}), 401
    from app.models.project import Project
    return jsonify([
        {'id': p.id, 'name': p.name, 'key': p.key, 'description': p.description}
        for p in Project.query.order_by(Project.id).all()
    ])


@internal_bp.get('/api/internal/script/projects/<int:project_id>')
def internal_get_project(project_id):
    if not _check_internal_token():
        return jsonify({'error': 'Unauthorized'}), 401
    from app.models.project import Project
    p = db.get_or_404(Project, project_id)
    return jsonify({'id': p.id, 'name': p.name, 'key': p.key, 'description': p.description})


@internal_bp.get('/api/internal/script/calendar-entries')
def internal_list_calendar_entries():
    if not _check_internal_token():
        return jsonify({'error': 'Unauthorized'}), 401
    from app.models.calendar_entry import CalendarEntry
    from datetime import datetime as _dt
    project_id = request.args.get('project_id', type=int)
    q = CalendarEntry.query
    if project_id:
        q = q.filter_by(project_id=project_id)
    if request.args.get('start'):
        try:
            q = q.filter(CalendarEntry.start_dt >= _dt.fromisoformat(request.args['start']))
        except ValueError:
            pass
    if request.args.get('end'):
        try:
            q = q.filter(CalendarEntry.end_dt <= _dt.fromisoformat(request.args['end']))
        except ValueError:
            pass
    entries = q.order_by(CalendarEntry.start_dt).limit(100).all()
    return jsonify([e.to_dict() for e in entries])


@internal_bp.post('/api/internal/script/calendar-entries')
def internal_create_calendar_entry():
    if not _check_internal_token():
        return jsonify({'error': 'Unauthorized'}), 401
    from app.models.calendar_entry import CalendarEntry
    from datetime import datetime as _dt
    data = request.get_json() or {}
    start_raw = data.get('start_dt') or ''
    end_raw = data.get('end_dt') or ''
    if not start_raw or not end_raw:
        return jsonify({'error': 'start_dt und end_dt sind Pflichtfelder'}), 400
    try:
        start_dt = _dt.fromisoformat(start_raw)
        end_dt = _dt.fromisoformat(end_raw)
    except ValueError as e:
        return jsonify({'error': f'Ungültiges Datumsformat: {e}'}), 400
    project_id = data.get('project_id')
    entry = CalendarEntry(
        title=(data.get('title') or '').strip() or None,
        start_dt=start_dt,
        end_dt=end_dt,
        issue_id=data.get('issue_id'),
        project_id=int(project_id) if project_id else None,
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201
