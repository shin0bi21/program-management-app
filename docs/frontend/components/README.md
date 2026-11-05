# UI Basics

Components own rendered interfaces and user interactions. Start with the page guide when a route coordinates several components. Use this guide when changing a rendered surface or deciding whether to extract one.

## Keep Component and Test Contracts Focused

A component owns its rendering, accessibility and presentation-level interactions. A focused hook owns stateful policy, asynchronous transitions or coordinated callbacks. Keep one-off props and simple local state in the component.

Use a hook when behaviour needs restoration, derived state, effects, subscriptions, observers or asynchronous coordination. Do not create a hook only to rename a `useState` value.

Keep a multi-step interaction workflow together in its owning hook, including event guards, transitions, completion, cancellation, and cleanup. Components render the affordances and forward events through small adapters; simple presentation handlers and pure helpers can remain in the component. Separate unrelated interaction lifecycles instead of collecting every event in one interactions hook.

Follow the [ownership guide](../architecture/ownership.md) for where each hook lives.

Comments explain constraints, ordering, or effects that the types cannot express.
Keep executable examples and relevant boundary cases in colocated tests; component-private
helpers can be verified through their owner's behavior. Place helpers below the component
in the order their callers use them.

Keep component tests beside their owner when it has behavior to verify. Test state
transitions, user interactions, accessibility behavior, conditional domain outcomes,
and emitted values. Presentation-only wrappers do not need a test that repeats their
markup or supplied options. A focused hook test owns the stateful policy or external
lifecycle that justified the hook. Cross-component coordination belongs to the route page.

Lifecycle is conditional. A hook that installs an observer tests callback guards,
meaningful dependency changes, and cleanup. A label that only renders a supplied
label and modifier does not need a dedicated test.

A click can appear at a child and its consumer only when the assertions differ. For example, an action component proves that clicking Delete emits `onDelete(record)`. The route may invoke that public callback to prove that confirmation reaches its mutation workflow; it does not repeat how the child opens, dismisses, or manages focus.

Use jsdom for semantic focus and keyboard interactions it can observe. Use Playwright when correctness depends on real focus geometry, portals, pointer geometry, scrolling or layout observers. The [testing guide](../../workflows/delivery/testing.md) explains runner selection.

For render-sensitive surfaces, trace which components rerender during scrolling, pointer movement, filtering, selection, and mutations. Keep transient values that do not affect the visible UI in refs. Preserve references for unaffected rows and cells; use memoization only when stable inputs prevent meaningful work. Check virtualization at the largest supported viewport and use targeted render-count or browser evidence when performance is part of the contract. Functional tests alone do not establish render performance.

For listeners, observers, timers, subscriptions, and external instances, identify the component that owns each lifecycle. Setup and cleanup must be symmetric across completion, cancellation, dependency changes, and unmount. Keep instance-specific behavior with its instance; coordinate global registrations at the narrowest shared owner when multiple instances can mount.

<a id="extract-a-focused-owner"></a>

## Choose a Component Owner

Use [Frontend Ownership](../architecture/ownership.md#choose-the-narrowest-owner) for placement
and promotion. Extract a component when a rendered region has a clear name and an independent
contract; do not add a wrapper or hook merely to shorten its parent.

## Follow the Rendered Surface

| Surface | Guide |
|---|---|
| Type and status labels | [Type and Status Labels](#type-and-status-labels) |
| Application sidebar and route navigation | [App Navigation](navigation.md) |
| Page header and body regions | [Pages](../pages/composition.md#compose-page-components) |
| Remote tables and pagination | [Tables](tables.md) |
| Table rows and mutations | [Table Rows](table-rows.md) |
| Date ranges, calendar items and timeline views | [Calendars](calendars.md) |
| Summary cards and overview data | [Dashboards](dashboards.md) |
| Page-level messages and retry actions | [Message Overlays](message-overlays.md) |
| Dialogs, floating menus and tooltips | [Overlays](overlays.md) |
| Modal forms and submission workflows | [Modals and Forms](modals-and-forms.md) |

Buttons, inputs and other small primitives do not need separate guides unless they gain a substantial repository-specific contract. Their components and tests remain the closest source of truth.

## Checklists

Use `Checklist` for controlled lists of labeled choices, accepting options, selected
values, a toggle callback, and a disabled state. Use `variant="form"` in forms for
native accent-colored checkboxes, a rounded border, row dividers, and roomier spacing.
Form checklists cap only their scrolling items area at 400px; search stays above
that area. The checklist shrinks within a height-constrained container. Use a
caller class through `className` to override the items limit when required.
Enable `search` to place an immediate, case-insensitive label substring search
above the separately scrolling items. Enable `dynamicItems` to reveal the supplied
options in batches of 25 as the user scrolls or focuses the last revealed choice.
Both are opt-in; dynamic mode also caps the compact items area at 400px. Search filters
the complete supplied options array before batching, resets the scroll position
and batch, and never clears selected values. These are client-side behaviors;
callers still own fetching the options. A searchable checklist in a floating
surface needs the shared overlay's form keyboard mode and native checkbox
semantics so typing and Tab navigation remain available.
The default `compact` appearance serves filters; `inMenu` preserves menu checkbox
semantics and the floating menu's keyboard navigation. Appearance does not select
interaction semantics. Callers own drafts, single/multiple selection rules,
loading/errors/empty states, and submission. Wrap a form checklist in `FormFieldGroup`
for its visible title, native fieldset/legend, and standard form-label spacing.
React Hook Form consumers connect array fields through `Controller`.

## Type and Status Labels

Labels are non-interactive. Use [Label](../../../frontend/src/common/components/Label/Label.tsx)
for shared typography, padding, casing, and radius. Its optional `tone` selects a
fixed semantic palette: `positive` (green), `negative` (red), `neutral` (gray),
`attention` (amber), or `info` (blue). Keep a readable label rather than
communicating meaning through color alone.

[StatusLabel](../../../frontend/src/common/components/StatusLabel/StatusLabel.tsx)
maps supported lifecycle states to those tones: Active and Completed are positive,
In Progress is attention, Upcoming is info, Overdue is negative, and Inactive and
Cancelled are neutral. Domain owners may use `Label` directly for different
semantics, such as a negative Inactive youth/account label. Task `in_progress` is
derived from an open task's date window; keep it distinct from stored `open` state.

Type/category labels retain domain-owned palettes and compose `Label` without a
semantic tone: `HoursTypeLabel`, `SessionTypeLabel`, and `NoteCategoryLabel` own
those mappings. A task hours type is a category, not an attention status. Do not
put page-specific type values into `StatusLabel` or introduce numbered type colors
until a shared categorical palette is agreed.

Dense calendar rows may scope compact sizing to the positioned item; hover/focus
details retain the normal label size. See [calendar details](calendars.md#present-item-details).

Test nontrivial domain derivations and conditional outcomes at their owner. Do not
enumerate static label-to-class maps or repeat a child's presentation in consumers.
Use browser tests for clipping, density, and selection geometry.

## Scaffold a Rendered Surface

The table, calendar, dashboard, and modal presets generate implementation and colocated
test outlines together. Follow [Frontend Scaffolding](../pages/scaffolding.md) to compose a new
page and its component owners; each surface guide describes its specific contract.
