from datetime import datetime, timezone
from app import db


class Attachment(db.Model):
    __tablename__ = 'attachment'

    id = db.Column(db.Integer, primary_key=True)
    issue_id = db.Column(db.Integer, db.ForeignKey('issues.id', ondelete='CASCADE'), nullable=False)
    filename = db.Column(db.String(256), nullable=False)       # UUID-basierter Dateiname auf Disk
    original_name = db.Column(db.String(512), nullable=False)  # Originalname vom Upload
    size = db.Column(db.Integer, nullable=False)               # Bytes
    mime_type = db.Column(db.String(128), nullable=False, default='application/octet-stream')
    uploader_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    uploader = db.relationship('User', foreign_keys=[uploader_id])

    def to_dict(self):
        return {
            'id': self.id,
            'issue_id': self.issue_id,
            'original_name': self.original_name,
            'size': self.size,
            'mime_type': self.mime_type,
            'uploader_name': self.uploader.name if self.uploader else None,
            'uploader_id': self.uploader_id,
            'created_at': self.created_at.strftime('%Y-%m-%dT%H:%M:%SZ') if self.created_at else None,
        }
