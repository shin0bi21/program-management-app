---
name: build-calendar-page
description: Build or materially change this repository's React resource-calendar pages using its standard page composition, period model, buffered loading, virtualization, overflow, drag-and-drop safety, persisted controls, responsive layout, permissions, and tests. Use for new calendar views, adding a calendar view to an existing page, changing ResourceCalendar consumers, or modifying calendar navigation, cells, items, overflow, data loading, mutations, drag/drop, or mobile behavior.
---

# Build Calendar Page

Use this skill with `implement-frontend`; this skill supplies the narrower calendar-page completion checklist.

## Load the contracts and patterns

1. Rely on `implement-frontend` for architecture and shared-component contracts.
2. For ResourceCalendar behavior, inspect the directly affected primitive files, types, period model, tests, story, and buffer adapter. For localized styling or consumer wiring, inspect only the relevant contract and consumer path.
3. Inspect the Timesheets calendar flow when changing buffering or mutations. Compare another consumer only when the established pattern is ambiguous.

## Model the calendar explicitly

- Define resource, item, and durable ID contracts before rendering.
- Choose the correct `PeriodDefinition` and buffer adapter. Preserve date-only values and use calendar arithmetic across month, year, leap-day, and daylight-saving boundaries.
- Keep `renderResource`, `buildItem`, overflow rendering, and item/cell callbacks typed through ResourceCalendar contexts.
- Use `maxVisibleItemsPerCell` plus an accessible overflow summary when cells can contain multiple items.
- Keep page-domain rendering and mutations outside the shared calendar primitive.

## Compose and persist the page

- Use one `main.page-container.page-container--data` and one `PageHeader`.
- Put primary actions, filters, and view switching in their named PageHeader slots.
- Give the calendar wrapper `flex: 1` and `min-height: 0` on fixed-height desktop data pages; preserve the shared mobile page flow at `768px`.
- Persist every applicable durable control through `useUserPreference`, including selected view and filters. Restore preferences before preference-dependent loading or rendering. Use active/current resources only as first-visit fallbacks.
- Hide redundant filters and actions according to permissions while preserving server-side authorization.

## Load and mutate safely

- Connect `onInitialPeriods`, `onPeriodsBuilt`, and `onPeriodsReset` to a focused `PeriodDataBuffer` hook when loading follows the visible window.
- Bound retained periods, serialize directional replenishment, expose retryable load errors, and prevent stale completions from clearing newer errors.
- Pass cancellation through API adapters where the lifecycle supports it.
- For create, update, move, and delete, preserve buffer overrides until server data confirms them. Prevent stale loads from resurrecting deleted items or reverting moves.
- Serialize repeated mutations of the same item and ignore stale responses by revision.
- Define `isItemDraggable`, `canDropItem`, and `onItemDrop` independently. Recheck permissions and domain constraints in the mutation path; UI eligibility is not authorization.
- Keep modal dismissal and submission behavior within the shared Modal contract.

## Verify interaction and responsive behavior

- Confirm toolbar navigation, Today, visible-period sizing, sticky resource/period headers, horizontal and vertical scrolling, and row virtualization.
- Confirm cell activation, item activation, overflow opening/closing, focus return, and keyboard access do not conflict.
- Confirm drag overlay geometry, edge scrolling, valid/invalid targets, same-item overlap, rollback, and click suppression after dragging.
- Check narrow viewports for usable toolbar wrapping, calendar height, horizontal scrolling, modal fit, and touch-sized actions. Do not hide resources or periods merely to avoid overflow.
- Use Playwright for geometry, scrolling, sticky positioning, virtualization, pointer drag/drop, focus, and mobile viewport behavior; jsdom cannot prove these contracts.

## Test the owning behavior

Add focused tests for applicable behavior:

- period/date calculations and API range mapping;
- initial, left, right, reset, retry, and out-of-order buffered loads;
- create, update, delete, move, rollback, and repeated same-item mutations;
- permissions, filter/view preference restoration, and first-visit defaults;
- item, cell, and overflow wiring;
- browser-level responsive sizing, scrolling, virtualization, focus, and drag/drop.

For material calendar behavior changes, review every applicable checklist section and run the ResourceCalendar browser suite. For localized visual or wiring changes, verify the affected contract and likely regressions only. Run focused unit tests, the relevant composed frontend runner when warranted, frontend build, static checks, and `git diff --check`.
