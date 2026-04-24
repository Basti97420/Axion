import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_cors import CORS

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()


def create_app():
    app = Flask(__name__)

    from .config import get_config
    app.config.from_object(get_config())

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    login_manager.login_view = None  # API – kein Redirect, sondern 401

    cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    CORS(app, supports_credentials=True, origins=cors_origins)

    from .models import user, project, issue, tag, worklog, comment, activity, calendar_entry, milestone, attachment, user_settings, wiki_page, wiki_attachment, ki_agent, python_script, telegram_message, project_status  # noqa: F401

    from .routes.auth import bp as auth_bp
    from .routes.projects import bp as projects_bp
    from .routes.issues import bp as issues_bp
    from .routes.worklogs import bp as worklogs_bp
    from .routes.tags import bp as tags_bp
    from .routes.search import bp as search_bp
    from .routes.backup import bp as backup_bp
    from .routes.calendar_entries import bp as cal_entries_bp
    from .routes.milestones import bp as milestones_bp
    from .routes.admin import bp as admin_bp
    from .routes.ai import bp as ai_bp
    from .routes.settings import bp as settings_bp
    from .routes.attachments import bp as attachments_bp
    from .routes.user_settings import bp as user_settings_bp
    from .routes.telegram_settings import bp as telegram_settings_bp
    from .routes.wiki import bp as wiki_bp
    from .routes.wiki_attachments import bp as wiki_attach_bp
    from .routes.calendar_sync import bp as calendar_sync_bp
    from .routes.ki_agents import bp as ki_agents_bp
    from .routes.python_scripts import bp as python_scripts_bp, internal_bp as internal_scripts_bp
    from .routes.chat_workspace import bp as chat_workspace_bp
    from .routes.admin_db import bp as admin_db_bp

    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB (Wiki-Uploads)

    wiki_upload_dir = os.path.join(app.instance_path, 'wiki-uploads')
    app.config['WIKI_UPLOAD_FOLDER'] = wiki_upload_dir
    os.makedirs(wiki_upload_dir, exist_ok=True)

    app.config['ICLOUD_USERNAME'] = os.getenv('ICLOUD_USERNAME', '')
    app.config['ICLOUD_APP_PASSWORD'] = os.getenv('ICLOUD_APP_PASSWORD', '')
    app.config['ICLOUD_CALENDAR_NAME'] = os.getenv('ICLOUD_CALENDAR_NAME', 'PlanWiki')

    app.register_blueprint(auth_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(issues_bp)
    app.register_blueprint(worklogs_bp)
    app.register_blueprint(tags_bp)
    app.register_blueprint(search_bp)
    app.register_blueprint(backup_bp)
    app.register_blueprint(cal_entries_bp)
    app.register_blueprint(milestones_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(attachments_bp)
    app.register_blueprint(user_settings_bp)
    app.register_blueprint(telegram_settings_bp)
    app.register_blueprint(wiki_bp)
    app.register_blueprint(wiki_attach_bp)
    app.register_blueprint(calendar_sync_bp)
    app.register_blueprint(ki_agents_bp)
    app.register_blueprint(python_scripts_bp)
    app.register_blueprint(internal_scripts_bp)
    app.register_blueprint(chat_workspace_bp)
    app.register_blueprint(admin_db_bp)

    @login_manager.unauthorized_handler
    def unauthorized():
        from flask import jsonify
        return jsonify({"error": "Nicht angemeldet"}), 401

    # Telegram Bot starten (falls konfiguriert)
    from .services import telegram_bot as tg_service
    from .routes.telegram_settings import load_tg_config
    with app.app_context():
        tg_cfg = load_tg_config()
        if tg_cfg.get('bot_token') and tg_cfg.get('chat_id'):
            tg_service.start(app)

    # KI-Agenten-Scheduler starten
    from .services import ki_agent_scheduler
    ki_agent_scheduler.start(app)

    # Python-Script-Scheduler starten
    from .services import python_script_scheduler
    python_script_scheduler.start(app)

    # Worklog-Scheduler starten (Kalendereinträge → automatische Worklogs)
    from .services import worklog_scheduler
    worklog_scheduler.start(app)

    # Backup-Scheduler starten (automatische Datenbanksicherung)
    from .services import backup_scheduler
    backup_scheduler.start(app)

    # Python-Script-Token generieren falls noch nicht vorhanden
    with app.app_context():
        try:
            from .services.python_script_service import _get_script_token
            _get_script_token()
        except Exception:
            pass

    return app
