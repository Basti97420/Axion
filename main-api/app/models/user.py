from datetime import datetime, timezone
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from app import db, login_manager


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_login = db.Column(db.DateTime, nullable=True)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)

    # Relationships
    assigned_issues = db.relationship("Issue", foreign_keys="Issue.assignee_id", backref="assignee", lazy="dynamic")
    created_issues = db.relationship("Issue", foreign_keys="Issue.creator_id", backref="creator", lazy="dynamic")
    worklogs = db.relationship("Worklog", backref="user", lazy="dynamic")
    comments = db.relationship("Comment", backref="author", lazy="dynamic")

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password, method="pbkdf2:sha256")

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "is_admin": self.is_admin,
            "created_at": self.created_at.strftime('%Y-%m-%dT%H:%M:%SZ') if self.created_at else None,
            "last_login": self.last_login.strftime('%Y-%m-%dT%H:%M:%SZ') if self.last_login else None,
        }


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))
