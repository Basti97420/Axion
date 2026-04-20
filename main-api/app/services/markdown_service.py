import re
import mistune


def _resolve_wiki_links(content: str) -> str:
    """Replace [[Page Title]] with HTML links. Red if page doesn't exist."""
    def replace_link(match):
        title = match.group(1).strip()
        from app.models.wiki_page import WikiPage
        from app import db
        # Erst nach Titel suchen (case-insensitive) → verwendet den echten gespeicherten Slug
        page = WikiPage.query.filter(
            db.func.lower(WikiPage.title) == title.lower()
        ).first()
        # Fallback: per slugify (Rückwärtskompatibilität)
        if not page:
            from slugify import slugify
            page = WikiPage.query.filter_by(slug=slugify(title)).first()
        if page:
            return f'<a href="/knowledge/{page.slug}" class="wiki-link">{title}</a>'
        else:
            from slugify import slugify
            fallback_slug = slugify(title)
            return f'<a href="/knowledge/{fallback_slug}" class="wiki-link wiki-link-new" title="Seite existiert noch nicht">{title}</a>'
    return re.sub(r'\[\[(.+?)\]\]', replace_link, content)


_md = mistune.create_markdown(
    escape=False,
    plugins=['table', 'strikethrough', 'task_lists', 'math'],
)


def render(content: str) -> str:
    resolved = _resolve_wiki_links(content)
    return _md(resolved)
