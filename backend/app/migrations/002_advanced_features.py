"""Migration 002: Add tables for AI-powered auto-merge, patches, deployments, testing, and sync networks.

Revision ID: 002
Revises: 001
Create Date: 2026-06-10
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Merge Jobs ---
    op.create_table(
        "merge_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id"), nullable=False),
        sa.Column("status", sa.Enum("pending", "risk_assessing", "approved", "blocked", "merging", "completed", "failed", "conflict", "rolled_back", name="mergestatus"), nullable=False, server_default="pending"),
        sa.Column("risk_level", sa.Enum("safe", "low", "medium", "high", "critical", name="risklevel")),
        sa.Column("risk_assessment", postgresql.JSON, server_default="{}"),
        sa.Column("base_branch", sa.String, server_default="main"),
        sa.Column("head_branch", sa.String, server_default="main"),
        sa.Column("merge_commit_sha", sa.String),
        sa.Column("ahead_commits", sa.Integer, server_default="0"),
        sa.Column("behind_commits", sa.Integer, server_default="0"),
        sa.Column("conflict_files", postgresql.ARRAY(sa.String), server_default="{}"),
        sa.Column("auto_resolved", sa.Boolean, server_default="false"),
        sa.Column("breaking_changes_detected", sa.Boolean, server_default="false"),
        sa.Column("breaking_changes_detail", sa.Text),
        sa.Column("rollback_commit_sha", sa.String),
        sa.Column("error_message", sa.Text),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Merge Conflicts ---
    op.create_table(
        "merge_conflicts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("merge_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("merge_jobs.id"), nullable=False),
        sa.Column("file_path", sa.String, nullable=False),
        sa.Column("upstream_content", sa.Text),
        sa.Column("fork_content", sa.Text),
        sa.Column("resolved_content", sa.Text),
        sa.Column("resolution_strategy", sa.String),
        sa.Column("auto_resolved", sa.Boolean, server_default="false"),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
    )

    # --- Risk Assessment Logs ---
    op.create_table(
        "risk_assessment_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("merge_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("merge_jobs.id"), nullable=False),
        sa.Column("assessment_type", sa.String, nullable=False),
        sa.Column("score", sa.Float, server_default="0.0"),
        sa.Column("summary", sa.Text),
        sa.Column("details", postgresql.JSON, server_default="{}"),
        sa.Column("ai_model", sa.String),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Dependency Conflicts ---
    op.create_table(
        "dependency_conflicts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id"), nullable=False),
        sa.Column("merge_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("merge_jobs.id")),
        sa.Column("package_name", sa.String, nullable=False),
        sa.Column("package_manager", sa.String, nullable=False),
        sa.Column("upstream_version", sa.String),
        sa.Column("fork_version", sa.String),
        sa.Column("resolved_version", sa.String),
        sa.Column("conflict_type", sa.String, server_default="version_mismatch"),
        sa.Column("severity", sa.String, server_default="medium"),
        sa.Column("auto_resolved", sa.Boolean, server_default="false"),
        sa.Column("resolution_strategy", sa.String),
        sa.Column("ai_recommendation", sa.Text),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Patches ---
    op.create_table(
        "patches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id"), nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("target_branch", sa.String, server_default="main"),
        sa.Column("source_commit", sa.String),
        sa.Column("status", sa.Enum("active", "applied", "conflicted", "deprecated", "archived", name="patchstatus"), server_default="active"),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("upstream_sha", sa.String),
        sa.Column("hash", sa.String, unique=True),
        sa.Column("applies_cleanly", sa.Boolean, server_default="true"),
        sa.Column("conflict_details", postgresql.JSON, server_default="{}"),
        sa.Column("priority", sa.Integer, server_default="0"),
        sa.Column("tags", postgresql.JSON, server_default="[]"),
        sa.Column("applied_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Patch Files ---
    op.create_table(
        "patch_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("patch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patches.id"), nullable=False),
        sa.Column("file_path", sa.String, nullable=False),
        sa.Column("change_type", sa.String, server_default="modified"),
        sa.Column("diff_content", sa.Text, nullable=False),
        sa.Column("old_content_hash", sa.String),
        sa.Column("new_content_hash", sa.String),
        sa.Column("line_count", sa.Integer, server_default="0"),
    )

    # --- Patch Applications ---
    op.create_table(
        "patch_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("patch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patches.id"), nullable=False),
        sa.Column("merge_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("merge_jobs.id")),
        sa.Column("status", sa.String, server_default="pending"),
        sa.Column("applied_sha", sa.String),
        sa.Column("conflict_file_count", sa.Integer, server_default="0"),
        sa.Column("duration_ms", sa.Integer, server_default="0"),
        sa.Column("error_message", sa.Text),
        sa.Column("applied_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Deployment Configs ---
    op.create_table(
        "deployment_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id"), nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("provider", sa.Enum("kubernetes", "docker", "cloud_run", "ecs", "ec2", "lambda_", "heroku", "vercel", "netlify", "custom", name="deploymentprovider"), nullable=False),
        sa.Column("target_branch", sa.String, server_default="main"),
        sa.Column("auto_deploy", sa.Boolean, server_default="false"),
        sa.Column("deploy_on_sync", sa.Boolean, server_default="false"),
        sa.Column("environment", sa.String, server_default="production"),
        sa.Column("config", postgresql.JSON, server_default="{}"),
        sa.Column("credentials_ref", sa.String),
        sa.Column("health_check_endpoint", sa.String),
        sa.Column("rollback_on_failure", sa.Boolean, server_default="true"),
        sa.Column("max_retries", sa.Integer, server_default="3"),
        sa.Column("notify_on_success", sa.Boolean, server_default="true"),
        sa.Column("notify_on_failure", sa.Boolean, server_default="true"),
        sa.Column("enabled", sa.Boolean, server_default="true"),
        sa.Column("last_deployed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Deployments ---
    op.create_table(
        "deployments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("config_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deployment_configs.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id"), nullable=False),
        sa.Column("merge_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("merge_jobs.id")),
        sa.Column("version", sa.String),
        sa.Column("status", sa.Enum("pending", "building", "deploying", "healthy", "failed", "rolled_back", name="deploymentstatus"), server_default="pending"),
        sa.Column("commit_sha", sa.String),
        sa.Column("rollout_percentage", sa.Integer, server_default="100"),
        sa.Column("duration_ms", sa.Integer),
        sa.Column("logs", postgresql.JSON, server_default="[]"),
        sa.Column("error_message", sa.Text),
        sa.Column("rollback_deployment_id", postgresql.UUID(as_uuid=True)),
        sa.Column("external_url", sa.String),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Sync Networks ---
    op.create_table(
        "sync_networks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("status", sa.Enum("active", "paused", "error", "archived", name="networkstatus"), server_default="active"),
        sa.Column("sync_frequency", sa.String, server_default="daily"),
        sa.Column("conflict_strategy", sa.String, server_default="auto_ai"),
        sa.Column("auto_discover", sa.Boolean, server_default="true"),
        sa.Column("notify_on_sync", sa.Boolean, server_default="true"),
        sa.Column("notify_on_conflict", sa.Boolean, server_default="true"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Sync Network Nodes ---
    op.create_table(
        "sync_network_nodes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("network_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sync_networks.id"), nullable=False),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id"), nullable=False),
        sa.Column("is_upstream", sa.Boolean, server_default="false"),
        sa.Column("sync_enabled", sa.Boolean, server_default="true"),
        sa.Column("auto_merge", sa.Boolean, server_default="true"),
        sa.Column("sync_order", sa.Integer, server_default="0"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Sync Network Events ---
    op.create_table(
        "sync_network_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("network_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sync_networks.id"), nullable=False),
        sa.Column("event_type", sa.String, nullable=False),
        sa.Column("source_repo_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id")),
        sa.Column("target_repo_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id")),
        sa.Column("merge_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("merge_jobs.id")),
        sa.Column("details", postgresql.JSON, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Test Pipelines ---
    op.create_table(
        "test_pipelines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id"), nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("framework", sa.Enum("pytest", "jest", "mocha", "go_test", "cargo_test", "rspec", "phpunit", "junit", "custom", name="testframework"), server_default="custom"),
        sa.Column("command", sa.String, nullable=False),
        sa.Column("working_directory", sa.String, server_default="."),
        sa.Column("timeout_seconds", sa.Integer, server_default="300"),
        sa.Column("run_on_sync", sa.Boolean, server_default="true"),
        sa.Column("run_on_merge", sa.Boolean, server_default="true"),
        sa.Column("required_to_pass", sa.Boolean, server_default="true"),
        sa.Column("collect_coverage", sa.Boolean, server_default="true"),
        sa.Column("coverage_threshold", sa.Float, server_default="80.0"),
        sa.Column("environment_vars", postgresql.JSON, server_default="{}"),
        sa.Column("enabled", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Test Runs ---
    op.create_table(
        "test_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pipeline_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("test_pipelines.id"), nullable=False),
        sa.Column("merge_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("merge_jobs.id")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_profiles.id"), nullable=False),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id"), nullable=False),
        sa.Column("status", sa.Enum("pending", "queued", "running", "passed", "failed", "cancelled", "timeout", name="testrunstatus"), server_default="pending"),
        sa.Column("commit_sha", sa.String),
        sa.Column("total_tests", sa.Integer, server_default="0"),
        sa.Column("passed_tests", sa.Integer, server_default="0"),
        sa.Column("failed_tests", sa.Integer, server_default="0"),
        sa.Column("skipped_tests", sa.Integer, server_default="0"),
        sa.Column("duration_ms", sa.Integer),
        sa.Column("coverage_percent", sa.Float),
        sa.Column("coverage_report", postgresql.JSON, server_default="{}"),
        sa.Column("output_log", sa.Text),
        sa.Column("error_message", sa.Text),
        sa.Column("triggered_by", sa.String, server_default="auto"),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Test Flaky Detections ---
    op.create_table(
        "test_flaky_detections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pipeline_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("test_pipelines.id"), nullable=False),
        sa.Column("test_name", sa.String, nullable=False),
        sa.Column("file_path", sa.String),
        sa.Column("pass_count", sa.Integer, server_default="0"),
        sa.Column("fail_count", sa.Integer, server_default="0"),
        sa.Column("flaky_score", sa.Float, server_default="0.0"),
        sa.Column("last_flaky_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Indexes for performance ---
    op.create_index("ix_merge_jobs_user_id", "merge_jobs", ["user_id"])
    op.create_index("ix_merge_jobs_repository_id", "merge_jobs", ["repository_id"])
    op.create_index("ix_merge_jobs_status", "merge_jobs", ["status"])
    op.create_index("ix_dependency_conflicts_repo", "dependency_conflicts", ["repository_id"])
    op.create_index("ix_patches_user_id", "patches", ["user_id"])
    op.create_index("ix_patches_repository_id", "patches", ["repository_id"])
    op.create_index("ix_deployment_configs_user_id", "deployment_configs", ["user_id"])
    op.create_index("ix_sync_networks_user_id", "sync_networks", ["user_id"])
    op.create_index("ix_test_pipelines_user_id", "test_pipelines", ["user_id"])
    op.create_index("ix_test_runs_user_id", "test_runs", ["user_id"])
    op.create_index("ix_test_runs_status", "test_runs", ["status"])


def downgrade() -> None:
    """Remove all new tables in reverse order."""
    op.drop_table("test_flaky_detections")
    op.drop_table("test_runs")
    op.drop_table("test_pipelines")
    op.drop_table("sync_network_events")
    op.drop_table("sync_network_nodes")
    op.drop_table("sync_networks")
    op.drop_table("deployments")
    op.drop_table("deployment_configs")
    op.drop_table("patch_applications")
    op.drop_table("patch_files")
    op.drop_table("patches")
    op.drop_table("dependency_conflicts")
    op.drop_table("risk_assessment_logs")
    op.drop_table("merge_conflicts")
    op.drop_table("merge_jobs")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS mergestatus")
    op.execute("DROP TYPE IF EXISTS risklevel")
    op.execute("DROP TYPE IF EXISTS patchstatus")
    op.execute("DROP TYPE IF EXISTS deploymentprovider")
    op.execute("DROP TYPE IF EXISTS deploymentstatus")
    op.execute("DROP TYPE IF EXISTS networkstatus")
    op.execute("DROP TYPE IF EXISTS testframework")
    op.execute("DROP TYPE IF EXISTS testrunstatus")
