# Frontend scaffolding

Use the repository scaffolder to apply established owner contracts to a route page, form modal, remote table, timeline calendar, or dashboard. Every preset follows the general [component-owner structure](README.md#organize-an-owner), then adds only the naming, required subowners, tests, and implementation checklist specific to that contract. The scaffolder uses ts-morph to create and format TypeScript syntax, validates names and destinations, previews changes, and refuses to overwrite existing files.

Do not add a generic component or overlay preset. Components are too varied to justify placeholder structure beyond the general owner pattern, and overlay placement does not identify whether the correct interaction is a dialog, floating menu, tooltip, or specialized data surface.

## Preview before writing

```bash
npm run scaffold:frontend -- page Staff/Schedules --dry-run
npm run scaffold:frontend -- modal frontend/src/pages/Staff/Schedules/components ScheduleModal --dry-run
npm run scaffold:frontend -- table frontend/src/pages/Staff/Schedules/components ScheduleTable --dry-run
npm run scaffold:frontend -- calendar frontend/src/pages/Staff/Schedules/components ScheduleCalendar --dry-run
npm run scaffold:frontend -- dashboard frontend/src/pages/Staff/Schedules/components ScheduleDashboard --dry-run
```

Remove `--dry-run` to create the files and directories.

## Page scaffold

The page command accepts a path below `frontend/src/pages/`. Every path segment uses PascalCase. It creates the page component, route test, `IMPLEMENTATION.md`, and these owner directories:

```text
components/
hooks/
  actions/
  data/
  preferences/
  selection/
utils/
```

The component orders implementation sections as page-local errors, permissions and services, data and preferences, selection and actions, modal workflows, view/body initialization, derived presentation, and render. Its implementation checklist mirrors the canonical test-owner sections in [Testing](../workflows/testing.md#page-test-scaffold-sections): API, page data, preferences/selection/actions, table, calendar, dashboard/modal/components, route, and browser scenarios. Delete sections and directories the page does not need; the scaffold is an ownership prompt, not a requirement to create pass-through hooks or duplicate shared behavior tests.

## Modal scaffold

The modal command accepts a repository-relative owner path below `frontend/src/` and a PascalCase name ending in `Modal`. It creates a form-modal component, workflow hook, colocated tests, and a checklist covering target ownership, initialization, field locks, validation, submission, recovery, and authoritative reconciliation. Use it for a non-trivial form workflow; create a simple focused dialog manually when it does not warrant a workflow hook. Follow [Modals and forms](components/overlays/modals-and-forms.md).

## Table scaffold

The table command requires a PascalCase name ending in `Table`. It creates the table component and test, its required `use*TableData` hook and test, and a contract checklist. The generated TODOs separate domain query/cursor behavior from representative shared-Table wiring and leave generic pagination mechanics with `useInfiniteListQuery`. Follow [Tables](components/tables/README.md).

## Calendar scaffold

The calendar command requires a PascalCase name ending in `Calendar`. It creates the required calendar component and test plus a contract checklist. Add a `use*CalendarData` hook only when loaded records need page-owned adaptation, an `*Item` owner only for meaningful domain presentation, and a browser story only when real browser behavior is in scope. Follow [Calendars](components/calendars/README.md).

## Dashboard scaffold

The dashboard command requires a PascalCase name ending in `Dashboard`. It creates the required dashboard component and test plus a contract checklist. Add `use*OverviewData` only for dashboard-owned remote data and add `*DashboardCard` owners only for meaningful card contracts. Follow [Dashboards](components/dashboards/README.md).

## Finish the scaffold

Generated placeholders compile but do not represent completed product behavior. Follow the linked owner guide, implement the checklist, remove obsolete TODOs, and run focused tests, builds, pattern checks, and `git diff --check`.
