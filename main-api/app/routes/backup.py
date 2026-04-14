import io
import json
import os
import zipfile
from datetime import datetime
from functools import wraps

from flask import Blueprint, send_file, jsonify, request, current_app
from flask_login import login_required, current_user

from app.models.user import User
from app.models.project import Project
from app.models.issue import Issue
from app.models.tag import Tag
from app.models.worklog import Worklog
from app.models.comment import Comment
from app.models.activity import ActivityLog

bp = Blueprint('backup', __name__, url_prefix='/api')


def admin_required(f):
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if not current_user.is_admin:
            return jsonify({'error': 'Keine Berechtigung'}), 403
        return f(*args, **kwargs)
    return decorated


def _create_backup_bytes():
    """Erstellt ein Backup-ZIP und gibt die Bytes zurück."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        data = {
            'version': '1.0',
            'created_at': datetime.utcnow().isoformat(),
            'users': [_user_dict(u) for u in User.query.all()],
            'projects': [p.to_dict() for p in Project.query.all()],
            'tags': [t.to_dict() for t in Tag.query.all()],
            'issues': [i.to_dict(include_tags=True) for i in Issue.query.all()],
            'worklogs': [w.to_dict() for w in Worklog.query.all()],
            'comments': [c.to_dict() for c in Comment.query.all()],
            'activity_log': [a.to_dict() for a in ActivityLog.query.all()],
            'wiki_pages': [],
            'wiki_attachments': [],
        }

        try:
            from app.models.wiki_page import WikiPage
            from app.models.wiki_attachment import WikiAttachment

            pages = WikiPage.query.all()
            full_pages = []
            for p in pages:
                pd = p.to_dict()
                pd['attachments'] = [a.to_dict() for a in p.attachments]
                full_pages.append(pd)
            data['wiki_pages'] = full_pages

            attachment_refs = []
            for pd in full_pages:
                for att in pd.get('attachments', []):
                    attachment_refs.append(att)
                    wa = WikiAttachment.query.get(att['id'])
                    if wa and os.path.exists(wa.filepath):
                        try:
                            with open(wa.filepath, 'rb') as f:
                                zf.writestr(f'files/{att["filename"]}', f.read())
                        except Exception:
                            pass
            data['wiki_attachments'] = attachment_refs
        except Exception:
            pass

        zf.writestr('backup.json', json.dumps(data, ensure_ascii=False, indent=2))

    buf.seek(0)
    return buf.read()


def _get_backup_dir():
    """Gibt das Backup-Verzeichnis zurück und erstellt es falls nötig."""
    backup_dir = os.path.join(current_app.instance_path, 'backups')
    os.makedirs(backup_dir, exist_ok=True)
    return backup_dir


def _save_backup(app):
    """Erstellt ein Backup und speichert es auf der Festplatte. Löscht überzählige alte Backups."""
    from app.services.settings_env import read, write

    with app.app_context():
        backup_bytes = _create_backup_bytes()
        backup_dir = _get_backup_dir()
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f'axion_backup_{timestamp}.zip'
        filepath = os.path.join(backup_dir, filename)

        with open(filepath, 'wb') as f:
            f.write(backup_bytes)

        # Letzten Lauf speichern
        write('BACKUP_LAST_RUN', datetime.utcnow().isoformat())

        # Alte Backups bereinigen
        try:
            max_keep = int(read('BACKUP_MAX_KEEP', '5'))
        except (ValueError, TypeError):
            max_keep = 5

        backups = sorted([
            f for f in os.listdir(backup_dir)
            if f.startswith('axion_backup_') and f.endswith('.zip')
        ])
        while len(backups) > max_keep:
            oldest = backups.pop(0)
            try:
                os.remove(os.path.join(backup_dir, oldest))
            except Exception:
                pass


# ── Manueller Download (bestehend) ───────────────────────────────────────────

@bp.get('/backup')
@login_required
def create_backup():
    backup_bytes = _create_backup_bytes()
    buf = io.BytesIO(backup_bytes)
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    return send_file(
        buf,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'planwiki_backup_{timestamp}.zip',
    )


# ── Admin: Backup-Konfiguration ───────────────────────────────────────────────

@bp.get('/admin/settings/backup')
@admin_required
def get_backup_config():
    from app.services.settings_env import read
    return jsonify({
        'enabled':        read('BACKUP_ENABLED', 'true').lower() == 'true',
        'interval_days':  int(read('BACKUP_INTERVAL_DAYS', '7') or '7'),
        'max_keep':       int(read('BACKUP_MAX_KEEP', '5') or '5'),
        'last_run':       read('BACKUP_LAST_RUN', ''),
    })


@bp.put('/admin/settings/backup')
@admin_required
def update_backup_config():
    from app.services.settings_env import read, write
    data = request.get_json() or {}
    if 'enabled' in data:
        write('BACKUP_ENABLED', 'true' if data['enabled'] else 'false')
    if 'interval_days' in data:
        write('BACKUP_INTERVAL_DAYS', str(max(1, int(data['interval_days']))))
    if 'max_keep' in data:
        write('BACKUP_MAX_KEEP', str(max(1, int(data['max_keep']))))
    return jsonify({
        'enabled':        read('BACKUP_ENABLED', 'true').lower() == 'true',
        'interval_days':  int(read('BACKUP_INTERVAL_DAYS', '7') or '7'),
        'max_keep':       int(read('BACKUP_MAX_KEEP', '5') or '5'),
        'last_run':       read('BACKUP_LAST_RUN', ''),
    })


# ── Admin: Backup-Liste / Download / Löschen / Manuell ausführen ──────────────

@bp.get('/admin/backups')
@admin_required
def list_backups():
    backup_dir = _get_backup_dir()
    files = sorted([
        f for f in os.listdir(backup_dir)
        if f.startswith('axion_backup_') and f.endswith('.zip')
    ], reverse=True)
    result = []
    for filename in files:
        filepath = os.path.join(backup_dir, filename)
        try:
            stat = os.stat(filepath)
            result.append({
                'filename': filename,
                'size_bytes': stat.st_size,
                'created_at': datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
            })
        except Exception:
            pass
    return jsonify(result)


@bp.post('/admin/backups/run')
@admin_required
def trigger_backup():
    try:
        _save_backup(current_app._get_current_object())
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.get('/admin/backups/<filename>')
@admin_required
def download_backup(filename):
    if not filename.startswith('axion_backup_') or not filename.endswith('.zip') or '/' in filename:
        return jsonify({'error': 'Ungültiger Dateiname'}), 400
    backup_dir = _get_backup_dir()
    filepath = os.path.join(backup_dir, filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'Datei nicht gefunden'}), 404
    return send_file(filepath, mimetype='application/zip', as_attachment=True, download_name=filename)


@bp.delete('/admin/backups/<filename>')
@admin_required
def delete_backup(filename):
    if not filename.startswith('axion_backup_') or not filename.endswith('.zip') or '/' in filename:
        return jsonify({'error': 'Ungültiger Dateiname'}), 400
    backup_dir = _get_backup_dir()
    filepath = os.path.join(backup_dir, filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'Datei nicht gefunden'}), 404
    os.remove(filepath)
    return jsonify({'ok': True})


def _user_dict(u):
    return {
        'id': u.id,
        'name': u.name,
        'created_at': u.created_at.isoformat() if u.created_at else None,
        'last_login': u.last_login.isoformat() if u.last_login else None,
    }
