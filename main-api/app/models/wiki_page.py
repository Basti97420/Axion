from datetime import datetime
from app import db


class WikiPage(db.Model):
    __tablename__ = 'wiki_pages'

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(255), unique=True, nullable=False, index=True)
    title = db.Column(db.String(500), nullable=False)
    content = db.Column(db.Text, default='')
    parent_id = db.Column(db.Integer, db.ForeignKey('wiki_pages.id'), nullable=True)
    project_id = db.Column(db.Integer, nullable=True)
    created_by = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    children = db.relationship(
        'WikiPage',
        backref=db.backref('parent', remote_side=[id]),
        lazy='dynamic',
    )
    attachments = db.relationship(
        'WikiAttachment',
        backref='page',
        lazy='dynamic',
        cascade='all, delete-orphan',
    )

    def to_dict(self, include_content=True):
        d = {
            'id': self.id,
            'slug': self.slug,
            'title': self.title,
            'parent_id': self.parent_id,
            'project_id': self.project_id,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'has_children': self.children.count() > 0,
        }
        if include_content:
            d['content'] = self.content
        return d
