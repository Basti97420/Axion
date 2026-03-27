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
                from app.models.ki_agent import KiAgent, KiAgentRun
                from app import db
                from app.services.ki_agent_service import _run_agent_inner

                now = datetime.utcnow()
                weekday = now.weekday()  # 0=Mo, 6=So
                agents = KiAgent.query.filter_by(
                    schedule_type='interval', is_active=True
                ).filter(KiAgent.next_run_at <= now).all()

                for agent in agents:
                    if agent.schedule_days:
                        allowed = json.loads(agent.schedule_days)
                        if weekday not in allowed:
                            continue
                    run = KiAgentRun(agent_id=agent.id, triggered_by='scheduler')
                    db.session.add(run)
                    db.session.commit()
                    run_id = run.id
                    from app.services.ki_agent_service import run_agent
                    threading.Thread(
                        target=run_agent,
                        args=(app, agent.id, run_id, 'scheduler'),
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
