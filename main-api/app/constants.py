"""Gemeinsam genutzte Konstanten für Aktionstypen."""

# Rollen-basierte Aktionsfilter (KI-Agenten)
# Definiert welche Aktionen für welche Agenten-Rollen erlaubt sind.
READ_ACTIONS = frozenset({
    'search_issues', 'read_wiki_page', 'search_wiki', 'list_wiki_pages',
    'list_projects', 'search', 'read_issue',
})
WRITE_ACTIONS = frozenset({
    'create_issue', 'update_issue', 'add_comment',
    'set_assignee', 'set_due_date',
    'create_wiki_page', 'update_wiki_page',
    'create_milestone', 'update_milestone',
    'add_tag', 'remove_tag', 'create_tag',
    'create_subtask', 'assign_milestone', 'set_dependency',
    'add_worklog',
})
ADMIN_ACTIONS = frozenset({
    'create_python_script', 'run_python_script',
    'create_ki_agent', 'run_ki_agent', 'trigger_agent', 'create_file', 'trigger_self',
})

# Aktionstypen die einen zweistufigen Datenabruf auslösen
# (erst Daten holen, dann KI erneut mit Daten aufrufen)
FETCH_ACTIONS = frozenset({
    'read_wiki_page', 'search_wiki', 'search_issues', 'list_projects', 'list_wiki_pages',
    'read_issue', 'read_script_output', 'read_agent_output', 'read_memory',
})
