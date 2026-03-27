from app import db
from app.models.activity import ActivityLog


def log(action: str, user_id=None, issue_id=None, project_id=None,
        field_changed=None, old_value=None, new_value=None):
    """Erstellt einen Aktivitäts-Log-Eintrag."""
    entry = ActivityLog(
        action=action,
        user_id=user_id,
        issue_id=issue_id,
        project_id=project_id,
        field_changed=field_changed,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
    )
    db.session.add(entry)
    # Kein commit hier – wird vom aufrufenden Code zusammen mit anderen Änderungen committed
