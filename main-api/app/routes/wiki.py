from flask import Blueprint, request, jsonify
from flask_login import login_required
from slugify import slugify
from app import db
from app.models.wiki_page import WikiPage
from app.services import markdown_service, wiki_search_service

bp = Blueprint('wiki', __name__, url_prefix='/api/wiki')


@bp.get('/pages')
@login_required
def list_pages():
    project_id = request.args.get('project_id', type=int)
    parent_id = request.args.get('parent_id', type=int, default=None)
    query = WikiPage.query.filter_by(parent_id=parent_id)
    if project_id is not None:
        query = query.filter_by(project_id=project_id)
    pages = query.order_by(WikiPage.title).all()
    return jsonify([p.to_dict(include_content=False) for p in pages])


@bp.post('/pages')
@login_required
def create_page():
    data = request.get_json()
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Titel erforderlich'}), 400

    slug = slugify(title)
    base_slug = slug
    counter = 1
    while WikiPage.query.filter_by(slug=slug).first():
        slug = f'{base_slug}-{counter}'
        counter += 1

    page = WikiPage(
        slug=slug,
        title=title,
        content=data.get('content', ''),
        parent_id=data.get('parent_id'),
        project_id=data.get('project_id'),
        created_by=data.get('created_by'),
    )
    db.session.add(page)
    db.session.commit()
    return jsonify(page.to_dict()), 201


@bp.get('/pages/<slug>')
@login_required
def get_page(slug):
    page = WikiPage.query.filter_by(slug=slug).first_or_404()
    d = page.to_dict()
    d['rendered'] = markdown_service.render(page.content or '')
    d['attachments'] = [a.to_dict() for a in page.attachments]
    return jsonify(d)


@bp.put('/pages/<slug>')
@login_required
def update_page(slug):
    page = WikiPage.query.filter_by(slug=slug).first_or_404()
    data = request.get_json()
    if 'title' in data:
        page.title = data['title'].strip()
    if 'content' in data:
        page.content = data['content']
    if 'parent_id' in data:
        page.parent_id = data['parent_id']
    db.session.commit()
    d = page.to_dict()
    d['rendered'] = markdown_service.render(page.content or '')
    return jsonify(d)


@bp.delete('/pages/<slug>')
@login_required
def delete_page(slug):
    page = WikiPage.query.filter_by(slug=slug).first_or_404()
    db.session.delete(page)
    db.session.commit()
    return jsonify({'ok': True})


@bp.get('/pages/<slug>/children')
@login_required
def get_children(slug):
    page = WikiPage.query.filter_by(slug=slug).first_or_404()
    children = page.children.order_by(WikiPage.title).all()
    return jsonify([c.to_dict(include_content=False) for c in children])


@bp.get('/search')
@login_required
def search():
    q = request.args.get('q', '').strip()
    project_id = request.args.get('project_id', type=int)
    if not q:
        return jsonify([])
    results = wiki_search_service.search(q, project_id)
    return jsonify(results)


@bp.get('/render')
@login_required
def render_preview():
    content = request.args.get('content', '')
    return jsonify({'html': markdown_service.render(content)})
