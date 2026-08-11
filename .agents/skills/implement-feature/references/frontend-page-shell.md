# Frontend page-shell workflow

## Compose the route page

- Use one `main.page-container.page-container--data` and one route-level `PageHeader`.
- Put the concise page title in `PageHeader`; place permission-aware create, add, invite, export, or other page-wide actions in its `actions` slot.
- Put `SearchInput`, `FilterCard`, and view-switching controls in the named `search`, `filters`, and `view` slots. Keep row actions and content-specific controls with their owning content.
- Keep data loading, filtering, preference persistence, and action workflows in the page or focused hooks rather than in `PageHeader`.

Use this route-level composition. Omit an optional prop rather than passing an empty wrapper. Pass `Table` or `ResourceCalendar` directly to its slot; do not add a page-owned table, calendar, dashboard, title-row, or controls wrapper.

```tsx
<main className="page-container page-container--data">
  <PageHeader
    title="Page Title"
    actions={canCreate ? <Button>+ Add</Button> : undefined}
    search={showSearch ? <SearchInput {...searchProps} /> : undefined}
    filters={<FilterCard {...filterProps} />}
    view={hasMultipleViews ? <ViewMenu {...viewProps} /> : undefined}
  />

  {pageError && <p className="form-error" role="alert">{pageError}</p>}

  {controlsReady && <PageBody
    ariaLabel="Page overview and records"
    dashboard={<>
      <DashboardCard title="Overview">...</DashboardCard>
      <DashboardCard title="Details" action={optionalCardAction}>...</DashboardCard>
    </>}
    {...(view === 'list'
      ? { table: <Table {...tableProps} /> }
      : { calendar: <ResourceCalendar {...calendarProps} /> })}
  />}
</main>
```

`PageHeader` owns and emits this DOM in this order. Never reproduce these classes in a page:

```html
<header class="page-header page-header--with-controls">
  <div class="page-title-row">
    <h1 class="page-title">Page Title</h1>
    <!-- optional actions slot; no extra PageHeader-owned wrapper -->
  </div>
  <div class="page-header-search"><!-- optional SearchInput --></div>
  <div class="page-header-filters"><!-- optional FilterCard --></div>
  <div class="page-header-view"><!-- optional ViewMenu --></div>
</header>
```

The `page-header--with-controls` modifier is present when any search, filters, or view slot is present. Each optional control container exists only when its slot is supplied. Actions remain in `page-title-row`; do not put search, filters, or view controls there.

## Present page state

- Restore persisted controls before rendering dependent content or misleading defaults.
- Place page-level loading, error/retry, empty, filtered-empty, and permission states around the owned content without replacing component-owned states.
- Compose data pages with `PageHeader` followed by the shared `PageBody`. Put overview cards and selected-record details in its `dashboard` slot, and provide exactly one `table` or `calendar` content slot so every data page exposes the same `page-dashboard`, `page-table`, and `page-calendar` structure.
- Define what selects each dashboard (current actor, resource row, or item), keep list and calendar selection wiring equivalent, and avoid defaulting to the first response row when authorization distinguishes writable and read-only resources.

`PageBody` and `DashboardCard` own and emit the following DOM. Supply `DashboardCard` items directly through the dashboard slot; use a fragment to pass multiple cards, not another layout wrapper. Use `DashboardCardGroup` only for a standalone grouped-card surface that is not already inside `PageBody`'s `page-dashboard` landmark.

```html
<section class="page-body" aria-label="Page overview and records">
  <aside class="page-dashboard">
    <article class="dashboard-card">
      <div class="dashboard-card__header">
        <h2>Overview</h2>
        <!-- optional card action -->
      </div>
      <div class="dashboard-card__content">
        <!-- card content, or dashboard-card__empty from DashboardCard -->
      </div>
    </article>
    <!-- additional DashboardCard articles -->
  </aside>
  <div class="page-table">
    <div class="table-wrapper">
      <table class="table"><!-- Table owns all internal table DOM --></table>
    </div>
  </div>
</section>
```

For calendar view, `PageBody` replaces `div.page-table` with `div.page-calendar` and renders `ResourceCalendar` directly inside it. It never renders both. Do not insert a second `main`, `section.page-body`, `aside.page-dashboard`, `div.page-table`, `div.page-calendar`, or `div.table-wrapper` from a route page; the shared components own those elements and their CSS contract.

## Verify the shell

- Test permission-dependent primary actions and wiring from search, filters, and view controls to page state.
- Confirm header wrapping, mobile search and filters, dashboard stacking, long titles/actions, content height, and modal fit at the shared `768px` breakpoint.
