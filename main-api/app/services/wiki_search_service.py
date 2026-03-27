from app.models.wiki_page import WikiPage


def search(query: str, project_id: int = None):
    q = f'%{query}%'
    base = WikiPage.query.filter(
        (WikiPage.title.ilike(q)) | (WikiPage.content.ilike(q))
    )
    if project_id is not None:
        base = base.filter(WikiPage.project_id == project_id)
    pages = base.limit(20).all()

    results = []
    for page in pages:
        snippet = _extract_snippet(page.content, query)
        results.append({
            'slug': page.slug,
            'title': page.title,
            'snippet': snippet,
            'project_id': page.project_id,
        })
    return results


def _extract_snippet(content: str, query: str, radius: int = 100) -> str:
    lower = content.lower()
    pos = lower.find(query.lower())
    if pos == -1:
        return content[:200]
    start = max(0, pos - radius)
    end = min(len(content), pos + len(query) + radius)
    return ('…' if start > 0 else '') + content[start:end] + ('…' if end < len(content) else '')
