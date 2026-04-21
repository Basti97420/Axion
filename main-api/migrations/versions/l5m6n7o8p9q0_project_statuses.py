"""project_statuses

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Create Date: 2026-04-21

Erstellt die Tabelle project_statuses und befüllt bestehende Projekte mit den 6 Standard-Status.
"""
from alembic import op
import sqlalchemy as sa

revision = 'l5m6n7o8p9q0'
down_revision = 'k4l5m6n7o8p9'
branch_labels = None
depends_on = None

DEFAULT_STATUSES = [
    {'key': 'open',        'label': 'Offen',       'color': 'bg-slate-100 text-slate-700',   'dot_color': 'bg-slate-400',  'position': 0, 'is_closed': False},
    {'key': 'in_progress', 'label': 'In Arbeit',   'color': 'bg-blue-100 text-blue-700',     'dot_color': 'bg-blue-500',   'position': 1, 'is_closed': False},
    {'key': 'hold',        'label': 'Pausiert',    'color': 'bg-orange-100 text-orange-700', 'dot_color': 'bg-orange-400', 'position': 2, 'is_closed': False},
    {'key': 'in_review',   'label': 'In Review',   'color': 'bg-yellow-100 text-yellow-700', 'dot_color': 'bg-yellow-500', 'position': 3, 'is_closed': False},
    {'key': 'done',        'label': 'Erledigt',    'color': 'bg-green-100 text-green-700',   'dot_color': 'bg-green-500',  'position': 4, 'is_closed': True},
    {'key': 'cancelled',   'label': 'Abgebrochen', 'color': 'bg-red-100 text-red-600',       'dot_color': 'bg-red-400',    'position': 5, 'is_closed': True},
]


def _has_table(name):
    from sqlalchemy import inspect
    bind = op.get_bind()
    return inspect(bind).has_table(name)


def upgrade():
    if not _has_table('project_statuses'):
        op.create_table(
            'project_statuses',
            sa.Column('id',         sa.Integer(),    primary_key=True),
            sa.Column('project_id', sa.Integer(),    sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
            sa.Column('key',        sa.String(50),   nullable=False),
            sa.Column('label',      sa.String(100),  nullable=False),
            sa.Column('color',      sa.String(100),  nullable=False, server_default='bg-slate-100 text-slate-700'),
            sa.Column('dot_color',  sa.String(50),   nullable=False, server_default='bg-slate-400'),
            sa.Column('position',   sa.Integer(),    nullable=False, server_default='0'),
            sa.Column('is_closed',  sa.Boolean(),    server_default='0'),
            sa.Column('created_at', sa.DateTime()),
            sa.UniqueConstraint('project_id', 'key', name='uq_project_status_key'),
        )

    # Bestehende Projekte mit Standard-Status befüllen
    bind = op.get_bind()
    projects = bind.execute(sa.text('SELECT id FROM projects')).fetchall()
    for (pid,) in projects:
        count = bind.execute(
            sa.text('SELECT COUNT(*) FROM project_statuses WHERE project_id = :pid'),
            {'pid': pid}
        ).scalar()
        if count == 0:
            for s in DEFAULT_STATUSES:
                bind.execute(
                    sa.text(
                        'INSERT INTO project_statuses '
                        '(project_id, key, label, color, dot_color, position, is_closed) '
                        'VALUES (:pid, :key, :label, :color, :dot_color, :pos, :closed)'
                    ),
                    {
                        'pid': pid, 'key': s['key'], 'label': s['label'],
                        'color': s['color'], 'dot_color': s['dot_color'],
                        'pos': s['position'], 'closed': s['is_closed'],
                    }
                )


def downgrade():
    op.drop_table('project_statuses')
