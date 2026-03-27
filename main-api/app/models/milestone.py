from datetime import datetime
from app import db


class Milestone(db.Model):
    __tablename__ = 'milestones'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    issues = db.relationship('Issue', backref='milestone', lazy='dynamic',
                             foreign_keys='Issue.milestone_id')

    def to_dict(self, with_stats=False):
        d = {
            'id': self.id,
            'project_id': self.project_id,
            'name': self.name,
            'description': self.description,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if with_stats:
            total = self.issues.count()
            done = self.issues.filter_by(status='done').count()
            d['total_issues'] = total
            d['done_issues'] = done
            d['progress'] = round(done / total * 100) if total else 0
        return d
