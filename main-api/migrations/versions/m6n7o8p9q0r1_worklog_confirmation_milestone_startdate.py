"""worklog_confirmation_milestone_startdate

Revision ID: m6n7o8p9q0r1
Revises: l5m6n7o8p9q0
Create Date: 2026-04-21

Fügt needs_confirmation zu worklogs und start_date zu milestones hinzu.
"""
from alembic import op
import sqlalchemy as sa

revision = 'm6n7o8p9q0r1'
down_revision = 'l5m6n7o8p9q0'
branch_labels = None
depends_on = None


def _has_column(table, column):
    from sqlalchemy import inspect
    bind = op.get_bind()
    return column in [c['name'] for c in inspect(bind).get_columns(table)]


def upgrade():
    if not _has_column('worklogs', 'needs_confirmation'):
        op.add_column('worklogs', sa.Column('needs_confirmation', sa.Boolean(), server_default='0', nullable=False))

    if not _has_column('milestones', 'start_date'):
        op.add_column('milestones', sa.Column('start_date', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('worklogs', 'needs_confirmation')
    op.drop_column('milestones', 'start_date')
