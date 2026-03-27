import json
from datetime import datetime
from app import db


class PythonScript(db.Model):
    __tablename__ = 'python_scripts'

    id            = db.Column(db.Integer, primary_key=True)
    project_id    = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    name          = db.Column(db.String(120), nullable=False)
    description   = db.Column(db.Text, default='')
    code          = db.Column(db.Text, default='')
    timeout_sec   = db.Column(db.Integer, default=30)
    is_active     = db.Column(db.Boolean, default=True)
    cells         = db.Column(db.Text, nullable=True)  # JSON-Array von Strings, null = Einfach-Modus
    schedule_type = db.Column(db.String(20), default='manual')  # 'manual' | 'interval'
    interval_min  = db.Column(db.Integer, default=60)
    last_run_at   = db.Column(db.DateTime, nullable=True)
    next_run_at   = db.Column(db.DateTime, nullable=True)
    schedule_days = db.Column(db.Text, nullable=True)  # JSON-Array [0..6] Mo=0 So=6, null = täglich
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    runs = db.relationship('PythonScriptRun', backref='script', lazy='dynamic',
                           cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':            self.id,
            'project_id':    self.project_id,
            'name':          self.name,
            'description':   self.description,
            'code':          self.code,
            'timeout_sec':   self.timeout_sec,
            'is_active':     self.is_active,
            'cells':         json.loads(self.cells) if self.cells else None,
            'schedule_type': self.schedule_type,
            'interval_min':  self.interval_min,
            'last_run_at':   self.last_run_at.isoformat() if self.last_run_at else None,
            'next_run_at':   self.next_run_at.isoformat() if self.next_run_at else None,
            'schedule_days': json.loads(self.schedule_days) if self.schedule_days else None,
            'created_at':    self.created_at.isoformat() if self.created_at else None,
        }


class PythonScriptRun(db.Model):
    __tablename__ = 'python_script_runs'

    id           = db.Column(db.Integer, primary_key=True)
    script_id    = db.Column(db.Integer, db.ForeignKey('python_scripts.id', ondelete='CASCADE'), nullable=False)
    started_at   = db.Column(db.DateTime, default=datetime.utcnow)
    finished_at  = db.Column(db.DateTime, nullable=True)
    stdout       = db.Column(db.Text, default='')
    stderr       = db.Column(db.Text, default='')
    exit_code    = db.Column(db.Integer, nullable=True)
    error        = db.Column(db.String(500), nullable=True)
    triggered_by = db.Column(db.String(20), default='manual')
    variables    = db.Column(db.Text, nullable=True)  # JSON: {"name": {"type": "...", "repr": "..."}}

    def to_dict(self):
        return {
            'id':           self.id,
            'script_id':    self.script_id,
            'started_at':   self.started_at.isoformat() if self.started_at else None,
            'finished_at':  self.finished_at.isoformat() if self.finished_at else None,
            'stdout':       self.stdout,
            'stderr':       self.stderr,
            'exit_code':    self.exit_code,
            'error':        self.error,
            'triggered_by': self.triggered_by,
            'variables':    json.loads(self.variables) if self.variables else None,
        }
