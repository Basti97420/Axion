import threading
import time
from datetime import datetime

_thread = None
_running = False


def _check_loop(app):
    global _running
    while _running:
        try:
            with app.app_context():
                from app import db
                from app.models.calendar_entry import CalendarEntry
                from app.models.worklog import Worklog

                now = datetime.utcnow()

                entries = CalendarEntry.query.filter(
                    CalendarEntry.issue_id.isnot(None),
                    CalendarEntry.end_dt <= now,
                ).all()

                for entry in entries:
                    if Worklog.query.filter_by(calendar_entry_id=entry.id).first():
                        continue

                    duration_min = max(
                        1,
                        int((entry.end_dt - entry.start_dt).total_seconds() / 60),
                    )
                    title = (
                        entry.title
                        or (entry.issue.title if entry.issue else None)
                        or f'Eintrag #{entry.id}'
                    )
                    wl = Worklog(
                        issue_id=entry.issue_id,
                        user_id=None,
                        date=entry.end_dt.date(),
                        duration_min=duration_min,
                        description=f'Automatisch erfasst aus Kalendereintrag #{entry.id}: {title}',
                        calendar_entry_id=entry.id,
                    )
                    db.session.add(wl)

                db.session.commit()
        except Exception:
            pass

        time.sleep(60)


def start(app):
    global _thread, _running
    if _running:
        return
    _running = True
    _thread = threading.Thread(target=_check_loop, args=(app,), daemon=True)
    _thread.start()


def stop():
    global _running
    _running = False
