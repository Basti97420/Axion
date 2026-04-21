from datetime import datetime
from app import db

DEFAULT_STATUSES = [
    {'key': 'open',        'label': 'Offen',       'color': 'bg-slate-100 text-slate-700',   'dot_color': 'bg-slate-400',  'position': 0, 'is_closed': False},
    {'key': 'in_progress', 'label': 'In Arbeit',   'color': 'bg-blue-100 text-blue-700',     'dot_color': 'bg-blue-500',   'position': 1, 'is_closed': False},
    {'key': 'hold',        'label': 'Pausiert',    'color': 'bg-orange-100 text-orange-700', 'dot_color': 'bg-orange-400', 'position': 2, 'is_closed': False},
    {'key': 'in_review',   'label': 'In Review',   'color': 'bg-yellow-100 text-yellow-700', 'dot_color': 'bg-yellow-500', 'position': 3, 'is_closed': False},
    {'key': 'done',        'label': 'Erledigt',    'color': 'bg-green-100 text-green-700',   'dot_color': 'bg-green-500',  'position': 4, 'is_closed': True},
    {'key': 'cancelled',   'label': 'Abgebrochen', 'color': 'bg-red-100 text-red-600',       'dot_color': 'bg-red-400',    'position': 5, 'is_closed': True},
]


class ProjectStatus(db.Model):
    __tablename__ = 'project_statuses'

    id         = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    key        = db.Column(db.String(50), nullable=False)
    label      = db.Column(db.String(100), nullable=False)
    color      = db.Column(db.String(100), nullable=False, default='bg-slate-100 text-slate-700')
    dot_color  = db.Column(db.String(50), nullable=False, default='bg-slate-400')
    position   = db.Column(db.Integer, nullable=False, default=0)
    is_closed  = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('project_id', 'key', name='uq_project_status_key'),)

    def to_dict(self):
        return {
            'id':         self.id,
            'project_id': self.project_id,
            'key':        self.key,
            'label':      self.label,
            'color':      self.color,
            'dot_color':  self.dot_color,
            'position':   self.position,
            'is_closed':  self.is_closed,
        }


def seed_default_statuses(project_id):
    """Legt die 6 Standard-Status für ein Projekt an (falls noch keine vorhanden)."""
    if ProjectStatus.query.filter_by(project_id=project_id).first():
        return
    for s in DEFAULT_STATUSES:
        db.session.add(ProjectStatus(
            project_id=project_id,
            key=s['key'], label=s['label'],
            color=s['color'], dot_color=s['dot_color'],
            position=s['position'], is_closed=s['is_closed'],
        ))
