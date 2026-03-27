"""python_scripts

Revision ID: b1c2d3e4f5g6
Revises: a1b2c3d4e5f6
Create Date: 2026-03-26 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'b1c2d3e4f5g6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'python_scripts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('description', sa.Text(), nullable=True, server_default=''),
        sa.Column('code', sa.Text(), nullable=True, server_default=''),
        sa.Column('timeout_sec', sa.Integer(), nullable=True, server_default='30'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_table(
        'python_script_runs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('script_id', sa.Integer(), sa.ForeignKey('python_scripts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('stdout', sa.Text(), nullable=True, server_default=''),
        sa.Column('stderr', sa.Text(), nullable=True, server_default=''),
        sa.Column('exit_code', sa.Integer(), nullable=True),
        sa.Column('error', sa.String(500), nullable=True),
        sa.Column('triggered_by', sa.String(20), nullable=True, server_default='manual'),
    )


def downgrade():
    op.drop_table('python_script_runs')
    op.drop_table('python_scripts')
