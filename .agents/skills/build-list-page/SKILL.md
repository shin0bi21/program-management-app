---
name: build-list-page
description: Implement or materially change this repository's React list and table pages using its standard page composition, persisted controls, responsive layout, table behavior, permissions, states, and tests. Use for new list views, adding a list/table view to an existing page, list dashboards or detail panels, and changes to list search, filters, sorting, column widths, selection, pagination, or mobile behavior.
---

# Build List Page

Use this skill with `implement-frontend`; this skill supplies the narrower list-page completion checklist.

## Load the contracts and patterns

1. Rely on `implement-frontend` for architecture and shared-component contracts; read the list-specific `Table` and `TableDetailLayout` contracts when applicable.
2. Inspect one strong list-page consumer that matches the requested shape. Inspect another only when the established pattern is ambiguous.
3. Identify which controls and table state are already supported by the user-preference schema before implementing.

## Compose the page

- Use one `main.page-container.page-container--data` and one `PageHeader`.
- Put primary actions, search, filters, and view switching in their named PageHeader slots.
- Use `Table`; use `TableDetailLayout` when row selection drives adjacent details.
- Keep list-only dashboards or summaries between PageHeader/status feedback and Table. Give dashboard groups an explicit bottom gap of `var(--space-6)`.
- Keep list behavior under the owning page and extract meaningful dashboard, detail, or interaction regions into focused components.

## Complete the interaction contract

- Provide durable row keys and stable declarative columns.
- Make an explicit selection decision. When selection is meaningful, use `useTableSelection` and wire `selectedKey` plus `onRowSelect` so pointer, keyboard, focus, and selection styling agree.
- Use `ActionsMenu` for multiple row actions and enforce permissions before exposing actions.
- Route supported sorting to the API. Do not silently client-sort remote paginated data.
- Preserve existing rows during refresh and use Table's `refreshing` state; reserve `loading` for an initial empty load.
- Handle initial loading, refreshing, empty, filtered-empty, error, retry, and next-page states with accurate user-facing messages.
- Keep request cancellation, pagination deduplication, and cache reconciliation explicit when the page owns them.

## Persist user-owned list state

Audit and persist every applicable durable control through `useUserPreference`:

- selected view;
- filters, excluding choices made redundant by the user's permissions;
- supported sorting;
- table column widths;
- other established page-specific display choices.

Restore preferences before issuing preference-dependent requests or rendering a misleading default. Treat a current/active resource as a first-visit fallback only; do not overwrite a saved choice. Update backend preference validation, types, and tests when the preference shape changes.

## Verify responsive behavior

- Use the shared `768px` mobile breakpoint unless an existing component contract specifies another threshold.
- Confirm PageHeader controls wrap and search becomes full-width through the shared component.
- Stack dashboard cards at the mobile breakpoint and check long titles plus actions at narrow widths.
- Preserve Table's horizontal scrolling instead of hiding columns or clipping page content ad hoc.
- Confirm dialogs use the shared Modal and fit within the mobile viewport.
- Use a browser test for geometry, overflow, sticky behavior, or focus behavior that jsdom cannot establish.

## Test the owning behavior

Add focused consumer tests for applicable behavior:

- search, filters, and view wiring;
- preference restoration and saving;
- permission-dependent controls and row actions;
- loading, error, retry, empty, and filtered-empty states;
- row focusability, keyboard selection, and selection-driven summaries/details;
- sorting, column-width persistence, and pagination wiring;
- dashboard/report actions and modal wiring.

For material page or interaction changes, review every applicable checklist section. For a localized visual or wiring change, verify the affected contract and likely regressions only. Run focused tests, the relevant composed frontend runner when warranted, frontend build, static checks, and `git diff --check`.
