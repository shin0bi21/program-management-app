# Frontend Scaffolding

Run the preset commands below from the repository root. The generator and its
tests live under `scripts/scaffold/frontend/`.
The `page` preset follows [PageContainer](../../../frontend/src/common/components/PageContainer/PageContainer.tsx)
for authenticated collection routes.

## Maintain the Pattern

Templates follow the source owners' contracts. When a contract changes, update
its source documentation, template, and generated examples together. Follow
[Ownership](ownership.md) for source placement.

## Choose a Preset

| Command after `npm run scaffold:frontend --` | Generated files |
|---|---|
| `page <PagePath>` | Route component, page-data hook, and their tests |
| `table <owner-path> <NameTable>` | Table component, collection-data hook, and their tests |
| `modal <owner-path> <NameModal>` | Form component, workflow hook, and their tests |
| `calendar <owner-path> <NameCalendar>` | Calendar component and its test |
| `dashboard <owner-path> <NameDashboard>` | Dashboard component and its test |

Page paths contain a PascalCase page name, optionally preceded by one PascalCase
route family. Component names use PascalCase with a domain prefix and the suffix
shown above. Owner paths are relative to the repository root:

- Tables, calendars, and dashboards use a root or route-family page's `components/` directory.
- Modals also accept nested component owners, a route family's `common/components/`,
  `frontend/src/common/features`, or a feature's `components/` directory and its nested component owners.

Optional presentation hooks, row/action components, and browser stories are added
beside their real owners when needed; presets do not invent them for every page.

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

Connect the generated calendar to the page when implementing the feature; the
component preset does not edit its parent or register a route.

The calendar preset supplies ordered implementation prompts for range loading,
buffer setup, error reporting, cache synchronization, display data, and interactions.
It remains a skeleton rather than inventing domain APIs, permission rules, or
record types.
Replace applicable prompts with real code and remove phases the owner does not need.

Append `--dry-run` to preview either command without writing files. Every preset
refuses to overwrite existing files. Add table, dashboard, or modal presets only
when the new page needs those owners.

Generated `it.todo` cases are ownership prompts, not completed coverage. Replace
the relevant prompts with scenario fixtures and observable assertions; remove
inapplicable cases and delete the test file when the owner adds no behavior.
Document implemented functions with their actual parameter meanings and examples,
following the [design recipe](../../workflows/documentation.md). Keep shared component
behavior with its [source owner](../README.md#find-a-component).

## Scaffold a Page

Preview an authenticated collection page at the root or within a route family:

```bash
npm run scaffold:frontend -- page Leads --dry-run
npm run scaffold:frontend -- page Staff/Schedules --dry-run
```

Remove `--dry-run` to generate the files.

The page preset calls its data hook during the page-data phase. Replace the data
placeholders with real reference queries; omit the hook and its test when the page
needs no page-wide reference data.
