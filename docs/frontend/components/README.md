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

Keep each component's test beside it. A component test owns its rendered states, accessible controls, controlled-prop wiring, and exact values it emits. A focused hook test owns the stateful policy or external lifecycle that justified the hook. Cross-component coordination belongs to the route page.

Lifecycle is conditional. A hook that installs an observer tests its options, callback guards, meaningful dependency changes, and cleanup. A badge that only renders a label and modifier tests those outputs; it does not need mount, rerender, and unmount tests.

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

Use `Checklist` for controlled lists of labeled choices. It shares the checkbox-row
appearance between forms and filters, accepting options, selected values, a toggle
callback, and a disabled state. Forms use native checkboxes; `inMenu` preserves menu
checkbox semantics and the floating menu's keyboard navigation. Callers own drafts,
single/multiple selection rules, loading/errors, and submission.

## Type and Status Labels

Badges are non-interactive labels. Use [Badge](../../../frontend/src/common/components/Badge/Badge.tsx)
for type labels and [StatusBadge](../../../frontend/src/common/components/StatusBadge/StatusBadge.tsx)
for supported lifecycle states. Domain components map records to labels and appearance;
the primitives do not derive business state. Pass authoritative labels through and use
only states the domain supports.

Share base typography, padding, casing, and radius. Keep domain palette classes separate,
and retain a readable label rather than communicating state through color alone. Dense
calendar rows may scope compact sizing to the positioned item; hover/focus details retain
the normal badge size. See [calendar details](calendars.md#present-item-details).

Primitive tests cover content and appearance classes; domain tests cover record-to-label
mapping. Consumers cover supplied values and placement without repeating primitive tests.
Use browser tests for clipping, density, and selection geometry.

## Scaffold a Rendered Surface

The table, calendar, dashboard, and modal presets generate implementation and colocated
test outlines together. Follow [Frontend Scaffolding](../pages/scaffolding.md) to compose a new
page and its component owners; each surface guide describes its specific contract.
