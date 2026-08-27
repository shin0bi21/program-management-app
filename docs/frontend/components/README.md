# Frontend components

Components own rendered interfaces and user interactions. Start with the page guide when a route coordinates several components. Use this guide when changing a rendered surface or deciding whether to extract one.

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
| Page header and body regions | [Page structure](../pages/structure.md) |
| Remote tables and pagination | [Tables](tables/README.md) |
| Table rows and mutations | [Table rows](tables/rows.md) |
| Date ranges, calendar items and timeline views | [Calendars](calendars/README.md) |
| Summary cards and overview data | [Dashboards](dashboards/README.md) |
| Dialogs, floating menus and tooltips | [Overlays](overlays/README.md) |
| Modal forms and submission workflows | [Modals and forms](overlays/modals-and-forms.md) |

Buttons, inputs and other small primitives do not need separate guides unless they gain a substantial repository-specific contract. Their components and tests remain the closest source of truth.

## Keep component contracts focused

A component owns its rendering, accessibility and presentation-level interactions. A focused hook owns stateful policy, asynchronous transitions or coordinated callbacks. Keep one-off props and simple local state in the component.

Use a hook when behaviour needs restoration, derived state, effects, subscriptions, observers or asynchronous coordination. Do not create a hook only to rename a `useState` value.

Keep each component's test beside it. Test the rendered states, accessible controls and values the component emits. Test stateful policy in its owning hook and cross-component coordination in the route page.

Use Playwright when correctness depends on a real browser, including focus, portals, pointer geometry, scrolling or layout observers. The [testing guide](../../workflows/testing.md) explains runner selection.
