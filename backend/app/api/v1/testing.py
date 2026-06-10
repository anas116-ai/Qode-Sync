"""Automated Testing Pipeline - Pre-merge test execution and coverage reporting."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from uuid import UUID
from datetime import datetime
from typing import Optional

from app.deps import get_current_user
from app.database import get_db
from app.models.user import UserProfile
from app.models.repository import Repository
from app.models.testing import TestPipeline, TestRun, TestRunStatus, TestFramework, TestFlakyDetection
from app.models.merge import MergeJob

router = APIRouter()


@router.post("/test-pipelines")
async def create_test_pipeline(
    repo_id: str,
    name: str,
    command: str,
    framework: str = Query("custom"),
    working_directory: str = Query("."),
    timeout_seconds: int = Query(300),
    run_on_sync: bool = Query(True),
    run_on_merge: bool = Query(True),
    required_to_pass: bool = Query(True),
    collect_coverage: bool = Query(True),
    coverage_threshold: float = Query(80.0),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a test pipeline configuration for a repository."""
    try:
        rid = UUID(repo_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid repository id")

    repo_result = await db.execute(
        select(Repository).where(Repository.id == rid, Repository.user_id == current_user.id)
    )
    if not repo_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Repository not found")

    try:
        framework_enum = TestFramework(framework)
    except ValueError:
        framework_enum = TestFramework.custom

    pipeline = TestPipeline(
        user_id=current_user.id,
        repository_id=rid,
        name=name,
        framework=framework_enum,
        command=command,
        working_directory=working_directory,
        timeout_seconds=timeout_seconds,
        run_on_sync=run_on_sync,
        run_on_merge=run_on_merge,
        required_to_pass=required_to_pass,
        collect_coverage=collect_coverage,
        coverage_threshold=coverage_threshold,
        enabled=True,
    )
    db.add(pipeline)
    await db.commit()
    await db.refresh(pipeline)

    return {
        "id": str(pipeline.id),
        "name": pipeline.name,
        "framework": pipeline.framework.value,
        "command": pipeline.command,
        "run_on_sync": pipeline.run_on_sync,
        "run_on_merge": pipeline.run_on_merge,
        "required_to_pass": pipeline.required_to_pass,
        "collect_coverage": pipeline.collect_coverage,
        "coverage_threshold": pipeline.coverage_threshold,
    }


@router.get("/test-pipelines")
async def list_test_pipelines(
    repo_id: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List test pipelines for the current user."""
    query = select(TestPipeline).where(TestPipeline.user_id == current_user.id)
    if repo_id:
        try:
            query = query.where(TestPipeline.repository_id == UUID(repo_id))
        except ValueError:
            pass

    result = await db.execute(query)
    pipelines = result.scalars().all()

    return [
        {
            "id": str(p.id),
            "repository_id": str(p.repository_id),
            "name": p.name,
            "framework": p.framework.value,
            "command": p.command,
            "run_on_sync": p.run_on_sync,
            "run_on_merge": p.run_on_merge,
            "required_to_pass": p.required_to_pass,
            "collect_coverage": p.collect_coverage,
            "coverage_threshold": p.coverage_threshold,
            "enabled": p.enabled,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in pipelines
    ]


@router.post("/test-pipelines/{pipeline_id}/run")
async def trigger_test_run(
    pipeline_id: str,
    merge_job_id: Optional[str] = Query(None),
    commit_sha: Optional[str] = Query(None),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a test run for a pipeline (simulated execution)."""
    try:
        pid = UUID(pipeline_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid pipeline id")

    result = await db.execute(
        select(TestPipeline).where(TestPipeline.id == pid, TestPipeline.user_id == current_user.id)
    )
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Test pipeline not found")

    mjid = UUID(merge_job_id) if merge_job_id else None

    test_run = TestRun(
        pipeline_id=pid,
        merge_job_id=mjid,
        user_id=current_user.id,
        repository_id=pipeline.repository_id,
        status=TestRunStatus.queued,
        commit_sha=commit_sha,
        triggered_by="manual",
    )
    db.add(test_run)
    await db.commit()
    await db.refresh(test_run)

    # Simulate test execution (in production, this would be a background task)
    import asyncio
    import random
    mock_duration = random.randint(1000, 15000)
    mock_total = random.randint(10, 200)
    mock_passed = int(mock_total * random.uniform(0.7, 1.0))
    mock_failed = mock_total - mock_passed
    mock_coverage = random.uniform(50.0, 100.0)

    test_run.status = TestRunStatus.passed if mock_failed == 0 else TestRunStatus.failed
    test_run.total_tests = mock_total
    test_run.passed_tests = mock_passed
    test_run.failed_tests = mock_failed
    test_run.skipped_tests = random.randint(0, 5)
    test_run.duration_ms = mock_duration
    test_run.coverage_percent = round(mock_coverage, 2)
    test_run.coverage_report = {
        "lines": {"total": random.randint(500, 5000), "covered": int(mock_coverage * 50)},
        "branches": {"total": random.randint(100, 1000), "covered": int(mock_coverage * 10)},
        "functions": {"total": random.randint(50, 500), "covered": int(mock_coverage * 5)},
    }
    test_run.output_log = f"Test run completed in {mock_duration}ms\nPassed: {mock_passed}\nFailed: {mock_failed}\nCoverage: {mock_coverage:.1f}%"
    test_run.started_at = datetime.utcnow()
    test_run.completed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(test_run)

    return {
        "id": str(test_run.id),
        "status": test_run.status.value,
        "total_tests": test_run.total_tests,
        "passed_tests": test_run.passed_tests,
        "failed_tests": test_run.failed_tests,
        "duration_ms": test_run.duration_ms,
        "coverage_percent": test_run.coverage_percent,
        "output_log": test_run.output_log,
    }


@router.get("/test-runs")
async def list_test_runs(
    pipeline_id: Optional[str] = Query(None),
    repo_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List test runs for the current user."""
    query = select(TestRun).where(TestRun.user_id == current_user.id)
    if pipeline_id:
        try:
            query = query.where(TestRun.pipeline_id == UUID(pipeline_id))
        except ValueError:
            pass
    if repo_id:
        try:
            query = query.where(TestRun.repository_id == UUID(repo_id))
        except ValueError:
            pass
    query = query.order_by(desc(TestRun.created_at)).limit(limit)

    result = await db.execute(query)
    runs = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "pipeline_id": str(r.pipeline_id),
            "merge_job_id": str(r.merge_job_id) if r.merge_job_id else None,
            "repository_id": str(r.repository_id),
            "status": r.status.value,
            "commit_sha": r.commit_sha,
            "total_tests": r.total_tests,
            "passed_tests": r.passed_tests,
            "failed_tests": r.failed_tests,
            "duration_ms": r.duration_ms,
            "coverage_percent": r.coverage_percent,
            "triggered_by": r.triggered_by,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in runs
    ]


@router.get("/test-runs/{run_id}")
async def get_test_run(
    run_id: str,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed test run results."""
    try:
        rid = UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run id")

    result = await db.execute(
        select(TestRun).where(TestRun.id == rid, TestRun.user_id == current_user.id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")

    return {
        "id": str(run.id),
        "pipeline_id": str(run.pipeline_id),
        "merge_job_id": str(run.merge_job_id) if run.merge_job_id else None,
        "repository_id": str(run.repository_id),
        "status": run.status.value,
        "commit_sha": run.commit_sha,
        "total_tests": run.total_tests,
        "passed_tests": run.passed_tests,
        "failed_tests": run.failed_tests,
        "skipped_tests": run.skipped_tests,
        "duration_ms": run.duration_ms,
        "coverage_percent": run.coverage_percent,
        "coverage_report": run.coverage_report,
        "output_log": run.output_log,
        "error_message": run.error_message,
        "triggered_by": run.triggered_by,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }
