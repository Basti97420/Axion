"""Admin-Endpoints für DB-Browser und Workspace-Dateiverwaltung."""
import json
import os
from functools import wraps

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import inspect, text

from app import db

bp = Blueprint('admin_db', __name__, url_prefix='/api/admin')

# Felder die nie bearbeitet werden dürfen
READONLY_FIELDS = {'id', 'password_hash', 'created_at', 'started_at', 'finished_at',
                   'last_login', 'updated_at'}

# Tabellen die nie angezeigt/bearbeitet werden
EXCLUDED_TABLES = {'alembic_version'}

# Erlaubte Dateiendungen für Workspace-Dateien
ALLOWED_EXTENSIONS = {'.md', '.txt', '.csv'}


def admin_required(f):
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if not current_user.is_admin:
            return jsonify({'error': 'Keine Berechtigung'}), 403
        return f(*args, **kwargs)
    return decorated


def _all_tables():
    """Gibt alle sichtbaren Tabellennamen zurück."""
    inspector = inspect(db.engine)
    return [t for t in inspector.get_table_names() if t not in EXCLUDED_TABLES]


def _table_columns(table_name):
    """Gibt Spalten-Metadaten für eine Tabelle zurück."""
    inspector = inspect(db.engine)
    cols = []
    for col in inspector.get_columns(table_name):
        cols.append({
            'name': col['name'],
            'type': str(col['type']),
            'nullable': col.get('nullable', True),
            'primary_key': col['name'] in {
                pk for pk in inspector.get_pk_constraint(table_name).get('constrained_columns', [])
            },
            'readonly': col['name'] in READONLY_FIELDS,
        })
    return cols


def _is_json_field(col_name):
    return any(kw in col_name for kw in ('actions', 'cells', 'schedule_days', 'variables',
                                          'tags', 'files', 'data', 'config'))


# ---------------------------------------------------------------------------
# DB-Browser Endpoints
# ---------------------------------------------------------------------------

@bp.route('/db/tables', methods=['GET'])
@admin_required
def list_tables():
    """Alle Tabellen mit Spalten-Metadaten und Zeilenzahl."""
    result = []
    for table_name in sorted(_all_tables()):
        try:
            with db.engine.connect() as conn:
                count = conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"')).scalar()
        except Exception:
            count = 0
        result.append({
            'table': table_name,
            'row_count': count,
            'columns': _table_columns(table_name),
        })
    return jsonify(result)


