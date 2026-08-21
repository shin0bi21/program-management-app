# Frontend dashboard

A page-owned `*Dashboard` composes selected-record details and aggregate overview cards inside `PageBody`'s dashboard region. It owns dashboard-specific loading, error, and empty presentation; the route page owns what resource or record selects it.

Name the structural owner `*Dashboard`, not `*Overview`. Name extracted cards `*DashboardCard`; a semantic qualifier such as `Overview`, `Attendance`, or `Notes` precedes that suffix.

## Data and hook pattern

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

## Ownership rules

- The page defines whether selection comes from the current actor, a resource, a table row, or a calendar item.
- Keep table and calendar selection semantics equivalent when both views select the same domain record.
- Do not default to the first response row when permissions distinguish writable and read-only resources.
- The dashboard owns card composition and dashboard-only queries; cards own their rendering and focused actions.
- Page-wide actions stay in `PageHeader`; record-specific actions may live in the relevant card.
- A mutation reconciles or invalidates the overview query separately from table row reconciliation.

## Dashboard tests

Dashboard tests own selection-driven composition, loading/error/empty presentation, card wiring, and query enablement. Hook tests own query keys, server inputs, cancellation, and response shaping. Card tests own card-specific actions and accessible content. Route tests only prove the selected record reaches the dashboard and cross-owner callbacks are connected.
