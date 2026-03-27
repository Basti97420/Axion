from datetime import datetime, timezone
from app import db
from .tag import issue_tags

# Assoziationstabelle für Issue-Abhängigkeiten
issue_dependencies = db.Table(
    'issue_dependencies',
    db.Column('blocker_id', db.Integer, db.ForeignKey('issues.id', ondelete='CASCADE')),
    db.Column('blocked_id', db.Integer, db.ForeignKey('issues.id', ondelete='CASCADE')),
    db.PrimaryKeyConstraint('blocker_id', 'blocked_id'),
)


class Issue(db.Model):
    __tablename__ = "issues"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey("issues.id", ondelete="SET NULL"), nullable=True)
    milestone_id = db.Column(db.Integer, db.ForeignKey("milestones.id", ondelete="SET NULL"), nullable=True)

    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)  # Markdown-Rohtext

    type = db.Column(db.String(20), default="task")          # task, bug, story, epic, subtask
    status = db.Column(db.String(20), default="open")         # open, in_progress, in_review, done, cancelled
    priority = db.Column(db.String(20), default="low")         # low, medium, high, critical

    assignee_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    creator_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    due_date = db.Column(db.Date, nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    estimated_hours = db.Column(db.Float, nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
    closed_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    subtasks = db.relationship("Issue", backref=db.backref("parent", remote_side=[id]), lazy="dynamic")
    tags = db.relationship("Tag", secondary=issue_tags, backref=db.backref("issues", lazy="dynamic"), lazy="subquery")
    worklogs = db.relationship("Worklog", backref="issue", lazy="dynamic", cascade="all, delete-orphan")
    comments = db.relationship("Comment", backref="issue", lazy="dynamic", cascade="all, delete-orphan")
    activity_logs = db.relationship("ActivityLog", backref="issue", lazy="dynamic", cascade="all, delete-orphan")
    blocks = db.relationship(
        "Issue", secondary=issue_dependencies,
        primaryjoin=(id == issue_dependencies.c.blocker_id),
        secondaryjoin=(id == issue_dependencies.c.blocked_id),
        backref=db.backref("blocked_by_issues", lazy="subquery"),
        lazy="subquery",
    )

    def to_dict(self, include_tags=True):
        d = {
            "id": self.id,
            "project_id": self.project_id,
            "parent_id": self.parent_id,
            "title": self.title,
            "description": self.description,
            "type": self.type,
            "status": self.status,
            "priority": self.priority,
            "assignee_id": self.assignee_id,
            "assignee_name": self.assignee.name if self.assignee else None,
            "creator_id": self.creator_id,
            "creator_name": self.creator.name if self.creator else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "estimated_hours": self.estimated_hours,
            "milestone_id": self.milestone_id,
            "milestone_name": self.milestone.name if self.milestone else None,
            "created_at": self.created_at.strftime('%Y-%m-%dT%H:%M:%SZ') if self.created_at else None,
            "updated_at": self.updated_at.strftime('%Y-%m-%dT%H:%M:%SZ') if self.updated_at else None,
            "closed_at": self.closed_at.strftime('%Y-%m-%dT%H:%M:%SZ') if self.closed_at else None,
            "is_blocked": len(self.blocked_by_issues) > 0,
        }
        if include_tags:
            d["tags"] = [tag.to_dict() for tag in self.tags]
        d["subtasks_count"] = self.subtasks.count()
        return d
