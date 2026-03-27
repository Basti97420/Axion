"""ki_agent_api_url

Revision ID: 6e5e72bd3aa7
Revises: 3a9c3733b32c
Create Date: 2026-03-26 11:44:44.248074

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6e5e72bd3aa7'
down_revision = '3a9c3733b32c'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('ki_agents', schema=None) as batch_op:
        batch_op.add_column(sa.Column('api_url', sa.String(length=500), nullable=True))


def downgrade():
    with op.batch_alter_table('ki_agents', schema=None) as batch_op:
        batch_op.drop_column('api_url')

    # ### end Alembic commands ###
