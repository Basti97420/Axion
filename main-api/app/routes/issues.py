from datetime import date, datetime
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models.issue import Issue, issue_dependencies
from app.models.comment import Comment
from app.models.activity import ActivityLog
from app.services import activity_logger
from app.services import telegram_bot as tg

bp = Blueprint("issues", __name__, url_prefix="/api/issues")

VALID_STATUSES = ["open", "in_progress", "hold", "in_review", "done", "cancelled"]
VALID_PRIORITIES = ["low", "medium", "high", "critical"]
VALID_TYPES = ["task", "bug", "story", "epic", "subtask"]


@bp.route("", methods=["GET"])
@login_required
def get_issues():
    query = Issue.query
    if pid := request.args.get("project_id"):
        query = query.filter_by(project_id=int(pid))
    if status := request.args.get("status"):
        query = query.filter_by(status=status)
    if priority := request.args.get("priority"):
        query = query.filter_by(priority=priority)
    if itype := request.args.get("type"):
        query = query.filter_by(type=itype)
    if assignee := request.args.get("assignee_id"):
        query = query.filter_by(assignee_id=int(assignee))
    issues = query.order_by(Issue.created_at.desc()).all()
    return jsonify([i.to_dict() for i in issues]), 200


@bp.route("", methods=["POST"])
@login_required
def create_issue():
    data = request.get_json()
    if not data or not data.get("title") or not data.get("project_id"):
        return jsonify({"error": "title und project_id erforderlich"}), 400

    issue = Issue(
        project_id=data["project_id"],
        title=data["title"].strip(),
        description=data.get("description", ""),
        type=data.get("type", "task"),
        status=data.get("status", "open"),
        priority=data.get("priority", "low"),
        assignee_id=data.get("assignee_id") or current_user.id,
        creator_id=current_user.id,
        parent_id=data.get("parent_id"),
        estimated_hours=data.get("estimated_hours"),
        milestone_id=data.get("milestone_id"),
    )

    if data.get("due_date"):
        issue.due_date = date.fromisoformat(data["due_date"])
    if data.get("start_date"):
        issue.start_date = date.fromisoformat(data["start_date"])

    db.session.add(issue)
    db.session.flush()
    activity_logger.log("created", user_id=current_user.id,
                        issue_id=issue.id, project_id=issue.project_id)
    db.session.commit()
    cfg = tg.load_tg_config()
    if cfg.get('notify_on_create') and cfg.get('bot_token') and cfg.get('chat_id'):
        tg.notify(f'🆕 Issue <b>#{issue.id}</b> erstellt: „{issue.title}" [{issue.priority}]')
    return jsonify(issue.to_dict()), 201


@bp.route("/<int:issue_id>", methods=["GET"])
@login_required
def get_issue(issue_id):
    issue = db.get_or_404(Issue, issue_id)
    return jsonify(issue.to_dict()), 200


@bp.route("/<int:issue_id>", methods=["PUT"])
@login_required
def update_issue(issue_id):
    issue = db.get_or_404(Issue, issue_id)
    data = request.get_json()

    fields = ["title", "description", "type", "priority", "assignee_id",
              "parent_id", "estimated_hours", "milestone_id"]
    for field in fields:
        if field in data:
            old = getattr(issue, field)
            new = data[field]
            if old != new:
                activity_logger.log("updated", user_id=current_user.id,
                                    issue_id=issue.id, project_id=issue.project_id,
                                    field_changed=field, old_value=old, new_value=new)
                setattr(issue, field, new)

    if "due_date" in data:
        new_due = date.fromisoformat(data["due_date"]) if data["due_date"] else None
        if issue.due_date != new_due:
            activity_logger.log("updated", user_id=current_user.id,
                                issue_id=issue.id, project_id=issue.project_id,
                                field_changed="due_date",
                                old_value=issue.due_date, new_value=new_due)
        issue.due_date = new_due

    if "start_date" in data:
        issue.start_date = date.fromisoformat(data["start_date"]) if data["start_date"] else None

    db.session.commit()
    return jsonify(issue.to_dict()), 200


