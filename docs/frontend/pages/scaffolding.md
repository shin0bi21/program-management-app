# Frontend Scaffolding

`npm run scaffold:frontend` generates colocated test outlines alongside each
implementation owner automatically; no separate test command or flag is needed.
The `page` preset starts an authenticated collection page with controls, a dashboard,
and a table or calendar. Informational, authentication, and public pages follow their
existing route owners; do not add empty collection regions to fit this preset.

The presets keep source and test ownership aligned:

| Preset | Implementation and test owners |
|---|---|
| `page` | Route composition plus a separate page-data hook suite |
| `table` | Domain table configuration plus a separate collection-data hook suite |
| `modal` | Form rendering/event wiring plus a separate workflow hook suite |
| `calendar` | Domain calendar adapter and its component suite |
| `dashboard` | Card composition and its component suite |

Collection pages use the five behavior groups in the [page guide](testing.md#test-page-coordination).
Component and hook suites follow their own contracts, rather than repeating the
page groups or the implementation's statement order. Optional presentation hooks,
row/action components, and browser stories are added beside their real owners
when needed; these presets do not invent them for every page.

For a new calendar page, scaffold the route and its calendar component:

```bash
npm run scaffold:frontend -- page Youth/Placements
npm run scaffold:frontend -- calendar frontend/src/pages/Youth/Placements/components PlacementCalendar
```

These commands generate the following paired owners:

```text
pages/Youth/Placements/
  Placements.tsx
  Placements.test.tsx
  hooks/data/
    usePlacementsData.ts
    usePlacementsData.test.ts
  components/PlacementCalendar/
    PlacementCalendar.tsx
    PlacementCalendar.test.tsx
```

The page suite covers filters, selection, and dialog coordination. The page-data
suite covers its reference queries. The calendar suite covers domain range inputs,
item mapping, and callback wiring; shared calendar mechanics stay in shared suites.
When adding saved controls, follow the [preference readiness gate](preferences.md#expose-page-controls),
including search. The page scaffold prompts for pending-control behavior and the
first search save preserving restored sibling filters.
Connect the generated calendar to the page when implementing the feature; the
component preset does not edit its parent or register a route.

The calendar preset supplies ordered implementation prompts matching the
[page calendar standard](../components/calendars.md#order-the-page-calendar-owner):
range loading, buffer setup, error reporting, cache synchronization, display data,
rendering/interactions, unavailable state, then grouped calendar JSX. It remains a
skeleton rather than inventing domain APIs, permission rules, or record types.
Replace applicable prompts with real code and remove phases the owner does not need.

Append `--dry-run` to preview either command without writing files. Every preset
refuses to overwrite existing files. Add table, dashboard, or modal presets only
when the new page needs those owners; each includes its own test outlines.

Generated `it.todo` cases are ownership prompts, not completed coverage. Replace
the relevant prompts with scenario fixtures and observable assertions; remove
inapplicable cases and delete the test file when the owner adds no behavior.
Do not turn outlines into checks of static options, classes, or copied props.
Use the shared QueryClient helpers for query-backed tests.
Use the [testing guide](../../workflows/delivery/testing.md) for runner selection.
See each [frontend owner guide](../README.md#find-the-right-guide) for
the supported source layout and preset commands.

## Scaffold a Page

Preview an authenticated collection page at the root or within a route family:

```bash
npm run scaffold:frontend -- page Leads --dry-run
npm run scaffold:frontend -- page Staff/Schedules --dry-run
```

Remove `--dry-run` to generate the skeleton below.

Tests are generated automatically. The calendar-page example above combines page
and component presets with separate test owners.

The page preset generates the route and its test plus `hooks/data/use<Page>Data.ts` and
its test, and calls the data hook during the page-data phase. Replace the data placeholders
with real reference queries; omit the hook and its test when the page needs no page-wide
remote data.

Keep the route entry, its test and optional route styles at the page root. Follow
[Components](../components/README.md), [State and Data](../architecture/state-and-data.md), and
[Frontend Ownership](../architecture/ownership.md) for child directories, hooks and shared
code. Colocate each test with its owner.

The generated route follows this DOM skeleton:

```text
application shell
├── app navigation
└── route page
    ├── main.page-container
    │   ├── PageHeader
    │   │   ├── actions
    │   │   ├── columns and view controls
    │   │   ├── filters
    │   │   └── search
    │   ├── PageMessageOverlay
    │   └── PageBody
    │       ├── dashboard or summary
    │       └── table, calendar or timeline
    └── overlays
        ├── modal or dialog
        └── floating menu or tooltip
```
