"""ki_agent_run_tokens

Revision ID: g6h7i8j9k0l1
Revises: f5g6h7i8j9k0
Create Date: 2026-03-27

"""
from alembic import op
import sqlalchemy as sa

revision = 'g6h7i8j9k0l1'
down_revision = 'f5g6h7i8j9k0'
branch_labels = None
depends_on = None


def _has_column(table, column):
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c['name'] for c in insp.get_columns(table)]
    return column in cols


def upgrade():
    if not _has_column('ki_agent_runs', 'tokens_in'):
        op.add_column('ki_agent_runs',
            sa.Column('tokens_in', sa.Integer, nullable=True, server_default='0'))
    if not _has_column('ki_agent_runs', 'tokens_out'):
        op.add_column('ki_agent_runs',
            sa.Column('tokens_out', sa.Integer, nullable=True, server_default='0'))


def downgrade():
    with op.batch_alter_table('ki_agent_runs') as batch_op:
        batch_op.drop_column('tokens_in')
        batch_op.drop_column('tokens_out')
