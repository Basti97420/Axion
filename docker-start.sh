#!/bin/sh

# Standard-Werte (überschreibbar mit docker run -e KEY=value)
export FLASK_ENV=${FLASK_ENV:-production}
export CORS_ORIGINS=${CORS_ORIGINS:-http://localhost}
export DATABASE_URL=${DATABASE_URL:-sqlite:////app/main-api/instance/planwiki.db}

# settings.env laden (falls vorhanden) – überschreibt obige Defaults
SETTINGS_ENV="/app/main-api/instance/settings.env"
if [ -f "$SETTINGS_ENV" ]; then
    set -a
    . "$SETTINGS_ENV"
    set +a
    echo ">>> settings.env geladen"
fi

# Ollama-URL für Docker setzen falls nicht in settings.env gesetzt
export OLLAMA_URL=${OLLAMA_URL:-http://host.docker.internal:11434}

# Secret Key einmalig generieren und im Volume persistieren (stabil über Neustarts)
KEY_FILE="/app/main-api/instance/.secret_key"
if [ -z "$SECRET_KEY" ]; then
    if [ -f "$KEY_FILE" ]; then
        export SECRET_KEY=$(cat "$KEY_FILE")
    else
        export SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
        echo "$SECRET_KEY" > "$KEY_FILE"
    fi
fi

# Supervisor-Log-Verzeichnis sicherstellen
mkdir -p /var/log/supervisor

# Datenbankmigrationen (nicht-fatal – Container startet auch bei Fehler)
echo ">>> Starte Datenbank-Migrationen..."
cd /app/main-api
if ! FLASK_APP=run.py flask db upgrade 2>&1; then
    echo "!!! WARNUNG: Migration fehlgeschlagen – Container startet trotzdem."
    echo "!!! Bitte Container-Logs in Unraid prüfen."
fi

echo ">>> Starte Services..."
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
