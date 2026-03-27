from flask import Blueprint, request, jsonify
from flask_login import login_required
from app.models.issue import Issue
from app.models.comment import Comment

bp = Blueprint("search", __name__, url_prefix="/api/search")


@bp.route("", methods=["GET"])
@login_required
def global_search():
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        return jsonify({"issues": [], "comments": [], "wiki": []}), 200

    pattern = f"%{q}%"

    # Issues: Titel + Beschreibung
    issues = Issue.query.filter(
        (Issue.title.ilike(pattern)) | (Issue.description.ilike(pattern))
    ).limit(20).all()

    # Kommentare
    comments = Comment.query.filter(Comment.content.ilike(pattern)).limit(10).all()

    wiki_results = []
    try:
        from app.services.wiki_search_service import search as wiki_search
        wiki_results = wiki_search(q)
    except Exception:
        pass

    return jsonify({
        "issues": [i.to_dict(include_tags=False) for i in issues],
        "comments": [c.to_dict() for c in comments],
        "wiki": wiki_results,
    }), 200
