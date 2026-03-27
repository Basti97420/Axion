import caldav
import os

CALDAV_URL = "https://caldav.icloud.com"


def get_client():
    from app.services.settings_env import read
    username = read('ICLOUD_USERNAME') or os.getenv('ICLOUD_USERNAME', '')
    password = read('ICLOUD_APP_PASSWORD') or os.getenv('ICLOUD_APP_PASSWORD', '')
    return caldav.DAVClient(
        url=CALDAV_URL,
        username=username,
        password=password,
    )


def get_calendar():
    """Gibt den konfigurierten iCloud-Kalender zurück."""
    client = get_client()
    principal = client.principal()
    calendars = principal.calendars()
    from app.services.settings_env import read
    target_name = read('ICLOUD_CALENDAR_NAME', os.getenv('ICLOUD_CALENDAR_NAME', 'Axion'))

    for cal in calendars:
        if cal.name == target_name:
            return cal

    # Kalender existiert nicht → neu anlegen
    principal.make_calendar(name=target_name)

    # Neu laden und zurückgeben
    for cal in principal.calendars():
        if cal.name == target_name:
            return cal

    raise RuntimeError(f"Kalender '{target_name}' konnte nicht angelegt werden.")
