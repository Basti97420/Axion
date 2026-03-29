"""remove_agent_prompt

Revision ID: h1i2j3k4l5m6
Revises: g6h7i8j9k0l1
Create Date: 2026-03-28

"""
from alembic import op

revision = 'h1i2j3k4l5m6'
down_revision = 'g6h7i8j9k0l1'
branch_labels = None
depends_on = None


def _has_column(table, column):
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c['name'] for c in insp.get_columns(table)]
    return column in cols


def upgrade():
    if _has_column('ki_agents', 'prompt'):
        with op.batch_alter_table('ki_agents') as batch_op:
            batch_op.drop_column('prompt')


def downgrade():
    import sqlalchemy as sa
    if not _has_column('ki_agents', 'prompt'):
        with op.batch_alter_table('ki_agents') as batch_op:
            batch_op.add_column(sa.Column('prompt', sa.Text, nullable=True, server_default=''))
