import re
import mistune


def _resolve_wiki_links(content: str) -> str:
    """Replace [[Page Title]] with HTML links. Red if page doesn't exist."""
    def replace_link(match):
        title = match.group(1).strip()
        from slugify import slugify
        slug = slugify(title)
        from app.models.wiki_page import WikiPage
        page = WikiPage.query.filter_by(slug=slug).first()
        if page:
            return f'<a href="/wiki/{slug}" class="wiki-link">{title}</a>'
        else:
            return f'<a href="/wiki/{slug}" class="wiki-link wiki-link-new" title="Seite existiert noch nicht">{title}</a>'
    return re.sub(r'\[\[(.+?)\]\]', replace_link, content)


_md = mistune.create_markdown(
    escape=False,
    plugins=['table', 'strikethrough', 'task_lists', 'math'],
)


def render(content: str) -> str:
    resolved = _resolve_wiki_links(content)
    return _md(resolved)
