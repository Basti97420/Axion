import os
from flask import Blueprint, request, jsonify
from app.routes.settings import admin_required

bp = Blueprint('telegram_settings', __name__, url_prefix='/api/admin/settings')


def load_tg_config() -> dict:
    """Lädt die Telegram-Konfiguration aus settings.env."""
    from app.services.settings_env import read
    raw_pid = read('TELEGRAM_DEFAULT_PROJECT_ID', os.getenv('TELEGRAM_DEFAULT_PROJECT_ID', ''))
    try:
        project_id = int(raw_pid) if raw_pid else None
    except ValueError:
        project_id = None
    raw_interval = read('TELEGRAM_NOTIFY_INTERVAL_MIN', os.getenv('TELEGRAM_NOTIFY_INTERVAL_MIN', '5'))
    try:
        notify_interval = max(0, int(raw_interval)) if raw_interval else 5
    except ValueError:
        notify_interval = 5
    return {
        'bot_token':               read('TELEGRAM_BOT_TOKEN', os.getenv('TELEGRAM_BOT_TOKEN', '')),
        'chat_id':                 read('TELEGRAM_CHAT_ID',   os.getenv('TELEGRAM_CHAT_ID',   '')),
        'default_project_id':      project_id,
        'notify_on_create':        read('TELEGRAM_NOTIFY_ON_CREATE',        os.getenv('TELEGRAM_NOTIFY_ON_CREATE',        'true')) == 'true',
        'notify_on_status_change': read('TELEGRAM_NOTIFY_ON_STATUS_CHANGE', os.getenv('TELEGRAM_NOTIFY_ON_STATUS_CHANGE', 'true')) == 'true',
        'notify_interval_min':     notify_interval,
    }


def save_tg_config(config: dict):
    """Schreibt die Telegram-Konfiguration in settings.env."""
    from app.services.settings_env import write
    if config.get('bot_token'):
        write('TELEGRAM_BOT_TOKEN', config['bot_token'])
    write('TELEGRAM_CHAT_ID',                 config.get('chat_id', ''))
    write('TELEGRAM_DEFAULT_PROJECT_ID',      str(config.get('default_project_id') or ''))
    write('TELEGRAM_NOTIFY_ON_CREATE',        str(config.get('notify_on_create', True)).lower())
    write('TELEGRAM_NOTIFY_ON_STATUS_CHANGE', str(config.get('notify_on_status_change', True)).lower())
    write('TELEGRAM_NOTIFY_INTERVAL_MIN',     str(config.get('notify_interval_min', 5)))


def _mask(config: dict) -> dict:
    masked = dict(config)
    masked['bot_token'] = '***' if config.get('bot_token') else ''
    return masked


@bp.get('/telegram')
@admin_required
def get_telegram():
    return jsonify(_mask(load_tg_config()))


@bp.put('/telegram')
@admin_required
def update_telegram():
    from flask import current_app
    from app.services import telegram_bot as tg

    data = request.get_json() or {}
    config = load_tg_config()
    old_token = config.get('bot_token', '')

    for key in ('chat_id', 'default_project_id', 'notify_on_create', 'notify_on_status_change', 'notify_interval_min'):
        if key in data:
            config[key] = data[key]

    if 'bot_token' in data and data['bot_token'] != '***':
        config['bot_token'] = data['bot_token']

    save_tg_config(config)

    new_token = config.get('bot_token', '')
    new_chat  = config.get('chat_id', '')
    if new_token and new_chat and new_token != old_token:
        tg.restart(current_app._get_current_object())

    return jsonify(_mask(config))
