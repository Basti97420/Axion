"""calendar_entry nullable issue_id project_id add title

Revision ID: 7f905107f764
Revises: 605ac92a078f
Create Date: 2026-03-26 09:20:25.474824

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7f905107f764'
down_revision = '605ac92a078f'
branch_labels = None
depends_on = None


def _has_column(table, column):
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    return any(c['name'] == column for c in insp.get_columns(table))


def upgrade():
    # SQLite: batch_alter_table für Tabellen-Rebuild mit neuen Constraints
    with op.batch_alter_table('calendar_entries', schema=None) as batch_op:
        if not _has_column('calendar_entries', 'title'):
            batch_op.add_column(sa.Column('title', sa.String(length=255), nullable=True))
        batch_op.alter_column('issue_id',
               existing_type=sa.INTEGER(),
               nullable=True)
        batch_op.alter_column('project_id',
               existing_type=sa.INTEGER(),
               nullable=True)


def downgrade():
    with op.batch_alter_table('calendar_entries', schema=None) as batch_op:
        batch_op.alter_column('project_id',
               existing_type=sa.INTEGER(),
               nullable=False)
        batch_op.alter_column('issue_id',
               existing_type=sa.INTEGER(),
               nullable=False)
        batch_op.drop_column('title')
