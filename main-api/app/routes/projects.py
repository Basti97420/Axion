from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models.project import Project
from app.models.activity import ActivityLog
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
