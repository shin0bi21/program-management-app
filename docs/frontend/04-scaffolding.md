# Scaffolding

Run commands from the repository root with the local Node dependencies installed.
The generator and its tests live in `scripts/scaffold/frontend/`.

## Choose a Preset

Choose the [owner](01-ownership.md) before generating files.
The `page` preset targets authenticated collection routes using
[PageContainer](../../frontend/src/common/components/PageContainer/PageContainer.tsx).

| Command after `npm run scaffold:frontend --` | Generated files |
|---|---|
| `page <PagePath>` | Route component, page-data hook, and their tests |
| `table <owner-path> <NameTable>` | Table component, collection-data hook, and their tests |
| `modal <owner-path> <NameModal>` | Form component, workflow hook, and their tests |
| `calendar <owner-path> <NameCalendar>` | Calendar component and its test |
| `dashboard <owner-path> <NameDashboard>` | Dashboard component and its test |

### Path and Name Requirements

- Page paths contain a PascalCase page name, optionally preceded by one PascalCase route family.
- Component names use PascalCase with a domain prefix and the suffix shown above.
- Owner paths are relative to the repository root.
- Tables, calendars, and dashboards accept a root or route-family page's `components/` directory.
- Modals also accept nested component owners, a route family's `common/components/`, `frontend/src/common/features`, or a feature's `components/` directory and its nested component owners.

## Scaffold a Page

1. Preview a root or route-family page:

   ```bash
   npm run scaffold:frontend -- page Leads --dry-run
   npm run scaffold:frontend -- page Staff/Schedules --dry-run
   ```

2. Check the listed paths, then remove `--dry-run` to generate the files.
3. Replace reference-query placeholders in the page-data hook. Remove the hook and its test if no page-wide reference data is needed.
4. Add table, calendar, dashboard, or modal presets only as needed.
5. Connect generated components to their parent and register the route; presets do neither.

Every preset refuses to overwrite existing files. If a destination exists, choose a new name or edit the existing owner.

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

1. Replace applicable prompts with domain APIs, permission rules, and record types; remove unused phases.
2. For calendars, complete the range-loading, buffer, error, cache, display, and interaction prompts.
3. Add optional presentation hooks, row/action components, and browser stories only when needed, following [Ownership](01-ownership.md).
4. Complete generated `it.todo` outlines following [Testing](../workflows/delivery/testing.md#scaffold-implementation-and-tests-together).
5. Document completed functions using the [design recipe](../workflows/documentation.md).

## Maintain the Pattern

When a source contract changes, update its source documentation, scaffold template,
and generated examples together. Use the [component source map](README.md#find-a-component)
to find the owning contract.