@bp.route('/db/tables/<table>/rows', methods=['GET'])
@admin_required
def get_rows(table):
    """Paginierte Zeilen einer Tabelle, optional mit Volltextsuche."""
    if table in EXCLUDED_TABLES or table not in _all_tables():
        return jsonify({'error': 'Tabelle nicht gefunden'}), 404

    page = max(1, int(request.args.get('page', 1)))
    per_page = 50
    q = (request.args.get('q') or '').strip()
    offset = (page - 1) * per_page

    try:
        cols = _table_columns(table)
        str_cols = [c['name'] for c in cols
                    if 'VARCHAR' in c['type'].upper() or 'TEXT' in c['type'].upper()]

        with db.engine.connect() as conn:
            if q and str_cols:
                like_clauses = ' OR '.join(f'CAST("{c}" AS TEXT) LIKE :q' for c in str_cols)
                total = conn.execute(
                    text(f'SELECT COUNT(*) FROM "{table}" WHERE {like_clauses}'),
                    {'q': f'%{q}%'}
                ).scalar()
                rows_raw = conn.execute(
                    text(f'SELECT * FROM "{table}" WHERE {like_clauses} LIMIT :lim OFFSET :off'),
                    {'q': f'%{q}%', 'lim': per_page, 'off': offset}
                ).fetchall()
            else:
                total = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar()
                rows_raw = conn.execute(
                    text(f'SELECT * FROM "{table}" LIMIT :lim OFFSET :off'),
                    {'lim': per_page, 'off': offset}
                ).fetchall()

        col_names = [c['name'] for c in cols]
        rows = []
        for row in rows_raw:
            rows.append({col_names[i]: row[i] for i in range(len(col_names))})

        return jsonify({
            'rows': rows,
            'total': total,
            'page': page,
            'pages': max(1, (total + per_page - 1) // per_page),
            'columns': cols,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/db/tables/<table>/rows/<int:row_id>', methods=['PUT'])
@admin_required
def update_row(table, row_id):
    """Einzelne Felder einer Zeile aktualisieren."""
    if table in EXCLUDED_TABLES or table not in _all_tables():
        return jsonify({'error': 'Tabelle nicht gefunden'}), 404

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({'error': 'Keine Felder übergeben'}), 400

    cols = _table_columns(table)
    col_map = {c['name']: c for c in cols}

    updates = {}
    for field, value in data.items():
        if field in READONLY_FIELDS:
            continue
        if field not in col_map:
            continue
        # JSON-Felder validieren
        if _is_json_field(field) and value is not None and isinstance(value, str):
            try:
                json.loads(value)
            except json.JSONDecodeError:
                return jsonify({'error': f'Feld "{field}" enthält kein valides JSON'}), 400
        updates[field] = value

    if not updates:
        return jsonify({'error': 'Keine editierbaren Felder'}), 400

    set_clause = ', '.join(f'"{k}" = :{k}' for k in updates)
    params = {**updates, '_id': row_id}
    try:
        with db.engine.connect() as conn:
            result = conn.execute(
                text(f'UPDATE "{table}" SET {set_clause} WHERE id = :_id'),
                params
            )
            conn.commit()
            if result.rowcount == 0:
                return jsonify({'error': 'Zeile nicht gefunden'}), 404
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Workspace-Datei Endpoints
# ---------------------------------------------------------------------------

def _list_workspace_files(directory):
    """Gibt alle erlaubten Dateien in einem Workspace-Verzeichnis zurück."""
    if not os.path.isdir(directory):
        return []
    return sorted(
        f for f in os.listdir(directory)
        if os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS
    )


@bp.route('/workspace/tree', methods=['GET'])
@admin_required
def workspace_tree():
    """Vollständiger Baum aller Agenten- und Script-Workspaces."""
    from flask import current_app
    from app.models.ki_agent import KiAgent
    from app.models.python_script import PythonScript
    from app.services.ki_agent_service import _get_workspace_dir

    agents_data = []
    for agent in KiAgent.query.order_by(KiAgent.name).all():
        ws_dir = _get_workspace_dir(agent)
        agents_data.append({
            'id': agent.id,
            'name': agent.name,
            'project_id': agent.project_id,
            'files': _list_workspace_files(ws_dir),
        })

    scripts_data = []
    for script in PythonScript.query.order_by(PythonScript.name).all():
        try:
            from slugify import slugify
            slug = slugify(script.name or 'script', max_length=40)
            ws_dir = os.path.join(
                current_app.instance_path, 'python-scripts',
                str(script.project_id), f'{script.id}-{slug}'
            )
        except Exception:
            ws_dir = ''
        scripts_data.append({
            'id': script.id,
            'name': script.name,
            'project_id': script.project_id,
            'files': _list_workspace_files(ws_dir),
        })

    return jsonify({'agents': agents_data, 'scripts': scripts_data})


@bp.route('/workspace/agents/<int:agent_id>/files/<path:filename>', methods=['GET'])
@admin_required
def get_agent_file(agent_id, filename):
    """Inhalt einer Agenten-Workspace-Datei lesen."""
    from app.models.ki_agent import KiAgent
    from app.services.ki_agent_service import _get_workspace_dir

    agent = db.get_or_404(KiAgent, agent_id)
    if os.path.splitext(filename)[1].lower() not in ALLOWED_EXTENSIONS:
        return jsonify({'error': 'Dateityp nicht erlaubt'}), 400

    ws_dir = _get_workspace_dir(agent)
    fpath = os.path.join(ws_dir, os.path.basename(filename))
    if not os.path.exists(fpath):
        return jsonify({'content': ''})
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            return jsonify({'content': f.read()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/workspace/agents/<int:agent_id>/files/<path:filename>', methods=['PUT'])
@admin_required
def save_agent_file(agent_id, filename):
    """Inhalt einer Agenten-Workspace-Datei speichern."""
    from app.models.ki_agent import KiAgent
    from app.services.ki_agent_service import _get_workspace_dir

    agent = db.get_or_404(KiAgent, agent_id)
    if os.path.splitext(filename)[1].lower() not in ALLOWED_EXTENSIONS:
        return jsonify({'error': 'Dateityp nicht erlaubt'}), 400

    content = (request.get_json(silent=True) or {}).get('content', '')
    ws_dir = _get_workspace_dir(agent)
    os.makedirs(ws_dir, exist_ok=True)
    fpath = os.path.join(ws_dir, os.path.basename(filename))
    try:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/workspace/scripts/<int:script_id>/files/<path:filename>', methods=['GET'])
@admin_required
def get_script_file(script_id, filename):
    """Inhalt einer Script-Workspace-Datei lesen."""
    from flask import current_app
    from app.models.python_script import PythonScript

    script = db.get_or_404(PythonScript, script_id)
    if os.path.splitext(filename)[1].lower() not in ALLOWED_EXTENSIONS:
        return jsonify({'error': 'Dateityp nicht erlaubt'}), 400

    try:
        from slugify import slugify
        slug = slugify(script.name or 'script', max_length=40)
        ws_dir = os.path.join(
            current_app.instance_path, 'python-scripts',
            str(script.project_id), f'{script.id}-{slug}'
        )
    except Exception:
        return jsonify({'error': 'Workspace nicht gefunden'}), 404

    fpath = os.path.join(ws_dir, os.path.basename(filename))
    if not os.path.exists(fpath):
        return jsonify({'content': ''})
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            return jsonify({'content': f.read()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/workspace/scripts/<int:script_id>/files/<path:filename>', methods=['PUT'])
@admin_required
def save_script_file(script_id, filename):
    """Inhalt einer Script-Workspace-Datei speichern."""
    from flask import current_app
    from app.models.python_script import PythonScript

    script = db.get_or_404(PythonScript, script_id)
    if os.path.splitext(filename)[1].lower() not in ALLOWED_EXTENSIONS:
        return jsonify({'error': 'Dateityp nicht erlaubt'}), 400

    content = (request.get_json(silent=True) or {}).get('content', '')
    try:
        from slugify import slugify
        slug = slugify(script.name or 'script', max_length=40)
        ws_dir = os.path.join(
            current_app.instance_path, 'python-scripts',
            str(script.project_id), f'{script.id}-{slug}'
        )
    except Exception:
        return jsonify({'error': 'Workspace-Pfad Fehler'}), 500

    os.makedirs(ws_dir, exist_ok=True)
    fpath = os.path.join(ws_dir, os.path.basename(filename))
    try:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
