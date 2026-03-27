import uuid as _uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from app import db
from app.models.calendar_entry import CalendarEntry
from sqlalchemy import or_


bp = Blueprint('calendar_entries', __name__, url_prefix='/api')


def _push_to_icloud(entry, issue=None):
    """Erstellt ein iCloud-Ereignis für diesen CalendarEntry. Gibt UID zurück oder None."""
    import logging
    log = logging.getLogger(__name__)
    try:
        from app.services.settings_env import read as env_read
        if not (env_read('ICLOUD_USERNAME') or current_app.config.get('ICLOUD_USERNAME')):
            return None
        from app.services.icloud_client import get_calendar
        from app.services.event_mapper import json_to_ical
        uid = str(_uuid.uuid4())
        title = issue.title if issue else (entry.title or 'Kalender-Eintrag')
        description = f'Axion Issue #{issue.id}' if issue else ''
        payload = {
            'title': title,
            'start': entry.start_dt.isoformat(),
            'end': entry.end_dt.isoformat(),
            'description': description,
            'uid': uid,
        }
        ical_str = json_to_ical(payload)
        cal = get_calendar()
        cal.save_event(ical_str)
        log.info(f'iCloud event created: {uid}')
        return uid
    except Exception as e:
        log.error(f'iCloud push failed: {e}')
        return None


def _delete_from_icloud(icloud_uid):
    """Löscht ein iCloud-Ereignis anhand der UID. Fehler werden ignoriert."""
    if not icloud_uid:
        return
    try:
        from app.services.icloud_client import get_calendar
        cal = get_calendar()
        for event in cal.events():
            if str(event.icalendar_component.get('uid')) == icloud_uid:
                event.delete()
                break
    except Exception:
        pass


@bp.get('/projects/<int:project_id>/calendar-entries')
@login_required
def list_entries(project_id):
    start = request.args.get('start')
    end = request.args.get('end')

    q = CalendarEntry.query.filter(
        or_(CalendarEntry.project_id == project_id, CalendarEntry.project_id.is_(None))
    )

    if start:
        try:
            q = q.filter(CalendarEntry.end_dt >= datetime.fromisoformat(start))
        except ValueError:
            pass
    if end:
        try:
            q = q.filter(CalendarEntry.start_dt <= datetime.fromisoformat(end))
        except ValueError:
            pass

    entries = q.order_by(CalendarEntry.start_dt).all()
    return jsonify([e.to_dict() for e in entries])


@bp.post('/calendar-entries')
@login_required
def create_entry():
    data = request.get_json()
    issue_id = data.get('issue_id')
    project_id = data.get('project_id')
    start_dt = data.get('start_dt')
    end_dt = data.get('end_dt')

    if not all([start_dt, end_dt]):
        return jsonify({'error': 'start_dt und end_dt erforderlich'}), 400

    try:
        start = datetime.fromisoformat(start_dt)
        end = datetime.fromisoformat(end_dt)
    except ValueError as e:
        return jsonify({'error': f'Ungültiges Datumsformat: {e}'}), 400

    entry = CalendarEntry(
        issue_id=issue_id,
        project_id=project_id,
        start_dt=start,
        end_dt=end,
    )
    db.session.add(entry)
    db.session.commit()

    # iCloud-Sync (nach Commit, damit entry.id vorhanden)
    uid = _push_to_icloud(entry, entry.issue)
    if uid:
        entry.icloud_uid = uid
        db.session.commit()

    return jsonify(entry.to_dict()), 201


@bp.put('/calendar-entries/<int:entry_id>')
@login_required
def update_entry(entry_id):
    entry = CalendarEntry.query.get_or_404(entry_id)
    data = request.get_json()

    old_uid = entry.icloud_uid

    if 'start_dt' in data:
        try:
            entry.start_dt = datetime.fromisoformat(data['start_dt'])
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

    if 'end_dt' in data:
        try:
            entry.end_dt = datetime.fromisoformat(data['end_dt'])
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

    entry.icloud_uid = None
    db.session.commit()

    # iCloud: altes Event löschen, neues anlegen
    _delete_from_icloud(old_uid)
    uid = _push_to_icloud(entry, entry.issue)
    if uid:
        entry.icloud_uid = uid
        db.session.commit()

    return jsonify(entry.to_dict())


@bp.delete('/calendar-entries/<int:entry_id>')
@login_required
def delete_entry(entry_id):
    entry = CalendarEntry.query.get_or_404(entry_id)
    icloud_uid = entry.icloud_uid
    db.session.delete(entry)
    db.session.commit()
    _delete_from_icloud(icloud_uid)
    return jsonify({'ok': True})
