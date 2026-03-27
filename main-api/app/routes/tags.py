from flask import Blueprint, request, jsonify
from flask_login import login_required
from app import db
from app.models.tag import Tag
from app.models.issue import Issue

bp = Blueprint("tags", __name__, url_prefix="/api/tags")


@bp.route("", methods=["GET"])
@login_required
def get_tags():
    project_id = request.args.get("project_id")
    if project_id:
        # Projekt-spezifische Tags + globale Tags
        tags = Tag.query.filter(
            (Tag.project_id == int(project_id)) | (Tag.project_id.is_(None))
        ).all()
    else:
        tags = Tag.query.all()
    return jsonify([t.to_dict() for t in tags]), 200


@bp.route("", methods=["POST"])
@login_required
def create_tag():
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "name erforderlich"}), 400

    tag = Tag(
        name=data["name"].strip(),
        color=data.get("color", "#94a3b8"),
        project_id=data.get("project_id"),
    )
    db.session.add(tag)
    db.session.commit()
    return jsonify(tag.to_dict()), 201


@bp.route("/<int:tag_id>", methods=["PUT"])
@login_required
def update_tag(tag_id):
    tag = db.get_or_404(Tag, tag_id)
    data = request.get_json()
    if "name" in data:
        tag.name = data["name"].strip()
    if "color" in data:
        tag.color = data["color"]
    db.session.commit()
    return jsonify(tag.to_dict()), 200


@bp.route("/<int:tag_id>", methods=["DELETE"])
@login_required
def delete_tag(tag_id):
    tag = db.get_or_404(Tag, tag_id)
    db.session.delete(tag)
    db.session.commit()
    return jsonify({"message": "Tag gelöscht"}), 200


# Tag einem Issue hinzufügen / entfernen
@bp.route("/issues/<int:issue_id>/tags", methods=["POST"])
@login_required
def add_tag_to_issue(issue_id):
    issue = db.get_or_404(Issue, issue_id)
    data = request.get_json()
    tag = db.get_or_404(Tag, data.get("tag_id"))
    if tag not in issue.tags:
        issue.tags.append(tag)
        db.session.commit()
    return jsonify(issue.to_dict()), 200


@bp.route("/issues/<int:issue_id>/tags/<int:tag_id>", methods=["DELETE"])
@login_required
def remove_tag_from_issue(issue_id, tag_id):
    issue = db.get_or_404(Issue, issue_id)
    tag = db.get_or_404(Tag, tag_id)
    if tag in issue.tags:
        issue.tags.remove(tag)
        db.session.commit()
    return jsonify(issue.to_dict()), 200
