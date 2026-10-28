# Frontend components

Components own rendered interfaces and user interactions. Start with the page guide when a route coordinates several components. Use this guide when changing a rendered surface or deciding whether to extract one.

## Keep component and test contracts focused

A component owns its rendering, accessibility and presentation-level interactions. A focused hook owns stateful policy, asynchronous transitions or coordinated callbacks. Keep one-off props and simple local state in the component.

Use a hook when behaviour needs restoration, derived state, effects, subscriptions, observers or asynchronous coordination. Do not create a hook only to rename a `useState` value.

Keep a multi-step interaction workflow together in its owning hook, including event guards, transitions, completion, cancellation, and cleanup. Components render the affordances and forward events through small adapters; simple presentation handlers and pure helpers can remain in the component. Separate unrelated interaction lifecycles instead of collecting every event in one interactions hook.

Follow the [ownership guide](../architecture/ownership.md) for where each hook lives.

Keep each component's test beside it. A component test owns its rendered states, accessible controls, controlled-prop wiring, and exact values it emits. A focused hook test owns the stateful policy or external lifecycle that justified the hook. Cross-component coordination belongs to the route page.

Lifecycle is conditional. A hook that installs an observer tests its options, callback guards, meaningful dependency changes, and cleanup. A badge that only renders a label and modifier tests those outputs; it does not need mount, rerender, and unmount tests.

A click can appear at a child and its consumer only when the assertions differ. For example, an action component proves that clicking Delete emits `onDelete(record)`. The route may invoke that public callback to prove that confirmation reaches its mutation workflow; it does not repeat how the child opens, dismisses, or manages focus.

Use jsdom for semantic focus and keyboard interactions it can observe. Use Playwright when correctness depends on real focus geometry, portals, pointer geometry, scrolling or layout observers. The [testing guide](../../workflows/testing.md) explains runner selection.

For render-sensitive surfaces, trace which components rerender during scrolling, pointer movement, filtering, selection, and mutations. Keep transient values that do not affect the visible UI in refs. Preserve references for unaffected rows and cells; use memoization only when stable inputs prevent meaningful work. Check virtualization at the largest supported viewport and use targeted render-count or browser evidence when performance is part of the contract. Functional tests alone do not establish render performance.

For listeners, observers, timers, subscriptions, and external instances, identify the component that owns each lifecycle. Setup and cleanup must be symmetric across completion, cancellation, dependency changes, and unmount. Keep instance-specific behavior with its instance; coordinate global registrations at the narrowest shared owner when multiple instances can mount.

## Choose a component owner

Keep a component with the narrowest owner that can describe its full behaviour:

| Component | Location |
|---|---|
| Used by one page | That page's `components/` directory |
| Used by sibling routes in one route family | The route family's `common/` directory |
| Business-aware and used by several route families | `common/features/` |
| Independent of product language and business rules | `common/components/` |

Extract a component when a rendered region has a clear name and an independent contract. Do not extract a one-line wrapper only to shorten its parent.

## Follow the rendered surface

| Surface | Guide |
|---|---|
| Application sidebar and route navigation | [App navigation](navigation.md) |
| Page header and body regions | [Pages](../pages/README.md#compose-page-components) |
| Remote tables and pagination | [Tables](tables.md) |
| Table rows and mutations | [Table rows](table-rows.md) |
| Date ranges, calendar items and timeline views | [Calendars](calendars.md) |
| Summary cards and overview data | [Dashboards](dashboards.md) |
| Dialogs, floating menus and tooltips | [Overlays](overlays.md) |
| Modal forms and submission workflows | [Modals and forms](modals-and-forms.md) |

Buttons, inputs and other small primitives do not need separate guides unless they gain a substantial repository-specific contract. Their components and tests remain the closest source of truth.
