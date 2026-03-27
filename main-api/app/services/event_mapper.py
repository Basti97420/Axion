from icalendar import Calendar, Event
from datetime import datetime, date, timezone
import uuid


def json_to_ical(data: dict) -> str:
    cal = Calendar()
    cal.add("prodid", "-//PlanWiki//DE")
    cal.add("version", "2.0")

    event = Event()
    event.add("summary", data["title"])
    event.add("description", data.get("description", ""))
    event.add("location", data.get("location", ""))
    event.add("uid", data.get("uid") or str(uuid.uuid4()))

    start_raw = data["start"]
    end_raw = data.get("end", data["start"])

    # Ganztags-Event wenn kein T im String
    if "T" not in start_raw:
        event.add("dtstart", date.fromisoformat(start_raw))
        event.add("dtend", date.fromisoformat(end_raw))
    else:
        event.add("dtstart", datetime.fromisoformat(start_raw))
        event.add("dtend", datetime.fromisoformat(end_raw))

    cal.add_component(event)
    return cal.to_ical().decode("utf-8")


def ical_to_json(vevent) -> dict:
    """Konvertiert ein caldav-Event-Objekt in ein sauberes JSON-Dict."""
    comp = vevent.icalendar_component

    def dt_iso(prop):
        val = comp.get(prop)
        if val is None:
            return None
        dt = val.dt
        if isinstance(dt, datetime):
            return dt.replace(tzinfo=None).isoformat()
        return dt.isoformat()  # date → "YYYY-MM-DD"

    return {
        "uid":         str(comp.get("uid", "")),
        "title":       str(comp.get("summary", "")),
        "start":       dt_iso("dtstart"),
        "end":         dt_iso("dtend"),
        "description": str(comp.get("description", "")),
        "location":    str(comp.get("location", "")),
        "source":      "icloud",
    }
