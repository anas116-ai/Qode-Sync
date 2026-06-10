from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
    op.execute("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\"")
    
    op.create_table("user_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("supabase_id", postgresql.UUID(as_uuid=True), unique=True),
        sa.Column("username", sa.String, nullable=False, unique=True),
        sa.Column("display_name", sa.String),
        sa.Column("avatar_url", sa.String),
        sa.Column("email", sa.String),
        sa.Column("github_id", sa.Integer),
        sa.Column("github_pat_encrypted", sa.Text),
        sa.Column("token_status", sa.Enum("valid", "invalid", "expired", "revoked"), default="valid"),
        sa.Column("token_last_validated", sa.DateTime(timezone=True)),
        sa.Column("timezone", sa.String, default="UTC"),
        sa.Column("language", sa.String, default="en"),
        sa.Column("max_repositories", sa.Integer, default=500),
        sa.Column("email_notifications_enabled", sa.Boolean, default=True),
        sa.Column("notification_frequency", sa.Enum("instant", "hourly", "daily", "weekly"), default="instant"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("last_sync_at", sa.DateTime(timezone=True)),
    )

    op.create_table("repositories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("github_id", sa.Integer, unique=True, nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("full_name", sa.String, nullable=False),
        sa.Column("owner", sa.String, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("language", sa.String),
        sa.Column("is_fork", sa.Boolean, default=False),
        sa.Column("archived", sa.Boolean, default=False),
        sa.Column("default_branch", sa.String, default="main"),
        sa.Column("stars_count", sa.Integer, default=0),
        sa.Column("forks_count", sa.Integer, default=0),
        sa.Column("open_issues_count", sa.Integer, default=0),
        sa.Column("parent_github_id", sa.Integer),
        sa.Column("parent_full_name", sa.String),
        sa.Column("parent_owner", sa.String),
        sa.Column("parent_default_branch", sa.String, default="main"),
        sa.Column("sync_status", sa.Enum("synced", "behind", "ahead", "diverged", "unknown"), default="unknown"),
        sa.Column("ahead_count", sa.Integer, default=0),
        sa.Column("behind_count", sa.Integer, default=0),
        sa.Column("divergence_count", sa.Integer, default=0),
        sa.Column("is_watched", sa.Boolean, default=True),
        sa.Column("is_bookmarked", sa.Boolean, default=False),
        sa.Column("category", sa.String),
        sa.Column("custom_labels", sa.JSON, default=[]),
        sa.Column("health_score", sa.Float, default=100.0),
        sa.Column("risk_score", sa.Float, default=0.0),
        sa.Column("last_commit_at", sa.DateTime(timezone=True)),
        sa.Column("last_release_at", sa.DateTime(timezone=True)),
        sa.Column("last_sync_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )
    
    op.create_table("updates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("update_type", sa.Enum("commit", "release", "tag", "security_advisory", "breaking_change", "pull_request_merged"), nullable=False),
        sa.Column("status", sa.Enum("new", "viewed", "synced", "ignored"), default="new"),
        sa.Column("severity", sa.Enum("critical", "high", "medium", "low"), default="medium"),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("ai_summary", sa.Text),
        sa.Column("ai_summary_detailed", sa.Text),
        sa.Column("github_sha", sa.String),
        sa.Column("github_url", sa.String),
        sa.Column("author", sa.String),
        sa.Column("files_changed", sa.Integer, default=0),
        sa.Column("additions", sa.Integer, default=0),
        sa.Column("deletions", sa.Integer, default=0),
        sa.Column("metadata", sa.JSON, default={}),
        sa.Column("notified", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("viewed_at", sa.DateTime(timezone=True)),
    )
    
    op.create_table("notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("update_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("updates.id")),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id")),
        sa.Column("channel", sa.String, default="email"),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("status", sa.String, default="pending"),
        sa.Column("is_read", sa.Boolean, default=False),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
    )
    
    op.create_table("sync_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("job_type", sa.String, nullable=False),
        sa.Column("status", sa.Enum("pending", "running", "completed", "failed", "cancelled"), default="pending"),
        sa.Column("total_repos", sa.Integer, default=0),
        sa.Column("processed_repos", sa.Integer, default=0),
        sa.Column("successful_repos", sa.Integer, default=0),
        sa.Column("failed_repos", sa.Integer, default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )

def downgrade():
    op.drop_table("sync_jobs")
    op.drop_table("notifications")
    op.drop_table("updates")
    op.drop_table("repositories")
    op.drop_table("user_profiles")