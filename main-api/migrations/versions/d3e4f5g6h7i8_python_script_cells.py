"""python_script_cells

Revision ID: d3e4f5g6h7i8
Revises: c2d3e4f5g6h7
Create Date: 2026-03-27

"""
from alembic import op
import sqlalchemy as sa

revision = 'd3e4f5g6h7i8'
down_revision = 'c2d3e4f5g6h7'
branch_labels = None
depends_on = None


def _has_column(table, column):
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c['name'] for c in insp.get_columns(table)]
    return column in cols


def upgrade():
    if not _has_column('python_scripts', 'cells'):
        op.add_column('python_scripts',
            sa.Column('cells', sa.Text, nullable=True))


def downgrade():
    with op.batch_alter_table('python_scripts') as batch_op:
        batch_op.drop_column('cells')
