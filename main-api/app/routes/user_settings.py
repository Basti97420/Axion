from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app import db
from app.models.user_settings import UserSettings
from app.services.settings_env import read as env_read, write as env_write

bp = Blueprint("user_settings", __name__)


@bp.route("/api/user/settings", methods=["GET"])
@login_required
def get_settings():
    settings = UserSettings.query.filter_by(user_id=current_user.id).first()
    if not settings:
        # Felder aus settings.env als Fallback
        return jsonify({
            "icloud_username":    env_read('ICLOUD_USERNAME', ''),
            "icloud_app_password": '***' if env_read('ICLOUD_APP_PASSWORD') else '',
            "ai_provider": "", "ollama_url": "", "ollama_model": "",
            "claude_api_key": "", "claude_model": "", "timezone": "",
        })
    d = settings.to_dict()
    # iCloud-Fallback aus settings.env wenn DB-Felder leer
    if not d.get('icloud_username'):
        d['icloud_username'] = env_read('ICLOUD_USERNAME', '')
    if not d.get('icloud_app_password'):
        d['icloud_app_password'] = '***' if env_read('ICLOUD_APP_PASSWORD') else ''
    return jsonify(d)


@bp.route("/api/user/settings", methods=["PUT"])
@login_required
def save_settings():
    data = request.get_json() or {}
    settings = UserSettings.query.filter_by(user_id=current_user.id).first()
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.session.add(settings)

    if "icloud_username" in data:
        settings.icloud_username = data["icloud_username"] or None
        env_write('ICLOUD_USERNAME', data["icloud_username"] or '')

    # Only overwrite secrets if a non-empty, non-masked value is provided
    if data.get("icloud_app_password") and data["icloud_app_password"] != "***":
        settings.icloud_app_password = data["icloud_app_password"]
        env_write('ICLOUD_APP_PASSWORD', data["icloud_app_password"])
    elif data.get("icloud_app_password") == "":
        settings.icloud_app_password = None
        env_write('ICLOUD_APP_PASSWORD', '')

    if data.get("claude_api_key") and data["claude_api_key"] != "***":
        settings.claude_api_key = data["claude_api_key"]
    elif data.get("claude_api_key") == "":
        settings.claude_api_key = None

    # KI-Einstellungen
    if "ai_provider" in data:
        settings.ai_provider = data["ai_provider"] or None
    if "ollama_url" in data:
        settings.ollama_url = data["ollama_url"] or None
    if "ollama_model" in data:
        settings.ollama_model = data["ollama_model"] or None
    if "claude_model" in data:
        settings.claude_model = data["claude_model"] or None
    if "timezone" in data:
        settings.timezone = data["timezone"] or None

    db.session.commit()
    return jsonify(settings.to_dict())
