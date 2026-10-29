# Frontend scaffolding

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

Collection pages use the five behavior groups in the [page guide](pages/README.md#test-page-coordination).
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
Connect the generated calendar to the page when implementing the feature; the
component preset does not edit its parent or register a route.

Append `--dry-run` to preview either command without writing files. Every preset
refuses to overwrite existing files. Add table, dashboard, or modal presets only
when the new page needs those owners; each includes its own test outlines.

Generated `it.todo` cases are ownership prompts, not completed coverage. Replace
the relevant prompts with scenario fixtures and observable assertions; remove
inapplicable cases. Use the shared QueryClient helpers for query-backed tests.
Use the [testing guide](../workflows/testing.md) for runner selection.
See each [frontend owner guide](README.md#find-the-right-guide) for
the supported source layout and preset commands.
