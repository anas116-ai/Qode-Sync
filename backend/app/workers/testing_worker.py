"""Celery tasks for test pipeline execution and coverage reporting."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict
import random

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.testing import TestPipeline, TestRun, TestRunStatus
from app.workers.task_schedule import celery

logger = logging.getLogger("forktracker.testing")


async def execute_test_run(pipeline_id: str) -> Dict[str, Any]:
    """Execute a test run for a pipeline (simulated execution)."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TestPipeline).where(TestPipeline.id == pipeline_id)
        )
        pipeline = result.scalar_one_or_none()
        if not pipeline:
            return {"ok": False, "reason": "pipeline_not_found"}

        # Find the most recent pending run
        run_result = await db.execute(
            select(TestRun)
            .where(TestRun.pipeline_id == pipeline_id, TestRun.status == TestRunStatus.queued)
            .order_by(TestRun.created_at.desc())
            .limit(1)
        )
        run = run_result.scalar_one_or_none()
        if not run:
            return {"ok": False, "reason": "no_queued_run"}

        run.status = TestRunStatus.running
        run.started_at = datetime.utcnow()
        await db.commit()

        try:
            # Simulate test execution
            mock_duration = random.randint(1000, 30000)
            mock_total = random.randint(10, 500)
            mock_passed = int(mock_total * random.uniform(0.7, 1.0))
            mock_failed = mock_total - mock_passed
            mock_coverage = random.uniform(50.0, 100.0)

            run.status = TestRunStatus.passed if mock_failed == 0 else TestRunStatus.failed
            run.total_tests = mock_total
            run.passed_tests = mock_passed
            run.failed_tests = mock_failed
            run.skipped_tests = random.randint(0, 10)
            run.duration_ms = mock_duration
            run.coverage_percent = round(mock_coverage, 2)
            run.coverage_report = {
                "lines": {"total": random.randint(500, 10000), "covered": int(mock_coverage * random.randint(50, 100))},
                "branches": {"total": random.randint(100, 2000), "covered": int(mock_coverage * random.randint(10, 20))},
                "functions": {"total": random.randint(50, 500), "covered": int(mock_coverage * random.randint(5, 10))},
            }
            run.output_log = (
                f"Test run completed in {mock_duration}ms\n"
                f"Total: {mock_total}\n"
                f"Passed: {mock_passed}\n"
                f"Failed: {mock_failed}\n"
                f"Skipped: {run.skipped_tests}\n"
                f"Coverage: {mock_coverage:.1f}%\n"
            )
            run.error_message = None if mock_failed == 0 else f"{mock_failed} test(s) failed"
            run.completed_at = datetime.utcnow()

        except Exception as exc:
            run.status = TestRunStatus.failed
            run.error_message = str(exc)[:500]
            run.completed_at = datetime.utcnow()

        await db.commit()
        return {
            "ok": run.status == TestRunStatus.passed,
            "status": run.status.value,
            "total_tests": run.total_tests,
            "passed": run.passed_tests,
            "failed": run.failed_tests,
            "coverage": run.coverage_percent,
            "duration_ms": run.duration_ms,
        }


@celery.task(name="app.workers.testing_worker.execute_test_run_task")
def execute_test_run_task(pipeline_id: str) -> Dict[str, Any]:
    return asyncio.run(execute_test_run(pipeline_id))
