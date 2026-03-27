"""python_script_run_variables

Revision ID: e4f5g6h7i8j9
Revises: d3e4f5g6h7i8
Create Date: 2026-03-27

"""
from alembic import op
import sqlalchemy as sa

revision = 'e4f5g6h7i8j9'
down_revision = 'd3e4f5g6h7i8'
branch_labels = None
depends_on = None


def _has_column(table, column):
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c['name'] for c in insp.get_columns(table)]
    return column in cols


def upgrade():
    if not _has_column('python_script_runs', 'variables'):
        op.add_column('python_script_runs',
            sa.Column('variables', sa.Text, nullable=True))


def downgrade():
    with op.batch_alter_table('python_script_runs') as batch_op:
        batch_op.drop_column('variables')
