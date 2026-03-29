import json
from datetime import datetime
from app import db


class KiAgent(db.Model):
    __tablename__ = 'ki_agents'

    id            = db.Column(db.Integer, primary_key=True)
    project_id    = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    name          = db.Column(db.String(120), nullable=False)
    api_provider  = db.Column(db.String(20), default='global')  # 'global' | 'ollama' | 'claude'
    api_url       = db.Column(db.String(500), default='')   # Ollama-Host, leer = global default
    api_model     = db.Column(db.String(100), default='')
    api_key       = db.Column(db.String(500), default='')
    schedule_type = db.Column(db.String(20), default='manual')  # 'manual' | 'interval'
    interval_min  = db.Column(db.Integer, default=60)
    website_url   = db.Column(db.String(500), default='')
    workspace     = db.Column(db.Text, default='')
    is_active       = db.Column(db.Boolean, default=True)
    dry_run         = db.Column(db.Boolean, default=False)
    notify_telegram = db.Column(db.Boolean, default=False)
    retry_on_error   = db.Column(db.Boolean, default=False)
    retry_max        = db.Column(db.Integer, default=3)
    retry_delay_min  = db.Column(db.Integer, default=5)
    last_run_at     = db.Column(db.DateTime, nullable=True)
    next_run_at     = db.Column(db.DateTime, nullable=True)
    schedule_days   = db.Column(db.Text, nullable=True)  # JSON-Array [0..6] Mo=0 So=6, null = täglich
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    runs = db.relationship('KiAgentRun', backref='agent', lazy='dynamic',
                           cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':            self.id,
            'project_id':    self.project_id,
            'name':          self.name,
            'api_provider':  self.api_provider,
            'api_url':       self.api_url,
            'api_model':     self.api_model,
            'api_key':       '***' if self.api_key else '',
            'schedule_type': self.schedule_type,
            'interval_min':  self.interval_min,
            'website_url':   self.website_url,
            'workspace':     self.workspace,
            'is_active':       self.is_active,
            'dry_run':         self.dry_run,
            'notify_telegram': self.notify_telegram,
            'retry_on_error':  self.retry_on_error,
            'retry_max':       self.retry_max,
            'retry_delay_min': self.retry_delay_min,
            'last_run_at':     self.last_run_at.isoformat() if self.last_run_at else None,
            'next_run_at':     self.next_run_at.isoformat() if self.next_run_at else None,
            'schedule_days':   json.loads(self.schedule_days) if self.schedule_days else None,
            'created_at':      self.created_at.isoformat() if self.created_at else None,
        }


class KiAgentRun(db.Model):
    __tablename__ = 'ki_agent_runs'

    id           = db.Column(db.Integer, primary_key=True)
    agent_id     = db.Column(db.Integer, db.ForeignKey('ki_agents.id', ondelete='CASCADE'), nullable=False)
    started_at   = db.Column(db.DateTime, default=datetime.utcnow)
    finished_at  = db.Column(db.DateTime, nullable=True)
    output       = db.Column(db.Text, default='')
    actions      = db.Column(db.Text, default='[]')  # JSON-Liste
    error        = db.Column(db.String(500), nullable=True)
    triggered_by = db.Column(db.String(20), default='manual')  # 'manual' | 'scheduler'
    tokens_in    = db.Column(db.Integer, default=0)  # Anzahl Input-Tokens (Prompt)
    tokens_out   = db.Column(db.Integer, default=0)  # Anzahl Output-Tokens (Antwort)

    def to_dict(self):
        return {
            'id':           self.id,
            'agent_id':     self.agent_id,
            'started_at':   self.started_at.isoformat() if self.started_at else None,
            'finished_at':  self.finished_at.isoformat() if self.finished_at else None,
            'output':       self.output,
            'actions':      self.actions,
            'error':        self.error,
            'triggered_by': self.triggered_by,
            'tokens_in':    self.tokens_in  or 0,
            'tokens_out':   self.tokens_out or 0,
        }
