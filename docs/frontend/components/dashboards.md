# Dashboards

A page-owned `*Dashboard` composes selected-record details and aggregate overview cards inside `PageBody`'s dashboard region. The route page owns what resource or record selects it. Each card owns its loading, error, and empty presentation.

Name the structural owner `*Dashboard`, not `*Overview`. Name extracted cards `*DashboardCard`; a semantic qualifier such as `Overview`, `Attendance`, or `Notes` precedes that suffix.

Dashboard cards use two shared sizes: **normal** is the default; **short** is for
Hours and Tasks. Programming's program overview and session cards use normal cards.
The [card shell contract](#keep-the-card-shell-stable) applies in every data state.

## Load dashboard data

Place each data hook beside its smallest consumer. A query used by one card belongs in that card’s `hooks/` directory and is called by that card. Keep a query at dashboard level only when multiple cards consume its results. Cards that render data already supplied by the page do not need a separate data hook. Include every server input in its stable query key, forward cancellation, and enable it only when its selection context exists.

```tsx
function ScheduleDashboard({ selected, onAction }: ScheduleDashboardProps) {
  return <>
    <ExampleDetailsDashboardCard example={selected} onAction={onAction} />
    <ExampleOverviewDashboardCard resourceId={selected?.id ?? null} />
  </>;
}
```

Pass cards directly through `PageBody`'s dashboard slot, usually as a fragment. Do not add another dashboard layout wrapper inside the shared `page-dashboard` region. Use `DashboardCardGroup` only for a standalone grouped-card surface outside `PageBody`.

## Keep the card shell stable

Every dashboard card keeps its declared shared height across breakpoints and states:
normal uses `--dashboard-card-height`; the optional `dashboard-card--short` modifier
uses `--dashboard-card-height-short`. The [brand tokens](../../../frontend/src/common/styles/brand.css)
own their values. Use `DashboardCard`; a custom
metric layout must retain its `dashboard-card` shell and the same size modifier in
all states. Do not introduce content-sized, percentage, or page-specific pixel heights.
Keep the heading and actions outside the scrolling data region. The shared
`dashboard-card__content` owns remaining space, `min-height: 0`, and internal scrolling.
Custom compact metric layouts bound scrolling to the data column; their action
column stays outside that scrollport. Longer notes or lists never grow the whole card.

Programming Settings reuses the card shell for full management tables, not overview
summaries. Its explicitly named management panels fill the desktop content region
and size to their table on mobile; the normal/short summary heights do not apply.

The [shared shell styles](../../../frontend/src/common/components/DashboardCard/DashboardCard.css)
own padding, header spacing, and short-card typography. Both sizes use the same outer
padding and top-aligned titles/actions. Short-card metric values keep numbers the same
size as date ranges and cycle names. Use the shared variables in Hours and Tasks;
do not override shell padding or header margins in page CSS. Long titles or wrapped
actions may expand the header; the data region scrolls in the remaining space.

Keep card components and their titles, metric labels, and action slots mounted when
the selection changes. Only the data/value region changes between states. Avoid
separate early returns that replace the normal card with a plain loading article,
change its layout, or remove its title. A target-dependent title may update to the
new target immediately; it must not describe the previous target's data.

Use `DashboardCard`'s `loading` and `loadingLabel` for a whole data region. Use
`DashboardCardLoading` inside individual metric values when labels should remain:

```tsx
<DashboardCard title="Notes" loading={hasTarget && query.isLoading}
  loadingLabel="Loading notes…" action={addAction}>
  {notesContent}
</DashboardCard>

<dd>{loading ? <DashboardCardLoading label="Loading hours…" /> : hours}</dd>
```

`DashboardCardLoading` uses the existing small `LoadingSpinner`, left-aligned in the
data/value region, with an accessible status label. The spinner owns reduced-motion behavior. Custom
shells also expose `aria-busy` while loading. Keep a no-selection prompt distinct
from loading, a successful empty result, and an error with retry. A disabled query's
pending status alone does not mean a selection is loading. Do not display fabricated
zero totals while waiting. Keep usable cached data during a same-target background
refresh; a new target must never display the previous target's values or actions.
Disable actions that need unavailable data, and scope open reports/dialogs to their
target so a selection change cannot present an old report under a new title.

## Separate selection intent from data availability

Choose the dashboard from the user's explicit selection intent, not whether the
selected record happens to be in a loaded table page or calendar buffer. Selecting
a Session opens the Session dashboard immediately using the clicked record; its
private queries show loading in their own cards. If that record leaves the buffer,
the Session cards remain and show “No session selected.” Only explicitly selecting
a program row switches to Program Overview. An item click that also selects its
owning row is context synchronization, not an explicit program-dashboard request.

Keep this coordination in the route or its selection hook. Shared tables/calendars
report selection events; they do not own domain dashboard modes. Resolve a clicked
full record in the selection update rather than waiting for a child's later effect.

## Assign dashboard ownership

- The page defines whether selection comes from the current actor, a resource, a table row, or a calendar item.
- Keep table and calendar selection semantics equivalent when both views select the same domain record.
- Do not default to the first response row when permissions distinguish writable and read-only resources.
- The dashboard owns card composition and data genuinely shared by sibling cards; each card owns its private queries, rendering, and focused actions.
- Page-wide actions stay in `PageHeader`; record-specific actions may live in the relevant card.
- A mutation reconciles or invalidates the overview query separately from table row reconciliation.

Verify a delayed response and a target change preserve the same card DOM shell, titles,
labels, and disabled action slots without showing another target’s data. Cover empty
and failed results separately. Browser tests own fixed height and internal overflow
on desktop and mobile; consumer tests cover loading wiring rather than repeating
shared geometry checks.

Dashboard tests own selection-driven composition and card wiring. Card tests own loading/error/empty presentation, query-state wiring, focused actions and accessible content. Colocate query-hook tests with the hook. Route tests only prove that the selected record reaches the dashboard and cross-owner callbacks are connected.

## Scaffolding

Preview a page-owned dashboard with the dashboard preset:

```bash
npm run scaffold:frontend -- dashboard frontend/src/pages/Staff/Schedules/components ScheduleDashboard --dry-run
```

Remove `--dry-run` to generate `ScheduleDashboard.tsx` and its test. Add the card and hook shown below only when they have their own behavior or query.

```text
components/
  ScheduleDashboard/
    ScheduleDashboard.tsx
    ScheduleDashboard.test.tsx
    ExampleOverviewDashboardCard/          optional
      ExampleOverviewDashboardCard.tsx
      ExampleOverviewDashboardCard.test.tsx
      hooks/                               optional
        useExampleOverviewData.ts
        useExampleOverviewData.test.ts
```

The dashboard component and test are required. Add a data hook at its smallest consumer only when remote data is needed, and add a card owner only for a meaningful card with its own rendering or actions. Do not create either as an empty pass-through.
