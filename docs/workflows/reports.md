# Reports

Repository reports summarize existing state; they do not change application code, CI configuration, containers, or production.

## CI report

Use the CI report to measure recent merge-gate performance from GitHub pull requests and Actions runs:

```bash
npm run report:ci
npm run report:ci -- --branch develop --last 20
npm run report:ci -- --since 2026-07-01 --until 2026-07-31
npm run report:ci -- --since 2026-07-01 --json
```

The default report examines the five most recent pull requests merged to `develop` or `main`. It reports queue time, merge-gate wall time, summed runner time, success rate, and reruns. CI-changing pull requests become timeline boundaries so comparisons do not blend different pipeline shapes. Successful first attempts drive timing summaries; cancelled runs are excluded and reruns remain visible.

The command requires authenticated GitHub CLI access. Run `gh auth status` if it cannot retrieve repository or Actions data. See [Continuous integration](ci.md) for workflow behavior and failure reproduction.

## LOC report

Use the LOC report for a repository-size breakdown. It excludes `.git`, `node_modules`, and `dist` output, and separates TypeScript and React source from their tests:

```bash
npm run report:loc
npm run report:loc -- all
npm run report:loc -- ts tsx sql
```

`report:loc` defaults to application TypeScript and React files. Pass `all` to include CSS, SQL, and Markdown, or provide an explicit extension list.