@bp.route("/<int:issue_id>/status", methods=["PATCH"])
@login_required
def patch_status(issue_id):
    issue = db.get_or_404(Issue, issue_id)
    data = request.get_json()
    new_status = data.get("status")

    if new_status not in VALID_STATUSES:
        return jsonify({"error": f"Ungültiger Status. Erlaubt: {VALID_STATUSES}"}), 400

    # Story kann erst auf "done" gesetzt werden wenn alle Unteraufgaben abgeschlossen sind
    if issue.type == "story" and new_status == "done":
        subtasks = Issue.query.filter_by(parent_id=issue.id).all()
        incomplete = [s for s in subtasks if s.status not in ("done", "cancelled")]
        if incomplete:
            return jsonify({
                "error": f"Story kann erst abgeschlossen werden, wenn alle Unteraufgaben erledigt sind ({len(incomplete)} noch offen)."
            }), 400

    old_status = issue.status
    issue.status = new_status
    if new_status in ('done', 'cancelled'):
        issue.closed_at = datetime.utcnow()
    elif old_status in ('done', 'cancelled'):
        issue.closed_at = None
    activity_logger.log("status_changed", user_id=current_user.id,
                        issue_id=issue.id, project_id=issue.project_id,
                        field_changed="status", old_value=old_status, new_value=new_status)
    db.session.commit()
    cfg = tg.load_tg_config()
    if cfg.get('notify_on_status_change') and cfg.get('bot_token') and cfg.get('chat_id'):
        _labels = {'open': 'Offen', 'in_progress': 'In Arbeit', 'hold': 'Pausiert',
                   'in_review': 'Im Review', 'done': 'Erledigt', 'cancelled': 'Abgebrochen'}
        old_label = _labels.get(old_status, old_status)
        new_label = _labels.get(new_status, new_status)
        tg.notify(f'🔄 Issue <b>#{issue.id}</b> „{issue.title}": {old_label} → {new_label}')
    return jsonify(issue.to_dict()), 200


@bp.route("/<int:issue_id>/priority", methods=["PATCH"])
@login_required
def patch_priority(issue_id):
    issue = db.get_or_404(Issue, issue_id)
    data = request.get_json()
    new_priority = data.get("priority")
    if new_priority not in VALID_PRIORITIES:
        return jsonify({"error": f"Ungültige Priorität. Erlaubt: {VALID_PRIORITIES}"}), 400
    old_priority = issue.priority
    issue.priority = new_priority
    activity_logger.log("field_changed", user_id=current_user.id,
                        issue_id=issue.id, project_id=issue.project_id,
                        field_changed="priority", old_value=old_priority, new_value=new_priority)
    db.session.commit()
    return jsonify(issue.to_dict()), 200


@bp.route("/<int:issue_id>/due_date", methods=["PATCH"])
@login_required
def patch_due_date(issue_id):
    issue = db.get_or_404(Issue, issue_id)
    data = request.get_json()
    new_date = date.fromisoformat(data["due_date"]) if data.get("due_date") else None
    old_date = issue.due_date
    issue.due_date = new_date
    activity_logger.log("updated", user_id=current_user.id,
                        issue_id=issue.id, project_id=issue.project_id,
                        field_changed="due_date", old_value=old_date, new_value=new_date)
    db.session.commit()
    return jsonify(issue.to_dict()), 200


@bp.route("/<int:issue_id>", methods=["DELETE"])
@login_required
def delete_issue(issue_id):
    issue = db.get_or_404(Issue, issue_id)
    if request.args.get('delete_subtasks') == 'true':
        subtasks = Issue.query.filter_by(parent_id=issue_id).all()
        for sub in subtasks:
            db.session.delete(sub)
    db.session.delete(issue)
    db.session.commit()
    return jsonify({"message": "Issue gelöscht"}), 200


@bp.route("/<int:issue_id>/subtasks", methods=["GET"])
@login_required
def get_subtasks(issue_id):
    db.get_or_404(Issue, issue_id)
    subtasks = Issue.query.filter_by(parent_id=issue_id).all()
    return jsonify([i.to_dict() for i in subtasks]), 200


@bp.route("/<int:issue_id>/activity", methods=["GET"])
@login_required
def get_issue_activity(issue_id):
    db.get_or_404(Issue, issue_id)
    logs = ActivityLog.query.filter_by(issue_id=issue_id).order_by(ActivityLog.timestamp.desc()).all()
    return jsonify([l.to_dict() for l in logs]), 200


