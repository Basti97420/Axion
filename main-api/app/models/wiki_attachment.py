from datetime import datetime
from app import db


class WikiAttachment(db.Model):
    __tablename__ = 'wiki_attachments'

    id = db.Column(db.Integer, primary_key=True)
    page_id = db.Column(db.Integer, db.ForeignKey('wiki_pages.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    filepath = db.Column(db.String(500), nullable=False)
    mime_type = db.Column(db.String(100), nullable=True)
    size_bytes = db.Column(db.Integer, nullable=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'page_id': self.page_id,
            'filename': self.filename,
            'mime_type': self.mime_type,
            'size_bytes': self.size_bytes,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
        }
