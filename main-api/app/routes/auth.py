from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from app import db
from app.models.user import User

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or not data.get("name") or not data.get("password"):
        return jsonify({"error": "Name und Passwort erforderlich"}), 400

    user = User.query.filter_by(name=data["name"]).first()
    if not user or not user.check_password(data["password"]):
        return jsonify({"error": "Ungültige Anmeldedaten"}), 401

    user.last_login = datetime.now(timezone.utc)
    db.session.commit()
    remember = bool(data.get("remember", False))
    login_user(user, remember=remember)
    return jsonify({"user": user.to_dict()}), 200


@bp.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Abgemeldet"}), 200


@bp.route("/me", methods=["GET"])
@login_required
def me():
    return jsonify({"user": current_user.to_dict()}), 200


@bp.route("/password", methods=["PATCH"])
@login_required
def change_password():
    data = request.get_json()
    current_password = (data or {}).get("current_password", "")
    new_password = (data or {}).get("new_password", "")

    if not current_user.check_password(current_password):
        return jsonify({"error": "Aktuelles Passwort ist falsch"}), 400
    if len(new_password) < 4:
        return jsonify({"error": "Neues Passwort muss mindestens 4 Zeichen haben"}), 400

    current_user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "Passwort geändert"}), 200


@bp.route("/setup-info", methods=["GET"])
def setup_info():
    """Gibt zurück ob noch keine Nutzer existieren (erster Start)."""
    return jsonify({"first_run": User.query.count() == 0})
