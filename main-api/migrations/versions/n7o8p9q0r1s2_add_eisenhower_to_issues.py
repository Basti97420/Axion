"""add_eisenhower_to_issues

Revision ID: n7o8p9q0r1s2
Revises: m6n7o8p9q0r1
Create Date: 2026-04-23

Fügt eisenhower-Feld zu issues hinzu (do_first, schedule, delegate, eliminate).
"""
from alembic import op
import sqlalchemy as sa

revision = 'n7o8p9q0r1s2'
down_revision = 'm6n7o8p9q0r1'
branch_labels = None
depends_on = None


def _has_column(table, column):
    from sqlalchemy import inspect
    bind = op.get_bind()
    return column in [c['name'] for c in inspect(bind).get_columns(table)]


def upgrade():
    if not _has_column('issues', 'eisenhower'):
        op.add_column('issues', sa.Column('eisenhower', sa.String(20), nullable=True))


def downgrade():
    op.drop_column('issues', 'eisenhower')
