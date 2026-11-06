# Reports

Repository reports summarize existing state; they do not change application code, CI configuration, containers, or production.

Report scripts use a `-report.ts` suffix, colocated tests use `-report.test.ts`,
and npm commands use the `report:<subject>` prefix.

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

The command lives in `scripts/reports/file-changes-report.ts`. It reports branch and
upstream state, changed paths, ownership categories, existing stashes, a content
fingerprint, and checks selected by the shared CI policy. It does not run checks
or save a backup. `INSPECT_CHANGES_BASE_REF` overrides the default comparison base
when `--base` is absent.

<a id="ci-report"></a>
<a id="deployment-history-report"></a>

## CI History Report

Read saved development checks and production deployment history without GitHub access:

```bash
npm run report:ci-history -- --start 2026-08-09
npm run report:ci-history -- --start 2026-08-09 --dev
npm run report:ci-history -- --start 2026-08-09 --main --success
npm run report:ci-history -- --start 2026-09-01 --end 2026-09-30 --main --type frontend --exclusive
```

`--start` is required. `--end` defaults to now; explicit dates include the entire
UTC day. Filtering uses each attempt's UTC start time. `--dev` selects CI workflow
attempts on PRs targeting `develop`; `--main` selects production deployments,
not release PR checks. Without either flag, the report shows both views separately.

The sole data source is `data/reports/ci-history.json`. The report displays its
capture time and each view's coverage; requesting later dates does not fetch
new data. Development history contains completed attempts, including failures,
cancellations, and reruns. The retained production snapshot contains only
successful first attempts, so its success rate is unavailable. Update the saved
data explicitly when newer history is needed; this command never refreshes it.

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
Component filters require `--main`. `--file` accepts another saved history file,
validated before filtering. No matches produces a clear message and successful exit.

## LOC Report

Use the LOC report for a repository-size breakdown. The single TypeScript command
`scripts/reports/loc-report.ts` discovers Git-tracked and nonignored untracked
files, excludes `.git`, `node_modules`, `dist`, and `build`, and separates
TypeScript and React source from their tests:

```bash
npm run report:loc
npm run report:loc -- all
npm run report:loc -- all --include-comments
npm run report:loc -- ts tsx sql
```

`report:loc` defaults to application TypeScript and React files. Pass `all` to include CSS, SQL, and Markdown, or provide an explicit extension list.

Blank lines and comment lines are excluded by default. Use `--include-comments`
only when requested.
Comment filtering trims each line before checking its prefix:
`//` for TS/TSX, `--` for SQL, `/*` for TS/TSX/CSS/SQL, `{/*` for TSX, and
`<!--` for Markdown. A block excludes every line through its first closing
marker, including any code on that closing line. Inline comments on code lines
do not change their count. This deliberately uses line rules rather than parsing
strings, templates, Markdown fences, or nested block comments. Other extensions
use nonblank line counts.
