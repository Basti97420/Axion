"""python_script_schedule

Revision ID: c2d3e4f5g6h7
Revises: b1c2d3e4f5g6
Create Date: 2026-03-27

"""
from alembic import op
import sqlalchemy as sa

revision = 'c2d3e4f5g6h7'
down_revision = 'b1c2d3e4f5g6'
branch_labels = None
depends_on = None


def _has_column(table, column):
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c['name'] for c in insp.get_columns(table)]
    return column in cols


def upgrade():
    if not _has_column('python_scripts', 'schedule_type'):
        op.add_column('python_scripts',
            sa.Column('schedule_type', sa.String(20), server_default='manual', nullable=True))
    if not _has_column('python_scripts', 'interval_min'):
        op.add_column('python_scripts',
            sa.Column('interval_min', sa.Integer, server_default='60', nullable=True))
    if not _has_column('python_scripts', 'last_run_at'):
        op.add_column('python_scripts',
            sa.Column('last_run_at', sa.DateTime, nullable=True))
    if not _has_column('python_scripts', 'next_run_at'):
        op.add_column('python_scripts',
            sa.Column('next_run_at', sa.DateTime, nullable=True))


def downgrade():
    with op.batch_alter_table('python_scripts') as batch_op:
        batch_op.drop_column('next_run_at')
        batch_op.drop_column('last_run_at')
        batch_op.drop_column('interval_min')
        batch_op.drop_column('schedule_type')
