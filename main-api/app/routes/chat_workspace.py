import os
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required
from werkzeug.utils import secure_filename

bp = Blueprint('chat_workspace', __name__, url_prefix='/api/workspace')

ALLOWED_EXTENSIONS = {'.md', '.txt', '.csv'}


def _workspace_dir():
    """Gibt den globalen Chat-Workspace-Ordner zurück."""
    path = os.path.join(current_app.instance_path, 'chat-workspace')
    os.makedirs(path, exist_ok=True)
    return path


def _safe_path(filename):
    """Gibt den sicheren absoluten Pfad für eine Datei zurück oder None bei ungültigem Namen."""
    safe = secure_filename(filename)
    if not safe:
        return None
    ext = os.path.splitext(safe)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return None
    return os.path.join(_workspace_dir(), safe)


@bp.get('/files')
@login_required
def list_files():
    workspace = _workspace_dir()
    files = []
    for fname in sorted(os.listdir(workspace)):
        ext = os.path.splitext(fname)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            continue
        fpath = os.path.join(workspace, fname)
        stat = os.stat(fpath)
        files.append({
            'filename':    fname,
            'size':        stat.st_size,
            'modified_at': stat.st_mtime,
        })
    return jsonify(files)


@bp.get('/files/<path:filename>')
@login_required
def get_file(filename):
    fpath = _safe_path(filename)
    if not fpath:
        return jsonify({'error': 'Ungültiger Dateiname'}), 400
    if not os.path.isfile(fpath):
        return jsonify({'error': 'Datei nicht gefunden'}), 404
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            return jsonify({'content': f.read()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.put('/files/<path:filename>')
@login_required
def save_file(filename):
    fpath = _safe_path(filename)
    if not fpath:
        return jsonify({'error': 'Ungültiger Dateiname oder Dateityp (nur .md, .txt, .csv)'}), 400
    data = request.get_json() or {}
    content = data.get('content', '')
    try:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({'ok': True, 'filename': os.path.basename(fpath)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.delete('/files/<path:filename>')
@login_required
def delete_file(filename):
    fpath = _safe_path(filename)
    if not fpath:
        return jsonify({'error': 'Ungültiger Dateiname'}), 400
    if not os.path.isfile(fpath):
        return jsonify({'error': 'Datei nicht gefunden'}), 404
    try:
        os.remove(fpath)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
