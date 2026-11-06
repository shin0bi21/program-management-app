# UI Basics

Components own rendered interfaces and user interactions. Use [PageContainer](page-container.md) when a route coordinates collection components. Use this guide when changing a rendered surface or deciding whether to extract one.

## Keep Component Contracts Focused

A component owns its rendering, accessibility and presentation-level interactions. A focused hook owns stateful policy, asynchronous transitions or coordinated callbacks. Keep one-off props and simple local state in the component.

Use a hook when behaviour needs restoration, derived state, effects, subscriptions, observers or asynchronous coordination. Do not create a hook only to rename a `useState` value.

Keep a multi-step interaction workflow together in its owning hook, including event guards, transitions, completion, cancellation, and cleanup. Components render the affordances and forward events through small adapters; simple presentation handlers and pure helpers can remain in the component. Separate unrelated interaction lifecycles instead of collecting every event in one interactions hook.

Follow the [ownership guide](../architecture/ownership.md) for where each hook lives.

Comments explain constraints, ordering, or effects that the types cannot express.
Place helpers below the component in the order their callers use them.

For render-sensitive surfaces, trace which components rerender during scrolling, pointer movement, filtering, selection, and mutations. Keep transient values that do not affect the visible UI in refs. Preserve references for unaffected rows and cells; use memoization only when stable inputs prevent meaningful work.

For listeners, observers, timers, subscriptions, and external instances, identify the component that owns each lifecycle. Setup and cleanup must be symmetric across completion, cancellation, dependency changes, and unmount. Keep instance-specific behavior with its instance; coordinate global registrations at the narrowest shared owner when multiple instances can mount.

<a id="extract-a-focused-owner"></a>

## Choose a Component Owner

Use [Frontend Ownership](../architecture/ownership.md#choose-the-narrowest-owner) for placement
and promotion. Extract a component when a rendered region has a clear name and an independent
contract; do not add a wrapper or hook merely to shorten its parent.

## Follow the Rendered Surface

| Surface | Guide |
|---|---|
| Collection shell and route assembly | [PageContainer](page-container.md) |
| Header actions and controls | [PageHeader and Controls](page-container.md#pageheader-and-controls) |
| Page-level messages and retry actions | [Message Overlays](message-overlays.md) |
| Readiness, dashboard region, and active view | [PageBody](page-container.md#readiness-and-pagebody) |
| Summary cards and overview data | [Dashboards](dashboards.md) |
| Remote tables and pagination | [Tables](tables.md) |
| Table rows and mutations | [Table Rows](table-rows.md) |
| Date ranges, calendar items and timeline views | [Calendars](calendars.md) |
| Dialogs, floating menus and tooltips | [Overlays](overlays.md) |
| Modal forms and submission workflows | [Modals and Forms](modals-and-forms.md) |
| Type and status labels | [Type and Status Labels](#type-and-status-labels) |
| Application sidebar and route navigation | [App Navigation](navigation.md) |

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
loading/errors/empty states, and submission. A visible title is optional. When
useful, wrap a form checklist in
`FormFieldGroup` for its title, native fieldset/legend, and standard label spacing.
Keep the Checklist accessible name even when no visible title is shown.
React Hook Form consumers connect array fields through `Controller`.

## Searching Loaded Choices

`SearchInput` accepts controlled `value`, `onChange`, and `onClear`. Supply `onApply`
when a separate Search action is needed; otherwise changes take effect as the user
types. `appliedValue` keeps Clear available when an applied search differs from the
current text. The shared input owns styling and clear-button focus return; callers
own spacing within their layout. `useOptionSearch` owns search text and
case-insensitive substring filtering of supplied option labels, preserving each option's data. Checklist filters
before batching. Callers still own data fetching, loading, and selected values.

Enable `search` on `FloatingSelect` for a searchable single-choice popup. Its input
uses combobox/listbox semantics inside the shared form-mode floating dialog. Arrow
keys highlight choices, Enter selects an existing option, and Escape dismisses with
focus return. Typing alone never changes the controlled value. Closing discards search
and navigation state; reopening highlights the current selection. Option actions
appear below the list for the highlighted choice, outside the listbox; Tab reaches
Clear and action buttons. Without `search`, existing menu behavior is preserved.
Keep navigation and selection lifecycle with each control rather than the shared
filter. Future list virtualization belongs after filtering at the list owner.

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

## Scaffold a Rendered Surface

The table, calendar, dashboard, and modal presets generate implementation and colocated
test outlines together. Follow [Frontend Scaffolding](../architecture/scaffolding.md) to compose a new
page and its component owners; each surface guide describes its specific contract.
