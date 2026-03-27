import json
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
                from app.models.python_script import PythonScript, PythonScriptRun
                from app import db
                from app.services.python_script_service import run_script

                now = datetime.utcnow()
                weekday = now.weekday()  # 0=Mo, 6=So
                scripts = PythonScript.query.filter_by(
                    schedule_type='interval', is_active=True
                ).filter(PythonScript.next_run_at <= now).all()

                for script in scripts:
                    if script.schedule_days:
                        allowed = json.loads(script.schedule_days)
                        if weekday not in allowed:
                            continue
                    run = PythonScriptRun(script_id=script.id, triggered_by='scheduler')
                    db.session.add(run)
                    db.session.commit()
                    run_id = run.id
                    threading.Thread(
                        target=run_script,
                        args=(app, script.id, run_id),
                        daemon=True,
                    ).start()
        except Exception:
            pass
        time.sleep(30)


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
