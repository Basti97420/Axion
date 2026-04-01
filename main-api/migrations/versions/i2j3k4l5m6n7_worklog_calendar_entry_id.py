"""worklog_calendar_entry_id

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-04-01

"""
from alembic import op
import sqlalchemy as sa

revision = 'i2j3k4l5m6n7'
down_revision = 'h1i2j3k4l5m6'
branch_labels = None
depends_on = None


def _has_column(table, column):
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    return any(c['name'] == column for c in insp.get_columns(table))


def upgrade():
    if not _has_column('worklogs', 'calendar_entry_id'):
        with op.batch_alter_table('worklogs') as batch_op:
            batch_op.add_column(
                sa.Column(
                    'calendar_entry_id',
                    sa.Integer(),
                    nullable=True,
                )
            )


def downgrade():
    if _has_column('worklogs', 'calendar_entry_id'):
        with op.batch_alter_table('worklogs') as batch_op:
            batch_op.drop_column('calendar_entry_id')
