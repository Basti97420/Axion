"""ki_agent_retry_fields

Revision ID: a1b2c3d4e5f6
Revises: 6e5e72bd3aa7
Create Date: 2026-03-26 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = '6e5e72bd3aa7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('ki_agents', schema=None) as batch_op:
        batch_op.add_column(sa.Column('retry_on_error', sa.Boolean(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('retry_max', sa.Integer(), nullable=True, server_default='3'))
        batch_op.add_column(sa.Column('retry_delay_min', sa.Integer(), nullable=True, server_default='5'))


def downgrade():
    with op.batch_alter_table('ki_agents', schema=None) as batch_op:
        batch_op.drop_column('retry_delay_min')
        batch_op.drop_column('retry_max')
        batch_op.drop_column('retry_on_error')
