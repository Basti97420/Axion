"""Add telegram_messages table for KI context."""
from alembic import op
import sqlalchemy as sa

revision = 'j3k4l5m6n7o8'
down_revision = 'i2j3k4l5m6n7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'telegram_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('chat_id', sa.String(length=64), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('direction', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_telegram_messages_chat_id', 'telegram_messages', ['chat_id'])
    op.create_index('ix_telegram_messages_created_at', 'telegram_messages', ['created_at'])


def downgrade():
    op.drop_index('ix_telegram_messages_created_at', table_name='telegram_messages')
    op.drop_index('ix_telegram_messages_chat_id', table_name='telegram_messages')
    op.drop_table('telegram_messages')
