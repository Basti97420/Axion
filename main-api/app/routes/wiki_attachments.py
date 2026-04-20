import os
import mimetypes
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from flask_login import login_required
from werkzeug.utils import secure_filename
from app import db
from app.models.wiki_page import WikiPage
from app.models.wiki_attachment import WikiAttachment

bp = Blueprint('wiki_attachments', __name__, url_prefix='/api/knowledge')


@bp.post('/pages/<slug>/attachments')
@login_required
def upload_attachment(slug):
    page = WikiPage.query.filter_by(slug=slug).first_or_404()
    if 'file' not in request.files:
        return jsonify({'error': 'Keine Datei'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Kein Dateiname'}), 400

    filename = secure_filename(file.filename)
    upload_dir = current_app.config['WIKI_UPLOAD_FOLDER']
    os.makedirs(upload_dir, exist_ok=True)

    # Avoid overwrites
    base, ext = os.path.splitext(filename)
    counter = 1
    target = os.path.join(upload_dir, filename)
    while os.path.exists(target):
        filename = f'{base}_{counter}{ext}'
        target = os.path.join(upload_dir, filename)
        counter += 1

    file.save(target)
    size = os.path.getsize(target)
    mime = mimetypes.guess_type(target)[0]

    attachment = WikiAttachment(
        page_id=page.id,
        filename=filename,
        filepath=target,
        mime_type=mime,
        size_bytes=size,
    )
    db.session.add(attachment)
    db.session.commit()
    return jsonify(attachment.to_dict()), 201


@bp.get('/attachments/<int:aid>')
@login_required
def get_attachment(aid):
    attachment = WikiAttachment.query.get_or_404(aid)
    upload_dir = current_app.config['WIKI_UPLOAD_FOLDER']
    return send_from_directory(upload_dir, attachment.filename, as_attachment=False)


@bp.delete('/attachments/<int:aid>')
@login_required
def delete_attachment(aid):
    attachment = WikiAttachment.query.get_or_404(aid)
    try:
        if os.path.exists(attachment.filepath):
            os.remove(attachment.filepath)
    except OSError:
        pass
    db.session.delete(attachment)
    db.session.commit()
    return jsonify({'ok': True})
