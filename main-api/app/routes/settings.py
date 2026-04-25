import os
from functools import wraps
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

bp = Blueprint('settings', __name__, url_prefix='/api/admin/settings')


def load_ai_config() -> dict:
    """Lädt die KI-Konfiguration aus settings.env."""
    from app.services.settings_env import read
    try:
        max_tokens = int(read('AI_MAX_TOKENS', os.getenv('AI_MAX_TOKENS', '4096')))
    except (ValueError, TypeError):
        max_tokens = 4096
    return {
        'provider':       read('AI_PROVIDER',   os.getenv('AI_PROVIDER',   'ollama')),
        'ollama_url':     read('OLLAMA_URL', os.getenv('OLLAMA_URL', 'http://localhost:11434')),
        'ollama_model':   read('OLLAMA_MODEL',   os.getenv('OLLAMA_MODEL',   'llama3.2')),
        'claude_api_key': read('CLAUDE_API_KEY', os.getenv('CLAUDE_API_KEY', '')),
        'claude_model':   read('CLAUDE_MODEL',   os.getenv('CLAUDE_MODEL',   'claude-sonnet-4-6')),
        'max_tokens':     max_tokens,
    }


def save_ai_config(config: dict):
    """Schreibt die KI-Konfiguration in settings.env."""
    from app.services.settings_env import write
    write('AI_PROVIDER',  config.get('provider',     'ollama'))
    write('OLLAMA_URL',   config.get('ollama_url',   ''))
    write('OLLAMA_MODEL', config.get('ollama_model', ''))
    if config.get('claude_api_key'):
        write('CLAUDE_API_KEY', config['claude_api_key'])
    write('CLAUDE_MODEL', config.get('claude_model', ''))
    try:
        mt = max(256, min(32768, int(config.get('max_tokens', 4096))))
    except (ValueError, TypeError):
        mt = 4096
    write('AI_MAX_TOKENS', str(mt))


def _mask(config: dict) -> dict:
    masked = dict(config)
    masked['claude_api_key'] = '***' if config.get('claude_api_key') else ''
    return masked


def admin_required(f):
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if not current_user.is_admin:
            return jsonify({'error': 'Keine Berechtigung'}), 403
        return f(*args, **kwargs)
    return decorated


@bp.get('/ai')
@admin_required
def get_ai_config():
    return jsonify(_mask(load_ai_config()))


@bp.put('/ai')
@admin_required
def update_ai_config():
    data = request.get_json() or {}
    config = load_ai_config()

    allowed = {'provider', 'ollama_url', 'ollama_model', 'claude_api_key', 'claude_model', 'max_tokens'}
    for key in allowed:
        if key in data:
            if key == 'claude_api_key' and data[key] == '***':
                continue
            config[key] = data[key]

    save_ai_config(config)
    return jsonify(_mask(config))


# ── iCloud-Einstellungen ──────────────────────────────────────────────────────

def load_icloud_config() -> dict:
    from app.services.settings_env import read
    raw_pid = read('ICLOUD_DEFAULT_PROJECT_ID', os.getenv('ICLOUD_DEFAULT_PROJECT_ID', ''))
    try:
        default_project_id = int(raw_pid) if raw_pid else None
    except ValueError:
        default_project_id = None
    return {
        'username':           read('ICLOUD_USERNAME',      os.getenv('ICLOUD_USERNAME',      '')),
        'app_password':       read('ICLOUD_APP_PASSWORD',  os.getenv('ICLOUD_APP_PASSWORD',  '')),
        'calendar_name':      read('ICLOUD_CALENDAR_NAME', os.getenv('ICLOUD_CALENDAR_NAME', 'Axion')),
        'default_project_id': default_project_id,
    }


def save_icloud_config(config: dict):
    from app.services.settings_env import write
    write('ICLOUD_USERNAME',            config.get('username',           ''))
    write('ICLOUD_APP_PASSWORD',        config.get('app_password',       ''))
    write('ICLOUD_CALENDAR_NAME',       config.get('calendar_name',      'Axion'))
    write('ICLOUD_DEFAULT_PROJECT_ID',  str(config.get('default_project_id') or ''))


def _mask_icloud(config: dict) -> dict:
    masked = dict(config)
    masked['app_password'] = '***' if config.get('app_password') else ''
    return masked


@bp.get('/icloud')
@admin_required
def get_icloud_config():
    return jsonify(_mask_icloud(load_icloud_config()))


@bp.put('/icloud')
@admin_required
def update_icloud_config():
    data = request.get_json() or {}
    config = load_icloud_config()
    if 'username' in data:
        config['username'] = data['username']
    if 'app_password' in data and data['app_password'] != '***':
        config['app_password'] = data['app_password']
    if 'calendar_name' in data:
        config['calendar_name'] = data['calendar_name']
    if 'default_project_id' in data:
        config['default_project_id'] = data['default_project_id']
    save_icloud_config(config)
    return jsonify(_mask_icloud(config))
