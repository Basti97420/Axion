"""schedule_days for python_scripts and ki_agents

Revision ID: f5g6h7i8j9k0
Revises: e4f5g6h7i8j9
Create Date: 2026-03-27

"""
from alembic import op
import sqlalchemy as sa

revision = 'f5g6h7i8j9k0'
down_revision = 'e4f5g6h7i8j9'
branch_labels = None
depends_on = None


def _has_column(table, column):
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c['name'] for c in insp.get_columns(table)]
    return column in cols


def upgrade():
    if not _has_column('python_scripts', 'schedule_days'):
        op.add_column('python_scripts',
            sa.Column('schedule_days', sa.Text, nullable=True))
    if not _has_column('ki_agents', 'schedule_days'):
        op.add_column('ki_agents',
            sa.Column('schedule_days', sa.Text, nullable=True))


def downgrade():
    with op.batch_alter_table('python_scripts') as batch_op:
        batch_op.drop_column('schedule_days')
    with op.batch_alter_table('ki_agents') as batch_op:
        batch_op.drop_column('schedule_days')
