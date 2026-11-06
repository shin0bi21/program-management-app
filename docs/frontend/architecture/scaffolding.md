# Frontend Scaffolding

Run `npm run scaffold:frontend` from the repository root. The generator and its
tests live under `scripts/scaffold/frontend/`.
The `page` preset follows the [PageContainer contract](../components/page-container.md)
for authenticated collection routes.

## Maintain the Pattern

Templates implement the contracts in the focused owner guides. When a contract
changes, update its template and generated examples together. Follow
[Ownership](ownership.md) for source placement.

## Choose a Preset

| Preset | Generated files |
|---|---|
| `page` | Route component, page-data hook, and their tests |
| `table` | Table component, collection-data hook, and their tests |
| `modal` | Form component, workflow hook, and their tests |
| `calendar` | Calendar component and its test |
| `dashboard` | Dashboard component and its test |

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

The calendar preset supplies ordered implementation prompts matching the
[page calendar standard](../components/calendars.md#order-the-page-calendar-owner).
It remains a skeleton rather than inventing domain APIs, permission rules, or
record types.
Replace applicable prompts with real code and remove phases the owner does not need.

Append `--dry-run` to preview either command without writing files. Every preset
refuses to overwrite existing files. Add table, dashboard, or modal presets only
when the new page needs those owners.

Generated `it.todo` cases are ownership prompts, not completed coverage. Replace
the relevant prompts with scenario fixtures and observable assertions; remove
inapplicable cases and delete the test file when the owner adds no behavior.
See each [frontend owner guide](../README.md#find-the-right-guide) for
the supported source layout and preset commands.

## Scaffold a Page

Preview an authenticated collection page at the root or within a route family:

```bash
npm run scaffold:frontend -- page Leads --dry-run
npm run scaffold:frontend -- page Staff/Schedules --dry-run
```

Remove `--dry-run` to generate the files.

The page preset calls its data hook during the page-data phase. Replace the data
placeholders with real reference queries; omit the hook and its test when the page
needs no page-wide remote data.
