from datetime import date, datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from sqlalchemy import func
from app import db
from app.models.worklog import Worklog
from app.models.issue import Issue
from app.models.project import Project

bp = Blueprint("worklogs", __name__, url_prefix="/api")


@bp.route("/issues/<int:issue_id>/worklogs", methods=["GET"])
@login_required
def get_worklogs(issue_id):
    db.get_or_404(Issue, issue_id)
    worklogs = Worklog.query.filter_by(issue_id=issue_id).order_by(Worklog.date.desc()).all()
    return jsonify([w.to_dict() for w in worklogs]), 200


@bp.route("/issues/<int:issue_id>/worklogs", methods=["POST"])
@login_required
def create_worklog(issue_id):
    db.get_or_404(Issue, issue_id)
    data = request.get_json()
    if not data or not data.get("date") or not data.get("duration_min"):
        return jsonify({"error": "date und duration_min erforderlich"}), 400

    worklog = Worklog(
        issue_id=issue_id,
        user_id=current_user.id,
        date=date.fromisoformat(data["date"]),
        duration_min=int(data["duration_min"]),
        description=data.get("description", ""),
    )
    db.session.add(worklog)
    db.session.commit()
    return jsonify(worklog.to_dict()), 201


@bp.route("/worklogs/<int:worklog_id>", methods=["PUT"])
@login_required
def update_worklog(worklog_id):
    worklog = db.get_or_404(Worklog, worklog_id)
    data = request.get_json()
    if "date" in data:
        worklog.date = date.fromisoformat(data["date"])
    if "duration_min" in data:
        worklog.duration_min = int(data["duration_min"])
    if "description" in data:
        worklog.description = data["description"]
    db.session.commit()
    return jsonify(worklog.to_dict()), 200


@bp.route("/worklogs/<int:worklog_id>", methods=["DELETE"])
@login_required
def delete_worklog(worklog_id):
    worklog = db.get_or_404(Worklog, worklog_id)
    db.session.delete(worklog)
    db.session.commit()
    return jsonify({"message": "Worklog gelöscht"}), 200


@bp.route("/projects/<int:project_id>/worklogs", methods=["GET"])
@login_required
def get_project_worklogs(project_id):
    """Alle Worklogs für Issues eines Projekts, optional gefiltert nach Zeitraum."""
    weeks = int(request.args.get("weeks", 4))
    cutoff = (datetime.utcnow() - timedelta(weeks=weeks)).date()

    rows = (
        db.session.query(Worklog, Issue.title)
        .join(Issue, Worklog.issue_id == Issue.id)
        .filter(Issue.project_id == project_id)
        .filter(Worklog.date >= cutoff)
        .order_by(Worklog.date.desc())
        .all()
    )

    return jsonify([{**w.to_dict(), "issue_title": title} for w, title in rows]), 200


@bp.route("/worklogs/pending", methods=["GET"])
@login_required
def get_pending_worklogs():
    """Alle Auto-Buchungen die noch bestätigt werden müssen."""
    rows = (
        db.session.query(Worklog, Issue.title, Project.name)
        .join(Issue, Worklog.issue_id == Issue.id)
        .join(Project, Issue.project_id == Project.id)
        .filter(Worklog.needs_confirmation == True)
        .order_by(Worklog.created_at.desc())
        .all()
    )
    result = []
    for wl, issue_title, project_name in rows:
        d = wl.to_dict()
        d['issue_title'] = issue_title
        d['project_name'] = project_name
        result.append(d)
    return jsonify(result), 200


@bp.route("/worklogs/<int:worklog_id>/confirm", methods=["POST"])
@login_required
def confirm_worklog(worklog_id):
    """Bestätigt eine automatisch erstellte Zeitbuchung."""
    worklog = db.get_or_404(Worklog, worklog_id)
    worklog.needs_confirmation = False
    db.session.commit()
    return jsonify(worklog.to_dict()), 200


@bp.route("/worklog/summary", methods=["GET"])
@login_required
def worklog_summary():
    """Gibt gebuchte Minuten pro Tag zurück. Query-Params: start, end (ISO-Datum)"""
    start = request.args.get("start")
    end = request.args.get("end")

    query = db.session.query(
        Worklog.date,
        func.sum(Worklog.duration_min).label("total_min")
    )
    if start:
        query = query.filter(Worklog.date >= date.fromisoformat(start))
    if end:
        query = query.filter(Worklog.date <= date.fromisoformat(end))

    rows = query.group_by(Worklog.date).order_by(Worklog.date).all()
    return jsonify([
        {"date": row.date.isoformat(), "total_min": row.total_min, "total_h": round(row.total_min / 60, 2)}
        for row in rows
    ]), 200
