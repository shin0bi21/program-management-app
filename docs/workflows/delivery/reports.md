# Reports

Run commands from the repository root.

## Log Report

Read Docker logs, captured files, or pasted console output:

```bash
npm run report:logs -- --docker backend --since 5m --match TypeError
npm run report:logs -- --docker --since 1h --type error
npm run report:logs -- browser-console.txt --match "Failed to fetch" --context 4
pbpaste | npm run report:logs
```

Omit service names to read all services. `--since` defaults to `5m` and accepts
Docker time values or an absolute timestamp. If stack detection fails, add
`--development` or `--production` with `--docker`.

On Lightsail, run from `/home/ubuntu/my-webapp` with Node 24 and Docker Compose
available on the host. Run:

```bash
node scripts/reports/log-report.ts --docker nginx backend --since 5m --context 4
```

The output groups failures by source and message. Backend request summaries retain
error class/message, request IDs, timestamps, and associated stack/cause details.
Each occurrence includes its captured line location. Different services and
stack/cause details remain separate groups.

`--match` searches messages and attached details, ignoring case. `--type http`
selects HTTP failures, `error` includes HTTP 5xx, and `warning` includes HTTP 4xx;
`frame` selects standalone application frames. Combined filters must both match.
Use `--context 0` to omit neighboring lines; attached error details remain.
The default context is two lines.

No matches exits successfully. Input or Docker failures exit nonzero.

## Changes Report

Inspect branch commits and staged, unstaged, and untracked changes with:

```bash
npm run report:changes
npm run report:changes -- --json --base origin/develop
```

The report includes branch/upstream state, changed paths, ownership categories, existing stashes, a content
fingerprint, and checks selected by the shared CI policy. It does not run checks
or save a backup. `INSPECT_CHANGES_BASE_REF` overrides the default comparison base
when `--base` is absent.

<a id="ci-report"></a>
<a id="deployment-history-report"></a>

## CI History Report

Query completed GitHub development checks and production deployments:

```bash
npm run report:ci-history -- --start 2026-08-09
npm run report:ci-history -- --start 2026-08-09 --dev
npm run report:ci-history -- --start 2026-08-09 --main --success
npm run report:ci-history -- --start 2026-09-01 --end 2026-09-30 --main --type frontend --exclusive
```

`--start` is required; `--end` defaults to now. Dates are inclusive and use UTC.
`--dev` shows development PR checks; `--main` shows production deployments.
Omit both flags to show the views separately.

Requires authenticated GitHub CLI access (`gh auth login`). The command queries
completed runs for the requested creation dates and prints the report directly;
it does not save a dataset. If GitHub's 1,000-run query limit is reached, narrow
the date range.

Successful attempts are shown by default; `--success` selects that view explicitly.
Use `--failures` for failed attempts or `--all` for every outcome, including
cancellations. These three flags are mutually exclusive. Success rate appears
with `--all` and excludes cancellations.

Successful-run mean, median, and range use first attempts only. Failed attempts
have a separate timing table, labeled as potentially ending early; their durations
never enter successful-run summaries. Queue and summed runner time medians appear
when recorded.

Production timings remain grouped by deployment path. Repeat `--type` to require
multiple components; `--exclusive` requires exactly that combination. Migrations
include their required backend; infrastructure includes all four components.
Component filters require `--main`. Deployments with missing component logs remain
`Unclassified`; component filters exclude them. No matches produces a clear message
and successful exit.

## LOC Report

Count repository lines by file type, separating TypeScript/React source and tests:

```bash
npm run report:loc
npm run report:loc -- all
npm run report:loc -- all --include-comments
npm run report:loc -- ts tsx sql
```

`report:loc` defaults to application TypeScript and React files. Pass `all` to include CSS, SQL, and Markdown, or provide an explicit extension list.

Blank lines and comment lines are excluded by default. Use `--include-comments`
only when requested.
Counts include tracked and nonignored untracked files, excluding dependency and
build directories. Comment filtering uses line prefixes rather than a parser.
