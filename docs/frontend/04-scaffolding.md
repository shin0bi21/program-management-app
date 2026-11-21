# Scaffolding

Run commands from the repository root with the local Node dependencies installed.
The generator lives in `scripts/scaffold/frontend/`.

## Choose a Preset

Choose the [owner](01-ownership.md) before generating files.
The `page` preset targets authenticated collection routes using
[PageContainer](../../frontend/src/common/components/PageContainer/PageContainer.tsx).

| Command after `npm run scaffold:frontend --` | Generated files |
|---|---|
| `page <PagePath>` | Route component, reference-data owner, and their test outlines |
| `table <owner-path> <NameTable>` | Table component, component-owned table-data hook, and their tests |
| `modal <owner-path> <NameModal>` | Form component, workflow hook, and their tests |
| `calendar <owner-path> <NameCalendar>` | Calendar range/buffer adapter and its test |
| `dashboard <owner-path> <NameDashboardCard>` | Dashboard card and its test |

Compose independent dashboard cards directly in `PageContainer`'s `dashboard`
slot. Use the `dashboard` preset for a page-owned card. Add a shared owner
only when cards share queries or require coordination. Layout grouping, reporting
dates, and individual card action rules belong to `PageContainer` or the cards.
Descendants report page feedback through `usePageMessageReporter`;
keep page-owned failures in the container's `messages` prop. See the source
contracts linked from the frontend overview for reporting inputs and lifecycle.

### Path and Name Requirements

- Page paths contain a PascalCase page name, optionally preceded by one PascalCase route family.
- Component names use PascalCase with a domain prefix and the suffix shown above.
- Owner paths are relative to the repository root.
- Tables, calendars, and dashboard cards accept a root or route-family page's `components/` directory.
- Modals also accept nested component owners, a route family's `common/components/`, `frontend/src/common/features`, or a feature's `components/` directory and its nested component owners.

## Scaffold a Page

1. Preview a root or route-family page:

   ```bash
   npm run scaffold:frontend -- page Leads --dry-run
   npm run scaffold:frontend -- page Staff/Schedules --dry-run
   ```

2. Check the listed paths, then remove `--dry-run` to generate the files.
3. Compose required page-wide reference lookups in `hooks/data/use<Domain>Data.ts`, including their loading and error states. Remove the outline if the page does not need shared references.
4. Pass required reference context down to views and dashboard cards. Descendant data hooks own their ordinary query results and consume supplied references instead of repeating page reference queries.
5. Add table, calendar, dashboard, or modal presets only as needed.
6. Connect generated components to their parent and register the route; presets do neither.

The route calls the page data hook and configures `PageContainer`'s header,
messages, optional dashboard, and table or calendar. Pass cards directly to the
dashboard slot and keep page-wide controls, selection, and coordination in the
route or its hooks. Follow the [page data flow](02-state-and-data.md#page-data-flow)
and [page controls](03-preferences.md#expose-page-controls) contracts when completing it.

Every preset refuses to overwrite existing files. If a destination exists, choose a new name or edit the existing owner.

Preview a card with `npm run scaffold:frontend -- dashboard frontend/src/pages/Staff/Schedules/components ScheduleDashboardCard --dry-run`. Remove `--dry-run` to create the card and its test outline.

### Add a Calendar

Preview both owners, then remove `--dry-run` to generate them:

```bash
npm run scaffold:frontend -- page Youth/Placements --dry-run
npm run scaffold:frontend -- calendar frontend/src/pages/Youth/Placements/components PlacementCalendar --dry-run
```

Expected structure:

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

## Complete Generated Outlines

1. Replace applicable prompts with domain APIs, permission rules, and record types; remove unused phases. Page preference/control hooks expose typed `appliedFilters`, including saved search when present, for direct consumption by views. Follow the [page controls contract](03-preferences.md#expose-page-controls); keep derived calendar bounds in that owner and request restoration gated by `ready`.
2. Implement table requests in the component's `hooks/use<Domain>TableData` hook using the supplied page context. Keep the calendar range adapter and buffer with its component, extracting a private data hook when needed. Keep complete API rows in table query results and calendar buffers. Use existing cursor-list helpers for saved/deleted rows and show the shared out-of-order message with Refresh when edits leave loaded rows out of order. Invalidate membership and related queries when their data needs reloading.
3. Pass selected IDs to dashboard cards for their focused summary or child queries. Resolve dashboard-only defaults and action policy in the dashboard owner, independently of collection filters; keep selection shared with tables, calendars, or forms at their common owner. Supply already loaded display fields as props when needed. Add a private `use<Domain>DashboardData` only when sibling cards share a query; private card queries stay with their card.
4. Add optional presentation hooks, row/action components, and browser stories only when needed, following [Ownership](01-ownership.md).
5. Keep generated `it.todo` outlines only for behavior the feature owns, following [Test Ownership](../workflows/delivery/testing.md#test-ownership).
6. Document completed functions using the [design recipe](../coding-standards/documentation.md).

## Maintain the Pattern

When a source contract changes, update its source documentation, scaffold template,
and generated examples together. Use the [component source map](README.md#find-a-component)
to find the owning contract.
