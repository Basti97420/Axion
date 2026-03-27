"""
Shared utility zum Lesen und Schreiben der settings.env Datei.
Diese Datei liegt im instance-Verzeichnis (data/main/settings.env in Docker)
und ist von außen direkt editierbar.
"""
import os
from dotenv import dotenv_values, set_key

_SETTINGS_FILE = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '../../instance/settings.env')
)

TEMPLATE = """\
# Axion Einstellungen
# Diese Datei wird von der App geschrieben und kann direkt bearbeitet werden.
# Änderungen wirken sofort – kein Neustart nötig.

# KI-Assistent
AI_PROVIDER=ollama
OLLAMA_URL=
OLLAMA_MODEL=llama3.2
CLAUDE_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-6

# Telegram Bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_DEFAULT_PROJECT_ID=
TELEGRAM_NOTIFY_ON_CREATE=true
TELEGRAM_NOTIFY_ON_STATUS_CHANGE=true
TELEGRAM_NOTIFY_INTERVAL_MIN=5

# iCloud Kalender
ICLOUD_USERNAME=
ICLOUD_APP_PASSWORD=
ICLOUD_CALENDAR_NAME=Axion
ICLOUD_DEFAULT_PROJECT_ID=
"""


def _path() -> str:
    return _SETTINGS_FILE


def _ensure_exists():
    """Legt die settings.env mit Template an falls sie noch nicht existiert."""
    p = _path()
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if not os.path.exists(p):
        with open(p, 'w') as f:
            f.write(TEMPLATE)


def read_all() -> dict:
    """Liest alle Keys aus settings.env (frisch, unabhängig von os.environ)."""
    p = _path()
    if not os.path.exists(p):
        return {}
    return dict(dotenv_values(p))


def read(key: str, default: str = '') -> str:
    """Liest einen einzelnen Key aus settings.env."""
    return read_all().get(key, default)


def write(key: str, value: str):
    """Schreibt/überschreibt einen Key in settings.env."""
    _ensure_exists()
    set_key(_path(), key, str(value), quote_mode='never')
