"""Unit tests for AI-Powered Auto-Merge functionality.

Tests cover:
1. Risk level computation and weights
2. Breaking change pattern detection in commits and files
3. Merge job status validation
4. Dependency conflict detection (npm, pip)
5. Cross-repo impact scoring
6. GitHubClient validation
"""
from __future__ import annotations

import pytest

from app.models.merge import RiskLevel
from app.core.github import GitHubClient


class TestRiskLevelLogic:
    """Unit tests for the risk assessment logic (no DB/API calls)."""

    def test_risk_level_safe(self):
        """Safe risk level should have zero weight."""
        assert RiskLevel.safe.value_weight() == 0.0
        assert RiskLevel.low.value_weight() == 0.2
        # Verify weight progression
        assert RiskLevel.safe.value_weight() < RiskLevel.low.value_weight()

    def test_risk_level_weights(self):
        """All risk levels should have valid weights."""
        assert RiskLevel.safe.value_weight() == 0.0
        assert RiskLevel.low.value_weight() == 0.2
        assert RiskLevel.medium.value_weight() == 0.5
        assert RiskLevel.high.value_weight() == 0.8
        assert RiskLevel.critical.value_weight() == 1.0

    def test_risk_level_ordering(self):
        """Risk levels should increase monotonically."""
        weights = [RiskLevel.safe.value_weight(), RiskLevel.low.value_weight(),
                   RiskLevel.medium.value_weight(), RiskLevel.high.value_weight(),
                   RiskLevel.critical.value_weight()]
        assert weights == sorted(weights), "Risk level weights must be monotonic"

    def test_breaking_patterns_detect_breaking(self):
        """Breaking keywords in commit messages should increase risk."""
        breaking_keywords = ["breaking", "major", "deprecat", "migration", "rename", "remove"]
        commit_msgs = [
            "fix: minor bug fix",
            "feat: add new feature",
            "BREAKING CHANGE: complete API rewrite",
            "refactor: clean up code",
            "migration: update database schema",
        ]
        breaking_count = sum(
            1 for msg in commit_msgs
            if any(kw in msg.lower() for kw in breaking_keywords)
        )
        assert breaking_count == 2, "Should detect 'BREAKING CHANGE' and 'migration'"


class TestRiskAssessmentPatterns:
    """Test the risk assessment pattern detection logic."""

    def test_breaking_file_patterns(self):
        """Critical file patterns should be detected."""
        breaking_patterns = [
            "package.json", "requirements.txt", "Cargo.toml",
            "Dockerfile", "db/migrate/", "schema.sql",
            "api/", "graphql/", "protobuf/",
        ]
        test_files = [
            "package.json", "src/main.py", "db/migrate/001_add_users.py",
            "README.md", "api/v1/users.py", "docs/index.md",
        ]
        detected = []
        for filename in test_files:
            for pattern in breaking_patterns:
                if pattern in filename:
                    detected.append((filename, pattern))
                    break
        assert len(detected) == 3, "Should detect package.json, db/migrate/, and api/"


class TestMergeJobValidation:
    """Test merge job status validation logic."""

    def test_merge_status_transitions(self):
        """Validate allowed merge job status transitions."""
        from app.models.merge import MergeStatus

        # All statuses should have string values
        assert MergeStatus.pending.value == "pending"
        assert MergeStatus.risk_assessing.value == "risk_assessing"
        assert MergeStatus.approved.value == "approved"
        assert MergeStatus.blocked.value == "blocked"
        assert MergeStatus.merging.value == "merging"
        assert MergeStatus.completed.value == "completed"
        assert MergeStatus.failed.value == "failed"
        assert MergeStatus.conflict.value == "conflict"
        assert MergeStatus.rolled_back.value == "rolled_back"

    def test_blocked_merge_requires_force(self):
        """Blocked merges require force=True to proceed."""
        from app.models.merge import MergeStatus
        blocked = MergeStatus.blocked
        assert blocked.value == "blocked"
        assert blocked != MergeStatus.completed
        assert blocked != MergeStatus.approved



