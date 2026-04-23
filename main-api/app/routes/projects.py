from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models.project import Project
from app.models.activity import ActivityLog
from app.models.project_status import ProjectStatus, seed_default_statuses
from app.services import activity_logger

bp = Blueprint("projects", __name__, url_prefix="/api/projects")


@bp.route("", methods=["GET"])
@login_required
def get_projects():
    projects = Project.query.order_by(Project.created_at.desc()).all()
    return jsonify([p.to_dict() for p in projects]), 200


@bp.route("", methods=["POST"])
@login_required
def create_project():
    data = request.get_json()
    if not data or not data.get("name") or not data.get("key"):
        return jsonify({"error": "Name und Key erforderlich"}), 400

    key = data["key"].upper().strip()
    if Project.query.filter_by(key=key).first():
        return jsonify({"error": f"Key '{key}' ist bereits vergeben"}), 409

    project = Project(
        name=data["name"].strip(),
        description=data.get("description", ""),
        key=key,
        color=data.get("color", "#6366f1"),
    )
    db.session.add(project)
    db.session.flush()  # ID generieren vor dem Log
    seed_default_statuses(project.id)
    activity_logger.log("created", user_id=current_user.id, project_id=project.id)
    db.session.commit()
    return jsonify(project.to_dict()), 201


@bp.route("/<int:project_id>", methods=["GET"])
@login_required
def get_project(project_id):
    project = db.get_or_404(Project, project_id)
    return jsonify(project.to_dict()), 200


@bp.route("/<int:project_id>", methods=["PUT"])
@login_required
def update_project(project_id):
    project = db.get_or_404(Project, project_id)
    data = request.get_json()

    if "name" in data:
        project.name = data["name"].strip()
    if "description" in data:
        project.description = data["description"]
    if "color" in data:
        project.color = data["color"]

    activity_logger.log("updated", user_id=current_user.id, project_id=project.id)
    db.session.commit()
    return jsonify(project.to_dict()), 200


@bp.route("/<int:project_id>", methods=["DELETE"])
@login_required
def delete_project(project_id):
    project = db.get_or_404(Project, project_id)
    db.session.delete(project)
    db.session.commit()
    return jsonify({"message": "Projekt gelöscht"}), 200


@bp.route("/<int:project_id>/issues", methods=["GET"])
@login_required
def get_project_issues(project_id):
    db.get_or_404(Project, project_id)
    from app.models.issue import Issue
    issues = Issue.query.filter_by(project_id=project_id).order_by(Issue.created_at.desc()).all()
    return jsonify([i.to_dict() for i in issues]), 200


@bp.route("/<int:project_id>/log", methods=["GET"])
@login_required
def get_project_log(project_id):
    db.get_or_404(Project, project_id)
    logs = ActivityLog.query.filter_by(project_id=project_id).order_by(ActivityLog.timestamp.desc()).limit(100).all()
    return jsonify([l.to_dict() for l in logs]), 200


# ── Projekt-Status CRUD ────────────────────────────────────────────────────────

@bp.route("/<int:project_id>/statuses", methods=["GET"])
@login_required
def get_statuses(project_id):
    db.get_or_404(Project, project_id)
    statuses = ProjectStatus.query.filter_by(project_id=project_id).order_by(ProjectStatus.position).all()
    return jsonify([s.to_dict() for s in statuses]), 200


@bp.route("/<int:project_id>/statuses", methods=["POST"])
@login_required
def create_status(project_id):
    db.get_or_404(Project, project_id)
    data = request.get_json()
    if not data or not data.get("label"):
        return jsonify({"error": "label erforderlich"}), 400

    # key aus label ableiten (slug)
    import re
    key = re.sub(r'[^a-z0-9]+', '_', data["label"].lower().strip()).strip('_')
    if not key:
        return jsonify({"error": "Ungültiger Label"}), 400

    # Eindeutigkeit sicherstellen
    base_key = key
    counter = 1
    while ProjectStatus.query.filter_by(project_id=project_id, key=key).first():
        key = f"{base_key}_{counter}"
        counter += 1

    # Position = Ende der Liste
    max_pos = db.session.query(db.func.max(ProjectStatus.position)).filter_by(project_id=project_id).scalar() or 0

    status = ProjectStatus(
        project_id=project_id,
        key=key,
        label=data["label"].strip(),
        color=data.get("color", "bg-slate-100 text-slate-700"),
        dot_color=data.get("dot_color", "bg-slate-400"),
        position=max_pos + 1,
        is_closed=bool(data.get("is_closed", False)),
    )
    db.session.add(status)
    db.session.commit()
    return jsonify(status.to_dict()), 201


@bp.route("/<int:project_id>/statuses/<int:status_id>", methods=["PUT"])
@login_required
def update_status(project_id, status_id):
    status = ProjectStatus.query.filter_by(id=status_id, project_id=project_id).first_or_404()
    data = request.get_json()
    if "label" in data:
        status.label = data["label"].strip()
    if "color" in data:
        status.color = data["color"]
    if "dot_color" in data:
        status.dot_color = data["dot_color"]
    if "is_closed" in data:
        status.is_closed = bool(data["is_closed"])
    if "position" in data:
        status.position = int(data["position"])
    db.session.commit()
    return jsonify(status.to_dict()), 200


@bp.route("/<int:project_id>/statuses/<int:status_id>", methods=["DELETE"])
@login_required
def delete_status(project_id, status_id):
    status = ProjectStatus.query.filter_by(id=status_id, project_id=project_id).first_or_404()
    if status.key == 'open':
        return jsonify({"error": "Der Status \"Offen\" ist systemreserviert und kann nicht gelöscht werden (wird vom Telegram-Bot und für neue Issues benötigt)."}), 400
    from app.models.issue import Issue
    in_use = Issue.query.filter_by(project_id=project_id, status=status.key).count()
    if in_use:
        return jsonify({"error": f"Status wird noch von {in_use} Issue(s) verwendet und kann nicht gelöscht werden."}), 409
    db.session.delete(status)
    db.session.commit()
    return jsonify({"message": "Status gelöscht"}), 200
