"""
Template für das axion.py Helper-Modul, das zur Laufzeit in das Script-Verzeichnis injiziert wird.
Platzhalter: {BASE_URL}, {SCRIPT_TOKEN}, {PROJECT_ID}
"""

TEMPLATE = '''import os
import requests as _requests

_base    = "{BASE_URL}"
_token   = "{SCRIPT_TOKEN}"
_proj    = {PROJECT_ID}
_headers = {{"X-Script-Token": _token}}


def get_issues(status=None, type=None):
    """Gibt alle Issues des Projekts zurück."""
    params = {{"project_id": _proj}}
    if status:
        params["status"] = status
    if type:
        params["type"] = type
    r = _requests.get(f"{{_base}}/api/internal/script/issues", params=params, headers=_headers)
    r.raise_for_status()
    return r.json()


def create_issue(title, description="", type="task", priority="medium"):
    """Erstellt ein neues Issue im Projekt."""
    r = _requests.post(f"{{_base}}/api/internal/script/issues",
        json={{"title": title, "description": description, "type": type,
               "priority": priority, "project_id": _proj}},
        headers=_headers)
    r.raise_for_status()
    return r.json()


def update_issue(issue_id, **kwargs):
    """Aktualisiert ein Issue (status, priority, title, description)."""
    r = _requests.put(f"{{_base}}/api/internal/script/issues/{{issue_id}}",
        json=kwargs, headers=_headers)
    r.raise_for_status()
    return r.json()


def add_comment(issue_id, content):
    """Fügt einen Kommentar zu einem Issue hinzu."""
    r = _requests.post(f"{{_base}}/api/internal/script/issues/{{issue_id}}/comments",
        json={{"content": content}}, headers=_headers)
    r.raise_for_status()
    return r.json()


def get_project(project_id=None):
    """Gibt Projektinfo zurück. Ohne Argument = eigenes Projekt."""
    pid = project_id or _proj
    r = _requests.get(f"{{_base}}/api/internal/script/projects/{{pid}}", headers=_headers)
    r.raise_for_status()
    return r.json()


def list_projects():
    """Gibt alle Projekte zurück."""
    r = _requests.get(f"{{_base}}/api/internal/script/projects", headers=_headers)
    r.raise_for_status()
    return r.json()


def get_wiki_page(slug):
    """Liest eine Wiki-Seite."""
    r = _requests.get(f"{{_base}}/api/internal/script/wiki/{{slug}}", headers=_headers)
    r.raise_for_status()
    return r.json()


def create_wiki_page(title, content, slug=None):
    """Erstellt eine neue Wiki-Seite."""
    r = _requests.post(f"{{_base}}/api/internal/script/wiki",
        json={{"title": title, "content": content, "slug": slug, "project_id": _proj}},
        headers=_headers)
    r.raise_for_status()
    return r.json()


def update_wiki_page(slug, content, title=None):
    """Aktualisiert eine bestehende Wiki-Seite."""
    payload = {{"slug": slug, "content": content}}
    if title:
        payload["title"] = title
    r = _requests.put(f"{{_base}}/api/internal/script/wiki/{{slug}}",
        json=payload, headers=_headers)
    r.raise_for_status()
    return r.json()


def list_agent_workspaces():
    """Gibt Liste aller Agent-Workspace-Ordner zurück."""
    base = os.path.join(os.environ.get("AXION_INSTANCE_PATH", ""), "agent-workspaces")
    result = []
    if os.path.isdir(base):
        for d in os.listdir(base):
            full = os.path.join(base, d)
            if os.path.isdir(full):
                files = [f for f in os.listdir(full)
                         if os.path.splitext(f)[1].lower() in (".md", ".txt", ".csv")]
                result.append({{"name": d, "path": full, "files": files}})
    return result


def read_workspace_file(workspace_name, filename):
    """Liest eine Datei aus einem Agent-Workspace."""
    path = os.path.join(os.environ.get("AXION_INSTANCE_PATH", ""),
                        "agent-workspaces", workspace_name, filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_file(filename, content):
    """Schreibt eine Datei in den Script-eigenen Workspace."""
    ws = os.environ.get("AXION_SCRIPT_WORKSPACE", ".")
    os.makedirs(ws, exist_ok=True)
    filepath = os.path.join(ws, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    return filepath


def list_my_files():
    """Listet Dateien im Script-eigenen Workspace."""
    ws = os.environ.get("AXION_SCRIPT_WORKSPACE", ".")
    if not os.path.isdir(ws):
        return []
    return [f for f in os.listdir(ws) if os.path.isfile(os.path.join(ws, f))]


def read_my_file(filename):
    """Liest eine Datei aus dem Script-eigenen Workspace."""
    ws = os.environ.get("AXION_SCRIPT_WORKSPACE", ".")
    with open(os.path.join(ws, filename), "r", encoding="utf-8") as f:
        return f.read()


def list_script_workspaces():
    """Listet alle Script-Workspaces im Projekt (nur lesen)."""
    base = os.path.join(os.environ.get("AXION_INSTANCE_PATH", ""),
                        "python-scripts", str(_proj))
    result = []
    if os.path.isdir(base):
        for name in os.listdir(base):
            ws_path = os.path.join(base, name)
            if os.path.isdir(ws_path):
                files = [f for f in os.listdir(ws_path)
                         if os.path.isfile(os.path.join(ws_path, f))
                         and os.path.splitext(f)[1].lower() in (".md", ".txt", ".csv", ".py")]
                result.append({{"name": name, "files": files}})
    return result


def read_script_file(workspace_name, filename):
    """Liest eine Datei aus einem anderen Script-Workspace."""
    base = os.path.join(os.environ.get("AXION_INSTANCE_PATH", ""),
                        "python-scripts", str(_proj))
    path = os.path.join(base, workspace_name, filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def create_calendar_entry(title, start_dt, end_dt, issue_id=None):
    """Erstellt einen Kalendereintrag im Projekt.

    Args:
        title:    Titel des Termins (str)
        start_dt: Startzeit als ISO-String, z.B. '2026-05-01T10:00:00'
        end_dt:   Endzeit als ISO-String, z.B. '2026-05-01T11:00:00'
        issue_id: Optionale Issue-ID für verknüpfte Termine (int oder None)

    Returns:
        dict mit id, title, start_dt, end_dt des angelegten Eintrags
    """
    r = _requests.post(
        f"{{_base}}/api/internal/script/calendar-entries",
        json={{"title": title, "start_dt": start_dt, "end_dt": end_dt,
               "issue_id": issue_id, "project_id": _proj}},
        headers=_headers,
    )
    r.raise_for_status()
    return r.json()


def list_calendar_entries(start=None, end=None):
    """Gibt Kalendereinträge des Projekts zurück.

    Args:
        start: Optionaler Startfilter als ISO-String '2026-05-01' oder '2026-05-01T00:00:00'
        end:   Optionaler Endfilter als ISO-String

    Returns:
        Liste von Kalendereintrags-Dicts (id, title, start_dt, end_dt, issue_id, ...)
    """
    params = {{"project_id": _proj}}
    if start:
        params["start"] = start
    if end:
        params["end"] = end
    r = _requests.get(
        f"{{_base}}/api/internal/script/calendar-entries",
        params=params,
        headers=_headers,
    )
    r.raise_for_status()
    return r.json()


def notify_telegram(message):
    """Sendet eine Telegram-Benachrichtigung.

    Die Nachricht wird in die Queue eingereiht und zusammen mit anderen
    Benachrichtigungen nach dem konfigurierten Intervall gesendet.
    Bei Intervall = 0 wird sofort gesendet.

    Args:
        message: Nachrichtentext (wird zu str konvertiert)
    """
    r = _requests.post(
        f"{{_base}}/api/internal/script/notify",
        json={{"message": str(message)}},
        headers=_headers,
    )
    r.raise_for_status()
    return r.json()
'''
