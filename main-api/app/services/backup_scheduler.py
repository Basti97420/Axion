import threading
import time
from datetime import datetime, timedelta

_thread = None
_running = False


def _check_loop(app):
    global _running
    while _running:
        try:
            from app.services.settings_env import read
            enabled = read('BACKUP_ENABLED', 'true').lower() == 'true'
            if enabled:
                interval_days = int(read('BACKUP_INTERVAL_DAYS', '7') or '7')
                last_run_str = read('BACKUP_LAST_RUN', '')
                due = True
                if last_run_str:
                    try:
                        last_run = datetime.fromisoformat(last_run_str)
                        due = datetime.utcnow() >= last_run + timedelta(days=interval_days)
                    except ValueError:
                        due = True
                if due:
                    from app.routes.backup import _save_backup
                    _save_backup(app)
        except Exception:
            pass
        time.sleep(3600)  # stündlich prüfen


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
