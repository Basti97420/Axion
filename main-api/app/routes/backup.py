import io
import json
import os
import zipfile
from datetime import datetime

from flask import Blueprint, send_file
from flask_login import login_required

from app.models.user import User
from app.models.project import Project
from app.models.issue import Issue
from app.models.tag import Tag
from app.models.worklog import Worklog
from app.models.comment import Comment
from app.models.activity import ActivityLog

bp = Blueprint('backup', __name__, url_prefix='/api')


@bp.get('/backup')
@login_required
def create_backup():
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

        # Wiki-Daten direkt aus der DB
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
            pass  # Wiki-Daten nicht verfügbar – Backup ohne Wiki

        zf.writestr('backup.json', json.dumps(data, ensure_ascii=False, indent=2))

    buf.seek(0)
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    return send_file(
        buf,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'planwiki_backup_{timestamp}.zip',
    )


def _user_dict(u):
    return {
        'id': u.id,
        'name': u.name,
        'created_at': u.created_at.isoformat() if u.created_at else None,
        'last_login': u.last_login.isoformat() if u.last_login else None,
    }
