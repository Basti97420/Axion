import os
import uuid
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from flask_login import login_required, current_user
from app import db
from app.models.attachment import Attachment
from app.models.issue import Issue

bp = Blueprint('attachments', __name__, url_prefix='/api')

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '../../instance/uploads')


def _upload_dir():
    path = os.path.abspath(UPLOAD_FOLDER)
    os.makedirs(path, exist_ok=True)
    return path


@bp.post('/issues/<int:issue_id>/attachments')
@login_required
def upload(issue_id):
    issue = Issue.query.get_or_404(issue_id)
    if 'file' not in request.files:
        return jsonify({'error': 'Keine Datei übermittelt'}), 400

    f = request.files['file']
    if not f.filename:
        return jsonify({'error': 'Kein Dateiname'}), 400

    ext = os.path.splitext(f.filename)[1].lower()
    stored_name = f'{uuid.uuid4().hex}{ext}'
    upload_dir = _upload_dir()
    f.save(os.path.join(upload_dir, stored_name))

    att = Attachment(
        issue_id=issue.id,
        filename=stored_name,
        original_name=f.filename,
        size=os.path.getsize(os.path.join(upload_dir, stored_name)),
        mime_type=f.mimetype or 'application/octet-stream',
        uploader_id=current_user.id,
    )
    db.session.add(att)
    db.session.commit()
    return jsonify(att.to_dict()), 201


@bp.get('/issues/<int:issue_id>/attachments')
@login_required
def list_attachments(issue_id):
    Issue.query.get_or_404(issue_id)
    atts = Attachment.query.filter_by(issue_id=issue_id).order_by(Attachment.created_at.desc()).all()
    return jsonify([a.to_dict() for a in atts])


@bp.get('/attachments/<int:att_id>/download')
@login_required
def download(att_id):
    att = Attachment.query.get_or_404(att_id)
    upload_dir = _upload_dir()
    return send_from_directory(upload_dir, att.filename, download_name=att.original_name)


@bp.get('/attachments/<int:att_id>/preview')
@login_required
def preview(att_id):
    att = Attachment.query.get_or_404(att_id)
    upload_dir = _upload_dir()
    return send_from_directory(upload_dir, att.filename, mimetype=att.mime_type)


@bp.delete('/attachments/<int:att_id>')
@login_required
def delete_attachment(att_id):
    att = Attachment.query.get_or_404(att_id)
    if att.uploader_id != current_user.id and not current_user.is_admin:
        return jsonify({'error': 'Keine Berechtigung'}), 403

    filepath = os.path.join(os.path.abspath(UPLOAD_FOLDER), att.filename)
    if os.path.exists(filepath):
        os.remove(filepath)
    db.session.delete(att)
    db.session.commit()
    return jsonify({'message': 'Gelöscht'}), 200