@bp.route("/<int:issue_id>/activity/<int:activity_id>/revert", methods=["POST"])
@login_required
def revert_activity(issue_id, activity_id):
    if not current_user.is_admin:
        return jsonify({"error": "Nur Admins können Aktionen rückgängig machen"}), 403

    issue = db.get_or_404(Issue, issue_id)
    log = db.get_or_404(ActivityLog, activity_id)

    if log.issue_id != issue_id:
        return jsonify({"error": "Aktivität gehört nicht zu diesem Issue"}), 400

    field = log.field_changed
    old_val = log.old_value

    REVERTABLE_ACTIONS = {'updated', 'status_changed', 'field_changed', 'ki_update', 'reverted'}
    if log.action not in REVERTABLE_ACTIONS or not field or old_val is None:
        return jsonify({"error": "Diese Aktion kann nicht rückgängig gemacht werden"}), 400

    INT_FIELDS = {'assignee_id', 'milestone_id', 'parent_id'}
    FLOAT_FIELDS = {'estimated_hours'}
    DATE_FIELDS = {'due_date', 'start_date'}

    if old_val == 'None':
        value = None
    elif field in INT_FIELDS:
        value = int(old_val)
    elif field in FLOAT_FIELDS:
        value = float(old_val)
    elif field in DATE_FIELDS:
        from datetime import date as dt_date
        value = dt_date.fromisoformat(old_val)
    else:
        value = old_val

    setattr(issue, field, value)
    activity_logger.log(
        "reverted",
        user_id=current_user.id,
        issue_id=issue.id,
        project_id=issue.project_id,
        field_changed=field,
        old_value=log.new_value,
        new_value=old_val,
    )
    db.session.commit()
    return jsonify(issue.to_dict()), 200


# --- Kommentare ---

@bp.route("/<int:issue_id>/comments", methods=["GET"])
@login_required
def get_comments(issue_id):
    db.get_or_404(Issue, issue_id)
    comments = Comment.query.filter_by(issue_id=issue_id).order_by(Comment.created_at.asc()).all()
    return jsonify([c.to_dict() for c in comments]), 200


@bp.route("/<int:issue_id>/comments", methods=["POST"])
@login_required
def create_comment(issue_id):
    db.get_or_404(Issue, issue_id)
    data = request.get_json()
    if not data or not data.get("content"):
        return jsonify({"error": "content erforderlich"}), 400

    comment = Comment(
        issue_id=issue_id,
        author_id=current_user.id,
        content=data["content"],
    )
    db.session.add(comment)
    db.session.flush()
    activity_logger.log("commented", user_id=current_user.id, issue_id=issue_id)
    db.session.commit()
    return jsonify(comment.to_dict()), 201


@bp.route("/<int:issue_id>/comments/<int:comment_id>", methods=["DELETE"])
@login_required
def delete_comment(issue_id, comment_id):
    comment = db.get_or_404(Comment, comment_id)
    if comment.issue_id != issue_id:
        return jsonify({"error": "Nicht gefunden"}), 404
    db.session.delete(comment)
    db.session.commit()
    return jsonify({"message": "Kommentar gelöscht"}), 200


# --- Abhängigkeiten ---

def _dep_summary(issue):
    return {'id': issue.id, 'title': issue.title, 'status': issue.status, 'priority': issue.priority}


@bp.route("/<int:issue_id>/dependencies", methods=["GET"])
@login_required
def get_dependencies(issue_id):
    issue = db.get_or_404(Issue, issue_id)
    return jsonify({
        'blocks':     [_dep_summary(i) for i in issue.blocks],
        'blocked_by': [_dep_summary(i) for i in issue.blocked_by_issues],
    })


@bp.route("/<int:issue_id>/dependencies", methods=["POST"])
@login_required
def add_dependency(issue_id):
    issue = db.get_or_404(Issue, issue_id)
    data = request.get_json()
    target_id = data.get('target_id')
    dep_type = data.get('type', 'blocks')  # 'blocks' or 'blocked_by'

    if not target_id:
        return jsonify({'error': 'target_id erforderlich'}), 400
    target = db.get_or_404(Issue, target_id)
    if target.id == issue.id:
        return jsonify({'error': 'Ein Issue kann sich nicht selbst blockieren'}), 400

    if dep_type == 'blocks':
        if target not in issue.blocks:
            issue.blocks.append(target)
    else:
        if issue not in target.blocks:
            target.blocks.append(issue)

    db.session.commit()
    return jsonify({'ok': True}), 201


@bp.route("/<int:issue_id>/dependencies/<int:target_id>", methods=["DELETE"])
@login_required
def remove_dependency(issue_id, target_id):
    issue = db.get_or_404(Issue, issue_id)
    target = db.get_or_404(Issue, target_id)
    dep_type = request.args.get('type', 'blocks')

    if dep_type == 'blocks':
        if target in issue.blocks:
            issue.blocks.remove(target)
    else:
        if issue in target.blocks:
            target.blocks.remove(issue)

    db.session.commit()
    return jsonify({'ok': True})
