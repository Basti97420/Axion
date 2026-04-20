import re
import bleach
import mistune

# Erlaubte HTML-Tags nach dem Rendering
_ALLOWED_TAGS = {
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'strong', 'em', 'del', 's', 'b', 'i',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'span', 'section',
    # KaTeX-Math-Elemente
    'math', 'annotation', 'semantics',
    'mrow', 'mi', 'mn', 'mo', 'mfrac', 'msup', 'msub', 'msubsup',
    'msqrt', 'mroot', 'mtext', 'mspace', 'mover', 'munder', 'munderover',
    'mtable', 'mtr', 'mtd', 'mpadded', 'mphantom', 'menclose',
    'svg', 'path', 'g', 'rect', 'line',
}

_ALLOWED_ATTRS = {
    '*':    ['class', 'id', 'style'],
    'a':    ['href', 'title', 'target', 'rel', 'class'],
    'img':  ['src', 'alt', 'title', 'width', 'height', 'class'],
    'th':   ['align', 'scope'],
    'td':   ['align'],
    'code': ['class'],
    'math': ['xmlns', 'display'],
    'svg':  ['xmlns', 'viewBox', 'width', 'height', 'aria-hidden', 'focusable', 'role'],
    'path': ['d', 'fill', 'stroke', 'stroke-width'],
}


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
        # Fallback: per slugify
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
    escape=False,  # nötig damit <a>-Tags aus _resolve_wiki_links() nicht escaped werden
    plugins=['table', 'strikethrough', 'task_lists', 'math'],
)


def render(content: str) -> str:
    resolved = _resolve_wiki_links(content)
    raw_html = _md(resolved)
    # XSS-Sanitizer: entfernt <script>, onclick=, javascript: etc.
    return bleach.clean(
        raw_html,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRS,
        strip=True,         # nicht-erlaubte Tags entfernen (nicht escapen)
        strip_comments=True,
    )
