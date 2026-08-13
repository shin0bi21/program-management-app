# Review and shipping

Implementation, review, shipping, and deployment are distinct phases. Completing code does not authorize commits, pull requests, merges, or deployment.

## 1. Establish the concern

Before deep review, decide whether the working tree is one cohesive concern or several independently reviewable changes. Do not manufacture splits inside one contract. When work is mixed, record a concern map and review and ship each concern separately.

## 2. Review the exact diff

Review tracked and untracked changes for correctness, regressions, security, authorization, ownership boundaries, maintainability, and test adequacy. Use successful focused test evidence while the exact concern diff remains unchanged. Run:

```bash
node scripts/agents/check-patterns.js --changed
git diff --check
```

Use `bash scripts/tests/test-app.sh --plan-changed` when test ownership is uncertain. Required GitHub checks, rather than repeated full local suites, are the merge gate.

Agents use the repository `split-changes` and `review-changes` skills for these phases. Humans follow the same concern and evidence boundaries.

## 3. Ship serially

After approval, the shipping workflow creates or links the GitHub issue, uses an issue-numbered branch, verifies the isolated concern, commits it, opens a pull request to `develop`, waits for required checks, and merges it. For multiple concerns, return to clean synchronized `develop` before preparing the next branch.

Agents use the repository `ship-changes` skill for this workflow. A request to implement, review, commit, or merge does not authorize deployment; deployment must be requested separately.
