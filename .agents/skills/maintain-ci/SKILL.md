---
name: maintain-ci
description: Assess, document, optimize, or change this repository's CI architecture, GitHub Actions workflows, test-runner composition, sharding, caching, required checks, browser-test scheduling, pattern reviews, and CI performance. Use for CI speed investigations, workflow failures, test-layer routing, or edits under .github/workflows and scripts/tests that affect automation behavior.
---

# Maintain CI

Evolve CI without weakening the merge gate or confusing local and remote test ownership.

## 1. Establish the execution path

1. Read [`docs/workflows/ci.md`](../../../docs/workflows/ci.md) completely. It owns CI architecture, operations, gates, routing, performance, and failure handling.
2. Inspect the affected workflow, its called repository scripts, and the package commands those scripts invoke.
3. Read `docs/workflows/testing.md` when changing test ownership or runner composition. Read `docs/workflows/local-development.md` when dependencies, containers, databases, or runtime setup are involved. Read `docs/workflows/deployment.md` for any push-to-main or production path.
4. Trace both the pull-request path and any push, scheduled, manual, or deployment path affected by the change.

Treat workflow files as orchestration, repository scripts as stable developer/CI entry points, and package scripts as framework-level commands.

## Orchestrate large CI work

When sub-agent tools are available, delegate only independent read-only lanes such as performance measurement, workflow-path auditing, or local-runner ownership analysis. Keep workflow integration, required-check decisions, implementation, and final verification with the primary agent.

Keep the primary orchestrator on the strongest available model and reasoning tier. Use a lower-cost worker at low reasoning by default for bounded measurement, inventory, and workflow-tracing lanes. Increase a worker's capability or reasoning only when its lane itself contains non-obvious dependency or concurrency analysis. If explicit tier selection is unavailable, use the available worker without blocking.

- Define the exact workflows, time range, commits, or runner boundary for each lane.
- Do not have multiple agents edit shared workflow or runner files concurrently.
- Reconcile measurements against comparable samples before claiming an improvement.
- Continue single-threaded for ordinary CI failures or narrow workflow changes.

## 2. Preserve CI contracts

- Keep `develop` as the feature integration target and allow `main` changes only through `develop`.
- Preserve required lint, type, migration, generated-file, test, and build coverage unless the user explicitly approves a gate change.
- Keep Vitest browser-independent tests in normal PR CI. Keep Playwright explicit and separate unless browser behavior must become a required merge gate.
- Keep pattern enforcement independently visible; do not silently fold it into an unrelated job.
- Use least-privilege workflow permissions, pinned runtime versions, bounded timeouts, and cancellation only where abandoning an older run is safe.
- Preserve local equivalents for checks that developers or agents are expected to reproduce.

## 3. Optimize with evidence

1. Define the boundary commit or pull request and select comparable successful runs.
2. Separate queue delay, execution wall time, total runner consumption, failure rate, and time-to-merge. Do not present one as another.
3. Prefer medians and report sample sizes; use means only as supporting context.
4. Exclude reruns, cancelled runs, release PRs, and unrelated workflow shapes, or disclose them separately.
5. Compare job-level timestamps when run-level timestamps include queueing or delayed status updates.
6. State whether a change improves developer wait time, compute consumption, or both.

Do not claim a durable improvement from a tiny sample. Record a dated baseline in the CI owner document when the measurement will guide future work.

## 4. Implement and verify

1. Keep the change at the narrowest ownership layer. Avoid duplicating package commands across workflows when a repository runner is the canonical interface.
2. Verify workflow dependencies, conditions, path classification, concurrency groups, cache keys, timeouts, permissions, and required-check names.
3. Run `bash -n` and `shellcheck` for changed shell scripts when available.
4. Run `node scripts/agents/validate-skills.ts` when repository skills change.
5. Run the narrow affected runner and `bash scripts/tests/test-static.sh` when the change affects executable test or static-analysis behavior.
6. Review the final workflow graph against `docs/workflows/ci.md` and update that document in the same concern when architecture, ownership, or operation changes.

Report checks run, unverified GitHub-only behavior, expected wall-time effect, expected runner-minute effect, and any required-check or branch-protection follow-up.
