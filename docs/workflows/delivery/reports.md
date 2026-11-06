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

Docker input identifies the stack from Compose labels on this checkout's containers,
including stopped services. With one recognized configuration, it automatically
selects `docker-compose.yml` or `docker-compose.prod.yml`. Supply service names or
omit them to read all services. `--since` accepts Docker time values such as `5m`,
`1h`, or an absolute timestamp and defaults to `5m`.

If no stack can be identified, both stacks are present, or containers use custom
Compose overrides, the report stops. Select a repository stack explicitly with
`--development` or `--production` when needed; both flags require `--docker`.
The command captures existing output without following logs, restarting containers,
or altering data.

On Lightsail, run from `/home/ubuntu/my-webapp` with Node 24 and Docker Compose
available on the host. The report uses only Node built-ins and needs no `npm install`:

```bash
node scripts/reports/log-report.ts --docker nginx backend --since 5m --context 4
```

This reads the selected stack through the host's Docker CLI. It does not run
inside the application containers or require an application image rebuild.

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
