# Dashboards

A page-owned `*Dashboard` composes selected-record details and aggregate overview cards inside `PageBody`'s dashboard region. The route page owns what resource or record selects it. Each card owns its loading, error, and empty presentation.

Name the structural owner `*Dashboard`, not `*Overview`. Name extracted cards `*DashboardCard`; a semantic qualifier such as `Overview`, `Attendance`, or `Notes` precedes that suffix.

## Load dashboard data

Place each data hook beside its smallest consumer. A query used by one card belongs in that card’s `hooks/` directory and is called by that card. Keep a query at dashboard level only when multiple cards consume its results. Cards that render data already supplied by the page do not need a separate data hook. Include every server input in its stable query key, forward cancellation, and enable it only when its selection context exists.

```tsx
function ExampleDashboard({ selected, onAction }: ExampleDashboardProps) {
  if (!selected) return null;

  return <>
    <ExampleDetailsDashboardCard example={selected} onAction={onAction} />
    <ExampleOverviewDashboardCard resourceId={selected.id} />
  </>;
}
```

Pass cards directly through `PageBody`'s dashboard slot, usually as a fragment. Do not add another dashboard layout wrapper inside the shared `page-dashboard` region. Use `DashboardCardGroup` only for a standalone grouped-card surface outside `PageBody`.

## Assign dashboard ownership

- The page defines whether selection comes from the current actor, a resource, a table row, or a calendar item.
- Keep table and calendar selection semantics equivalent when both views select the same domain record.
- Do not default to the first response row when permissions distinguish writable and read-only resources.
- The dashboard owns card composition and data genuinely shared by sibling cards; each card owns its private queries, rendering, and focused actions.
- Page-wide actions stay in `PageHeader`; record-specific actions may live in the relevant card.
- A mutation reconciles or invalidates the overview query separately from table row reconciliation.

Dashboard tests own selection-driven composition and card wiring. Card tests own loading/error/empty presentation, query-state wiring, focused actions and accessible content. Colocate query-hook tests with the hook. Route tests only prove that the selected record reaches the dashboard and cross-owner callbacks are connected.

## Scaffolding

Preview a page-owned dashboard with the dashboard preset:

```bash
npm run scaffold:frontend -- dashboard frontend/src/pages/Staff/Schedules/components ScheduleDashboard --dry-run
```

Remove `--dry-run` to generate `ExampleDashboard.tsx` and its test. Add the card and hook shown below only when they have their own behavior or query.

```text
components/
  ExampleDashboard/
    ExampleDashboard.tsx
    ExampleDashboard.test.tsx
    ExampleOverviewDashboardCard/          optional
      ExampleOverviewDashboardCard.tsx
      ExampleOverviewDashboardCard.test.tsx
      hooks/                               optional
        useExampleOverviewData.ts
        useExampleOverviewData.test.ts
```

The dashboard component and test are required. Add a data hook at its smallest consumer only when remote data is needed, and add a card owner only for a meaningful card with its own rendering or actions. Do not create either as an empty pass-through.
