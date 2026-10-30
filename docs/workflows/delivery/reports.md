# Reports

Repository reports summarize existing state; they do not change application code, CI configuration, containers, or production.

## CI Report

Use the CI report to measure recent merge-gate performance from GitHub pull requests and Actions runs:

```bash
npm run report:ci
npm run report:ci -- --branch develop --last 20
npm run report:ci -- --since 2026-07-01 --until 2026-07-31
npm run report:ci -- --since 2026-07-01 --json
```

The default report examines the five most recent pull requests merged to `develop` or `main`. It reports queue time, merge-gate wall time, summed runner time, success rate, and reruns. CI-changing pull requests become timeline boundaries so comparisons do not blend different pipeline shapes. Successful first attempts drive timing summaries; cancelled runs are excluded and reruns remain visible.

The command requires authenticated GitHub CLI access. Run `gh auth status` if it cannot retrieve repository or Actions data. See [Continuous Integration](ci.md) for workflow behavior and failure reproduction.

## Deployment History Report

Render the deployment-path timing table from the committed per-run JSON:

```bash
npm run report:deployments
npm run report:deployments -- --type frontend
npm run report:deployments -- --type frontend --exclusive
npm run report:deployments -- --type frontend --type backend
npm run report:deployments -- --since 2026-09-01 --until 2026-09-30
```

The command calculates every displayed aggregate from
`data/reports/deployment-history.json`. The JSON remains the sole source of
deployment timing data; the report does not query GitHub or maintain a second
copy of the measurements. A type filter normally includes every deployment in
which that component participated; add `--exclusive` to require exactly the
selected component combination. Repeat `--type` to select combinations such as
frontend plus backend. Date bounds are inclusive and use each deployment job's
UTC start date.

## LOC Report

Use the LOC report for a repository-size breakdown. It excludes `.git`, `node_modules`, and `dist` output, and separates TypeScript and React source from their tests:

```bash
npm run report:loc
npm run report:loc -- --ignore-comments
npm run report:loc -- all --ignore-comments
npm run report:loc -- all
npm run report:loc -- ts tsx sql
```

`report:loc` defaults to application TypeScript and React files. Pass `all` to include CSS, SQL, and Markdown, or provide an explicit extension list.

Blank and whitespace-only lines are always excluded. Comments count by default.
Pass `--ignore-comments` to exclude comment-only lines for TypeScript/React (`//`, `/* */`, JSDoc,
and JSX comments), CSS (`/* */`), SQL (`--` and `/* */`), and Markdown
(`<!-- -->`). Lines containing both code and comments still count. Quoted comment markers remain content. Other requested extensions use
nonblank line counts.
