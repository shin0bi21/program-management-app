# Common Components

This directory contains reusable React UI and interaction primitives shared across page families.

Put a component here when it is not owned by one business workflow and can be configured through props. Components that understand concepts such as youth, cohorts, attendance, or notes belong in `common/features/`; components used by only one route family stay with that page.

Common components may use other common UI and helpers as well as the root technical subsystems. They must not import from `pages/` or `common/features/`.

For non-trivial components, use a component folder and colocate its styles, internal components, hooks, utilities, and tests. Keep data fetching outside presentational components unless fetching is part of the component's explicit infrastructure responsibility.

Read a component folder's `README.md` before adding or changing a consumer. These files define integration requirements that TypeScript cannot enforce, such as async dismissal behavior, table state ownership, page-control composition, and calendar interaction mechanics. See [`Modal/README.md`](Modal/README.md), [`Table/README.md`](Table/README.md), [`PageHeader/README.md`](PageHeader/README.md), [`PageBody/README.md`](PageBody/README.md), and [`ResourceCalendar/README.md`](ResourceCalendar/README.md).

See [`../../../../docs/architecture/frontend.md`](../../../../docs/architecture/frontend.md) for the complete frontend ownership rules.
