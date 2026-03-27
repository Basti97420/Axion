from functools import wraps
from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from app import db
from app.models.user import User

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def admin_required(f):
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if not current_user.is_admin:
            return jsonify({"error": "Keine Berechtigung"}), 403
        return f(*args, **kwargs)
    return decorated


@bp.route("/users", methods=["GET"])
@admin_required
def list_users():
    users = User.query.order_by(User.name).all()
    return jsonify([u.to_dict() for u in users])


@bp.route("/users", methods=["POST"])
@admin_required
def create_user():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    password = data.get("password") or ""

    if not name:
        return jsonify({"error": "Name ist erforderlich"}), 400
    if len(password) < 4:
        return jsonify({"error": "Passwort muss mindestens 4 Zeichen haben"}), 400
    if User.query.filter_by(name=name).first():
        return jsonify({"error": "Benutzername bereits vergeben"}), 409

    user = User(name=name, is_admin=data.get("is_admin", False))
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@bp.route("/users/<int:user_id>", methods=["PUT"])
@admin_required
def update_user(user_id):
    user = db.get_or_404(User, user_id)
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    if name and name != user.name:
        if User.query.filter_by(name=name).first():
            return jsonify({"error": "Benutzername bereits vergeben"}), 409
        user.name = name

    password = data.get("password") or ""
    if password:
        if len(password) < 4:
            return jsonify({"error": "Passwort muss mindestens 4 Zeichen haben"}), 400
        user.set_password(password)

    if "is_admin" in data:
        user.is_admin = bool(data["is_admin"])

    db.session.commit()
    return jsonify(user.to_dict())


@bp.route("/users/<int:user_id>", methods=["DELETE"])
@admin_required
def delete_user(user_id):
    if user_id == current_user.id:
        return jsonify({"error": "Du kannst dich nicht selbst löschen"}), 400

    # Letzten Admin schützen
    user = db.get_or_404(User, user_id)
    if user.is_admin and User.query.filter_by(is_admin=True).count() <= 1:
        return jsonify({"error": "Der letzte Admin kann nicht gelöscht werden"}), 400

    db.session.delete(user)
    db.session.commit()
    return jsonify({"ok": True})
