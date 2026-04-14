from datetime import datetime, timezone
from app import db


class TelegramMessage(db.Model):
    """Speichert Telegram-Nachrichten für KI-Kontext (Chat-Verlauf)."""
    __tablename__ = "telegram_messages"

    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.String(64), nullable=False, index=True)
    text = db.Column(db.Text, nullable=False)
    direction = db.Column(db.String(10), nullable=False)  # 'incoming' oder 'outgoing'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'chat_id': self.chat_id,
            'text': self.text,
            'direction': self.direction,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
