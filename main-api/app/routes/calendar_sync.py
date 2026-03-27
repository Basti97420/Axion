from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required
from datetime import datetime
from app.services.icloud_client import get_calendar
from app.services.event_mapper import json_to_ical, ical_to_json

bp = Blueprint('calendar_sync', __name__, url_prefix='/api/calendar')


def _icloud_configured():
    from app.services.settings_env import read
    return bool(read('ICLOUD_USERNAME') or current_app.config.get('ICLOUD_USERNAME'))


@bp.get('/events')
@login_required
def get_events():
    if not _icloud_configured():
        return jsonify([]), 200
    try:
        cal = get_calendar()
        start = request.args.get('start')
        end = request.args.get('end')
        if start and end:
            events = cal.date_search(
                start=datetime.fromisoformat(start),
                end=datetime.fromisoformat(end),
                expand=True,
            )
        else:
            events = cal.events()
        return jsonify([ical_to_json(e) for e in events]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.post('/events')
@login_required
def create_event():
    if not _icloud_configured():
        return jsonify({'error': 'iCloud nicht konfiguriert'}), 503
    data = request.get_json()
    if not data or not data.get('title') or not data.get('start'):
        return jsonify({'error': 'title und start erforderlich'}), 400
    try:
        import uuid as _uuid
        uid = data.get('uid') or str(_uuid.uuid4())
        ical_str = json_to_ical({**data, 'uid': uid})
        cal = get_calendar()
        cal.save_event(ical_str)
        return jsonify({'status': 'created', 'uid': uid}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.delete('/events/<uid>')
@login_required
def delete_event(uid):
    if not _icloud_configured():
        return jsonify({'error': 'iCloud nicht konfiguriert'}), 503
    try:
        cal = get_calendar()
        for event in cal.events():
            if str(event.icalendar_component.get('uid')) == uid:
                event.delete()
                return jsonify({'status': 'deleted'}), 200
        return jsonify({'error': 'Event nicht gefunden'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.post('/sync')
@login_required
def sync_from_icloud():
    """Importiert neue iCloud-Events als lokale CalendarEntries (falls noch nicht vorhanden)."""
    if not _icloud_configured():
        return jsonify([]), 200
    try:
        from app import db
        from app.models.calendar_entry import CalendarEntry

        data = request.get_json() or {}
        start = data.get('start')
        end = data.get('end')

        cal = get_calendar()
        if start and end:
            events = cal.date_search(
                start=datetime.fromisoformat(start),
                end=datetime.fromisoformat(end),
                expand=True,
            )
        else:
            events = cal.events()

        icloud_events = [ical_to_json(e) for e in events]

        # Bereits importierte UIDs
        existing_uids = {
            e.icloud_uid for e in
            CalendarEntry.query.filter(CalendarEntry.icloud_uid.isnot(None)).all()
        }

        # Standard-Projekt ermitteln
        from app.models.issue import Issue
        from app.models.project import Project
        from app.services.settings_env import read as settings_read
        raw_pid = settings_read('ICLOUD_DEFAULT_PROJECT_ID', '')
        try:
            default_project_id = int(raw_pid) if raw_pid else None
        except ValueError:
            default_project_id = None
        if default_project_id is None:
            first_project = Project.query.order_by(Project.id).first()
            default_project_id = first_project.id if first_project else None

        imported = []
        for evt in icloud_events:
            # Axion-eigene Events überspringen
            desc = evt.get('description') or ''
            if desc.startswith('Axion Issue #') or desc.startswith('PlanWiki Issue #'):
                continue
            uid = evt.get('uid')
            if not uid or uid in existing_uids:
                continue
            # Datum parsen
            try:
                start_dt = datetime.fromisoformat(evt['start'])
                end_str = evt.get('end') or evt['start']
                end_dt = datetime.fromisoformat(end_str)
            except (KeyError, ValueError):
                continue

            title = evt.get('title') or 'Importierter Termin'

            # Issue erstellen (wenn Projekt bekannt)
            issue_id = None
            if default_project_id:
                issue = Issue(
                    title=title,
                    description=desc or '',
                    type='task',
                    status='open',
                    priority='medium',
                    project_id=default_project_id,
                    due_date=start_dt.date(),
                )
                db.session.add(issue)
                db.session.flush()
                issue_id = issue.id

            entry = CalendarEntry(
                issue_id=issue_id,
                project_id=default_project_id,
                title=title if not issue_id else None,
                icloud_uid=uid,
                start_dt=start_dt,
                end_dt=end_dt,
            )
            db.session.add(entry)
            imported.append(entry)

        if imported:
            db.session.commit()

        return jsonify([e.to_dict() for e in imported]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.get('/status')
@login_required
def status():
    configured = _icloud_configured()
    return jsonify({'configured': configured}), 200
