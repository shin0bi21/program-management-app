# Reports

Repository reports summarize existing state; they do not change application code, CI configuration, containers, or production.

Report scripts use a `-report.ts` suffix, colocated tests use `-report.test.ts`,
and npm commands use the `report:<subject>` prefix.

## Log Report

Read development Docker logs, captured files, or pasted console output:

```bash
npm run report:logs -- --docker backend --since 5m --match TypeError
npm run report:logs -- --docker --since 1h --type error
npm run report:logs -- browser-console.txt --match "Failed to fetch" --context 4
pbpaste | npm run report:logs
```

Docker input uses the repository's development Compose stack. Supply service names
or omit them to read all services. `--since` accepts Docker time values such as
`5m`, `1h`, or an absolute timestamp and defaults to `5m`. The command captures
existing output; it does not follow logs, restart containers, or alter data.

Without filters, the report groups recognized HTTP failures, errors, warnings,
and application frames. `--match` selects literal text ignoring case, including
messages the classifier does not recognize. `--type` selects `error`, `warning`,
`http`, or `frame`; both filters must match when combined. Grouping removes Compose
prefixes and ISO timestamps; HTTP summaries omit hosts and query values.

Each group includes its count, source line locations, and surrounding lines from
its first occurrence. Context defaults to two lines on each side; use `--context 0`
for counts and locations only. Docker line numbers refer to the captured output,
not a persistent server file. Nearby frames and requests provide context without
establishing a shared cause. Raw context retains the supplied log contents.
No matches produces an explanatory message and a successful exit; input and
Docker failures exit nonzero.

## Changes Report

Inspect branch commits and staged, unstaged, and untracked changes with:

```bash
npm run report:changes
npm run report:changes -- --json --base origin/develop
```

The command lives in `scripts/reports/file-changes-report.ts`. It reports branch and
upstream state, changed paths, ownership categories, existing stashes, a content
fingerprint, and checks selected by the shared CI policy. It does not run checks
or save a backup. `INSPECT_CHANGES_BASE_REF` overrides the default comparison base
when `--base` is absent.

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
frontend plus backend. Exclusive migration selection includes its required backend;
exclusive infrastructure selection includes all four components. Date bounds are inclusive and use each deployment job's
UTC start date. Impossible calendar dates are rejected.

With no filters, the table shows frontend-only, full, frontend-plus-backend, and
frontend-plus-backend-plus-migrations deployments. Component or date filters
allow every matching deployment path to appear. Custom history supplied with
`--file` is validated before filtering and aggregation.

## LOC Report

Use the LOC report for a repository-size breakdown. The single TypeScript command
`scripts/reports/loc-report.ts` discovers Git-tracked and nonignored untracked
files, excludes `.git`, `node_modules`, `dist`, and `build`, and separates
TypeScript and React source from their tests:

```bash
npm run report:loc
npm run report:loc -- --ignore-comments
npm run report:loc -- all --ignore-comments
npm run report:loc -- all
npm run report:loc -- ts tsx sql
```

`report:loc` defaults to application TypeScript and React files. Pass `all` to include CSS, SQL, and Markdown, or provide an explicit extension list.

Blank and whitespace-only lines are always excluded. Comments count by default.
With `--ignore-comments`, each line is trimmed before checking its prefix:
`//` for TS/TSX, `--` for SQL, `/*` for TS/TSX/CSS/SQL, `{/*` for TSX, and
`<!--` for Markdown. A block excludes every line through its first closing
marker, including any code on that closing line. Inline comments on code lines
do not change their count. This deliberately uses line rules rather than parsing
strings, templates, Markdown fences, or nested block comments. Other extensions
use nonblank line counts.
