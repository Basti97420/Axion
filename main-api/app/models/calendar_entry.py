from datetime import datetime
from app import db


class CalendarEntry(db.Model):
    __tablename__ = 'calendar_entries'

    id = db.Column(db.Integer, primary_key=True)
    issue_id = db.Column(db.Integer, db.ForeignKey('issues.id', ondelete='SET NULL'), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='SET NULL'), nullable=True)
    title = db.Column(db.String(255), nullable=True)   # für importierte iCloud-Events ohne Issue
    start_dt = db.Column(db.DateTime, nullable=False)
    end_dt = db.Column(db.DateTime, nullable=False)
    icloud_uid = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    issue = db.relationship('Issue', backref=db.backref('calendar_entries', lazy='dynamic'))

    def to_dict(self):
        from app.models.worklog import Worklog
        from app import db
        worklog_logged = db.session.query(Worklog).filter_by(
            calendar_entry_id=self.id
        ).first() is not None
        return {
            'id': self.id,
            'issue_id': self.issue_id,
            'project_id': self.project_id,
            'title': self.title or (self.issue.title if self.issue else None),
            'start_dt': self.start_dt.isoformat() if self.start_dt else None,
            'end_dt': self.end_dt.isoformat() if self.end_dt else None,
            'icloud_uid': self.icloud_uid,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'issue_title': self.issue.title if self.issue else None,
            'issue_status': self.issue.status if self.issue else None,
            'issue_priority': self.issue.priority if self.issue else None,
            'worklog_logged': worklog_logged,
        }
