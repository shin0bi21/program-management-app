# Dashboards

A page-owned `*Dashboard` composes selected-record details and aggregate overview cards inside `PageBody`'s dashboard region. It owns dashboard-specific loading, error, and empty presentation; the route page owns what resource or record selects it.

Name the structural owner `*Dashboard`, not `*Overview`. Name extracted cards `*DashboardCard`; a semantic qualifier such as `Overview`, `Attendance`, or `Notes` precedes that suffix.

## Load dashboard data

Keep a dashboard query in a focused `use*OverviewData` hook when the dashboard needs server aggregates not already held by the page. Include every server input in its stable query key, forward cancellation, and enable it only when its selection context exists.

```tsx
function ExampleDashboard({ selected, onAction }: ExampleDashboardProps) {
  const overview = useExampleOverviewData(selected?.id ?? null);

  if (!selected) return null;

  return <>
    <ExampleDetailsDashboardCard example={selected} onAction={onAction} />
    <ExampleOverviewDashboardCard
      overview={overview.data}
      loading={overview.loading}
      error={overview.error}
    />
  </>;
}
```

Pass cards directly through `PageBody`'s dashboard slot, usually as a fragment. Do not add another dashboard layout wrapper inside the shared `page-dashboard` region. Use `DashboardCardGroup` only for a standalone grouped-card surface outside `PageBody`.

Overview-hook tests own query keys, enabled conditions, server inputs, cancellation and domain response shaping. They do not repeat generic TanStack Query fetching, caching, retry or refresh semantics.

## Assign dashboard ownership

- The page defines whether selection comes from the current actor, a resource, a table row, or a calendar item.
- Keep table and calendar selection semantics equivalent when both views select the same domain record.
- Do not default to the first response row when permissions distinguish writable and read-only resources.
- The dashboard owns card composition and dashboard-only queries; cards own their rendering and focused actions.
- Page-wide actions stay in `PageHeader`; record-specific actions may live in the relevant card.
- A mutation reconciles or invalidates the overview query separately from table row reconciliation.

Dashboard tests own selection-driven composition, loading/error/empty presentation, card wiring and representative query-state wiring. Card tests own card-specific actions and accessible content. Route tests only prove that the selected record reaches the dashboard and cross-owner callbacks are connected.

## Organize dashboard files

Preview a page-owned dashboard with the dashboard preset:

```bash
npm run scaffold:frontend -- dashboard frontend/src/pages/Staff/Schedules/components ScheduleDashboard --dry-run
```

Remove `--dry-run` to generate the skeleton below.

```text
components/
  ExampleDashboard/
    ExampleDashboard.tsx
    ExampleDashboard.test.tsx
    hooks/
      useExampleOverviewData.ts
      useExampleOverviewData.test.ts
    ExampleOverviewDashboardCard/
      ExampleOverviewDashboardCard.tsx
      ExampleOverviewDashboardCard.test.tsx
```

The dashboard component and test are required. Add the overview-data hook only for dashboard-owned remote data, and add a card owner only for a meaningful card with its own rendering or actions. Do not create either as an empty pass-through.
