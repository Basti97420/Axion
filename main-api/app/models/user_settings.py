from app import db


class UserSettings(db.Model):
    __tablename__ = "user_settings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    icloud_username = db.Column(db.String(255), nullable=True)
    icloud_app_password = db.Column(db.String(255), nullable=True)
    # KI-Einstellungen
    ai_provider = db.Column(db.String(20), nullable=True)          # 'ollama' | 'claude' | None (global)
    ollama_url = db.Column(db.String(255), nullable=True)
    ollama_model = db.Column(db.String(100), nullable=True)
    claude_api_key = db.Column(db.String(255), nullable=True)
    claude_model = db.Column(db.String(100), nullable=True)
    timezone = db.Column(db.String(50), nullable=True)  # z.B. "Europe/Berlin"

    user = db.relationship("User", backref=db.backref("settings", uselist=False))

    def to_dict(self, mask_secrets=True):
        return {
            "icloud_username": self.icloud_username or "",
            "icloud_app_password": "***" if (mask_secrets and self.icloud_app_password) else (self.icloud_app_password or ""),
            "ai_provider": self.ai_provider or "",
            "ollama_url": self.ollama_url or "",
            "ollama_model": self.ollama_model or "",
            "claude_api_key": "***" if (mask_secrets and self.claude_api_key) else (self.claude_api_key or ""),
            "claude_model": self.claude_model or "",
            "timezone": self.timezone or "",
        }
