"""ki_agent_role_and_pending_confirmation

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-04-16

Fügt fehlende Spalten 'role' und 'pending_confirmation' zur ki_agents-Tabelle hinzu.
"""
from alembic import op
import sqlalchemy as sa

revision = 'k4l5m6n7o8p9'
down_revision = 'j3k4l5m6n7o8'
branch_labels = None
depends_on = None


def _has_column(table, column):
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    return any(c['name'] == column for c in insp.get_columns(table))


def upgrade():
    with op.batch_alter_table('ki_agents') as batch_op:
        if not _has_column('ki_agents', 'role'):
            batch_op.add_column(
                sa.Column('role', sa.String(20), nullable=True, server_default='maker')
            )
        if not _has_column('ki_agents', 'pending_confirmation'):
            batch_op.add_column(
                sa.Column('pending_confirmation', sa.String(50), nullable=True)
            )


def downgrade():
    with op.batch_alter_table('ki_agents') as batch_op:
        if _has_column('ki_agents', 'pending_confirmation'):
            batch_op.drop_column('pending_confirmation')
        if _has_column('ki_agents', 'role'):
            batch_op.drop_column('role')
