from datetime import date
from flask import Blueprint, request, jsonify
from flask_login import login_required
from app import db
from app.models.milestone import Milestone
from app.models.project import Project

bp = Blueprint('milestones', __name__, url_prefix='/api')


@bp.get('/projects/<int:project_id>/milestones')
@login_required
def list_milestones(project_id):
    db.get_or_404(Project, project_id)
    milestones = Milestone.query.filter_by(project_id=project_id).order_by(Milestone.due_date.asc()).all()
    return jsonify([m.to_dict(with_stats=True) for m in milestones])


@bp.post('/projects/<int:project_id>/milestones')
@login_required
def create_milestone(project_id):
    db.get_or_404(Project, project_id)
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'name erforderlich'}), 400

    m = Milestone(
        project_id=project_id,
        name=data['name'].strip(),
        description=data.get('description', ''),
    )
    if data.get('due_date'):
        m.due_date = date.fromisoformat(data['due_date'])

    db.session.add(m)
    db.session.commit()
    return jsonify(m.to_dict(with_stats=True)), 201


@bp.get('/milestones/<int:milestone_id>')
@login_required
def get_milestone(milestone_id):
    m = db.get_or_404(Milestone, milestone_id)
    result = m.to_dict(with_stats=True)
    result['issues'] = [i.to_dict(include_tags=False) for i in m.issues.all()]
    return jsonify(result)


@bp.put('/milestones/<int:milestone_id>')
@login_required
def update_milestone(milestone_id):
    m = db.get_or_404(Milestone, milestone_id)
    data = request.get_json()

    if 'name' in data:
        m.name = data['name'].strip()
    if 'description' in data:
        m.description = data['description']
    if 'due_date' in data:
        m.due_date = date.fromisoformat(data['due_date']) if data['due_date'] else None

    db.session.commit()
    return jsonify(m.to_dict(with_stats=True))


@bp.delete('/milestones/<int:milestone_id>')
@login_required
def delete_milestone(milestone_id):
    m = db.get_or_404(Milestone, milestone_id)
    db.session.delete(m)
    db.session.commit()
    return jsonify({'ok': True})
