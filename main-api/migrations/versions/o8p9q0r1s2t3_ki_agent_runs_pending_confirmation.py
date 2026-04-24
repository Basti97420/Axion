"""ki_agent_runs_pending_confirmation

Revision ID: o8p9q0r1s2t3
Revises: n7o8p9q0r1s2
Create Date: 2026-04-24

Fügt fehlende Spalte 'pending_confirmation' zur ki_agent_runs-Tabelle hinzu.
"""
from alembic import op
import sqlalchemy as sa

revision = 'o8p9q0r1s2t3'
down_revision = 'n7o8p9q0r1s2'
branch_labels = None
depends_on = None


def _has_column(table, column):
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    return any(c['name'] == column for c in insp.get_columns(table))


def upgrade():
    with op.batch_alter_table('ki_agent_runs') as batch_op:
        if not _has_column('ki_agent_runs', 'pending_confirmation'):
            batch_op.add_column(
                sa.Column('pending_confirmation', sa.String(50), nullable=True)
            )


def downgrade():
    with op.batch_alter_table('ki_agent_runs') as batch_op:
        if _has_column('ki_agent_runs', 'pending_confirmation'):
            batch_op.drop_column('pending_confirmation')