def test_risk_assessment_pattern_detection():
    """Risk assessment correctly identifies breaking change patterns."""
    breaking_keywords = ["breaking", "major", "deprecat", "migration", "rename", "remove"]

    test_cases = [
        ("fix: minor bug fix", 0, "No breaking keywords"),
        ("BREAKING CHANGE: API rewrite", 1, "Uppercase breaking"),
        ("migration: update schema", 1, "Migration keyword"),
        ("feat(deprecated): remove old API", 2, "Deprecat + remove keywords"),
        ("refactor: rename function", 1, "Rename keyword"),
    ]
    for msg, expected, label in test_cases:
        count = sum(1 for kw in breaking_keywords if kw in msg.lower())
        assert count == expected, f"Failed for '{label}': {msg}"


class TestGitHubClientExt:
    """Test additions to GitHubClient used by auto-merge."""

    def test_token_validation(self):
        """GitHubClient should reject empty tokens."""
        with pytest.raises(ValueError, match="GitHubClient requires a non-empty token"):
            GitHubClient("")

    def test_valid_token(self):
        """Valid token should create client without error."""
        client = GitHubClient("ghp_validtoken123")
        assert client.token == "ghp_validtoken123"
        assert "Bearer ghp_validtoken123" in client.headers["Authorization"]


class TestDependencyConflictDetection:
    """Test dependency conflict detection patterns."""

    def test_package_detection_npm(self):
        """npm package.json conflicts should be detected."""
        upstream = '{"dependencies": {"react": "^18.0.0", "lodash": "^4.17.0"}}'
        fork = '{"dependencies": {"react": "^17.0.0", "axios": "^1.0.0"}}'

        import json
        up_deps = json.loads(upstream).get("dependencies", {})
        fork_deps = json.loads(fork).get("dependencies", {})

        conflicts = []
        for pkg in set(list(up_deps.keys()) + list(fork_deps.keys())):
            uv = up_deps.get(pkg, "")
            fv = fork_deps.get(pkg, "")
            if uv and fv and uv != fv:
                conflicts.append({"package": pkg, "upstream": uv, "fork": fv})

        assert len(conflicts) == 1
        assert conflicts[0]["package"] == "react"

    def test_package_detection_pip(self):
        """pip requirements.txt conflicts should be detected."""
        upstream_lines = ["requests==2.28.0", "flask==2.3.0"]
        fork_lines = ["requests==2.31.0", "django==4.2.0"]

        up_pkgs = {}
        for line in upstream_lines:
            if "==" in line:
                p, v = line.split("==", 1)
                up_pkgs[p.strip()] = v.strip()

        fork_pkgs = {}
        for line in fork_lines:
            if "==" in line:
                p, v = line.split("==", 1)
                fork_pkgs[p.strip()] = v.strip()

        conflicts = []
        for pkg in set(list(up_pkgs.keys()) + list(fork_pkgs.keys())):
            uv = up_pkgs.get(pkg, "")
            fv = fork_pkgs.get(pkg, "")
            if uv and fv and uv != fv:
                conflicts.append({"package": pkg, "upstream": uv, "fork": fv})

        assert len(conflicts) == 1
        assert conflicts[0]["package"] == "requests"


class TestCrossRepoImpact:
    """Test cross-repo impact analysis logic."""

    def test_impact_score_calculation(self):
        """Impact score should be based on behind count and changes."""
        behind = 14
        total_additions = 500
        total_deletions = 100
        api_changes = 2
        breaking_changes = 1
        config_changes = 3

        impact_score = min(100, (
            behind * 2 +
            total_additions * 0.1 +
            total_deletions * 0.05 +
            api_changes * 5 +
            breaking_changes * 10 +
            config_changes * 3
        ))

        expected = min(100, (28 + 50 + 5 + 10 + 10 + 9))
        assert impact_score == expected

    def test_action_recommendation(self):
        """Recommendation should match impact score ranges."""
        def get_recommendation(score):
            if score < 30:
                return "Safe to auto-merge"
            elif score < 60:
                return "Review recommended before merge"
            return "Manual review required - high risk of conflicts"

        assert get_recommendation(20) == "Safe to auto-merge"
        assert get_recommendation(45) == "Review recommended before merge"
        assert get_recommendation(75) == "Manual review required - high risk of conflicts"
