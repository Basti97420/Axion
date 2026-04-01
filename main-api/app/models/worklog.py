from datetime import datetime, timezone
from app import db


class Worklog(db.Model):
    __tablename__ = "worklogs"

    id = db.Column(db.Integer, primary_key=True)
    issue_id = db.Column(db.Integer, db.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    calendar_entry_id = db.Column(db.Integer, db.ForeignKey("calendar_entries.id", ondelete="SET NULL"), nullable=True)

    date = db.Column(db.Date, nullable=False)
    duration_min = db.Column(db.Integer, nullable=False)  # Dauer in Minuten
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "issue_id": self.issue_id,
            "user_id": self.user_id,
            "user_name": self.user.name if self.user else None,
            "date": self.date.isoformat() if self.date else None,
            "duration_min": self.duration_min,
            "duration_h": round(self.duration_min / 60, 2),
            "description": self.description,
            "calendar_entry_id": self.calendar_entry_id,
            "created_at": self.created_at.strftime('%Y-%m-%dT%H:%M:%SZ') if self.created_at else None,
        }
