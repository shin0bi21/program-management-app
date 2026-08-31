# Frontend scaffolding

Use the frontend scaffolder to create the required files for a route page or an established page-owned surface. It formats TypeScript with ts-morph, previews planned paths, validates destinations, and refuses to overwrite files. Generated source and `it.todo` cases are explicit implementation placeholders, not completed product behavior.

The scaffolder creates only the selected owner's required files. Add optional CSS, API adapters, types, hooks, nested components, stories, and utilities only when the owner needs them. Start with [Frontend](README.md) to choose the owner and [Testing](../workflows/testing.md#frontend-test-ownership) to place its tests.

## Commands

```bash
npm run scaffold:frontend -- page Leads --dry-run
npm run scaffold:frontend -- page Staff/Schedules --dry-run
npm run scaffold:frontend -- modal frontend/src/pages/Staff/Schedules/components ScheduleModal --dry-run
npm run scaffold:frontend -- table frontend/src/pages/Staff/Schedules/components ScheduleTable --dry-run
npm run scaffold:frontend -- calendar frontend/src/pages/Staff/Schedules/components ScheduleCalendar --dry-run
npm run scaffold:frontend -- dashboard frontend/src/pages/Staff/Schedules/components ScheduleDashboard --dry-run
```

Remove `--dry-run` to write the displayed files.

## Choose a preset

| Preset | Destination and output | Follow next |
|---|---|---|
| `page <PagePath>` | Accepts `Page` or `RouteFamily/Page`; creates the route component and colocated test. | [Pages](pages/README.md) |
| `modal <owner-path> <NameModal>` | Creates a non-trivial form-modal component, workflow hook, and their colocated tests inside a page, page-family common, or common-feature component owner. Use a focused component instead when no workflow hook is justified. | [Modals and forms](components/overlays/modals-and-forms.md) |
| `table <page-components-path> <NameTable>` | Creates a remote page-table component, table-data hook, and their colocated tests under a root or route-family page's direct `components/` directory. | [Tables](components/tables/README.md) |
| `calendar <page-components-path> <NameCalendar>` | Creates the required page-calendar component and colocated test. Add a data hook, item owner, story, and browser test only when their contracts apply. | [Calendars](components/calendars/README.md) |
| `dashboard <page-components-path> <NameDashboard>` | Creates the required page-dashboard component and colocated test. Add overview-data and card owners only when they own meaningful behavior. | [Dashboards](components/dashboards/README.md) |

Names use PascalCase and the component presets require their documented suffix. Owner paths are repository-relative and must stay inside an allowed frontend owner.

## Finish the owner

Replace source TODOs and every `it.todo` with the behavior required by the linked owner guide. Remove placeholders the owner does not need, then run the focused frontend test, build, pattern, and diff checks described in [Testing](../workflows/testing.md).
