"""add icloud_uid, milestones, issue_dependencies

Revision ID: 68a9a72f5800
Revises: fa13d8dd1687
Create Date: 2026-03-23 11:44:07.134232

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '68a9a72f5800'
down_revision = 'fa13d8dd1687'
branch_labels = None
depends_on = None


def _has_column(table, col):
    bind = op.get_bind()
    inspector = inspect(bind)
    return col in [c['name'] for c in inspector.get_columns(table)]


def _has_table(name):
    bind = op.get_bind()
    inspector = inspect(bind)
    return name in inspector.get_table_names()


def upgrade():
    if not _has_table('milestones'):
        op.create_table('milestones',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('project_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('due_date', sa.Date(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )

    if not _has_table('issue_dependencies'):
        op.create_table('issue_dependencies',
            sa.Column('blocker_id', sa.Integer(), nullable=False),
            sa.Column('blocked_id', sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(['blocked_id'], ['issues.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['blocker_id'], ['issues.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('blocker_id', 'blocked_id')
        )

    with op.batch_alter_table('calendar_entries', schema=None) as batch_op:
        if not _has_column('calendar_entries', 'icloud_uid'):
            batch_op.add_column(sa.Column('icloud_uid', sa.String(length=255), nullable=True))

    with op.batch_alter_table('issues', schema=None) as batch_op:
        if not _has_column('issues', 'milestone_id'):
            batch_op.add_column(sa.Column('milestone_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_issues_milestone_id', 'milestones', ['milestone_id'], ['id'], ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('issues', schema=None) as batch_op:
        batch_op.drop_constraint('fk_issues_milestone_id', type_='foreignkey')
        batch_op.drop_column('milestone_id')

    with op.batch_alter_table('calendar_entries', schema=None) as batch_op:
        batch_op.drop_column('icloud_uid')

    op.drop_table('issue_dependencies')
    op.drop_table('milestones')
