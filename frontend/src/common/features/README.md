# Common Features

This directory contains business-aware capabilities shared across multiple page families.

Put code here when it understands domain concepts such as youth, programs, cohorts, attendance, contacts, notes, or user preferences and has more than one page-level owner. Behavior owned by one route family stays under `pages/`.

Each feature owns its relevant API adapters, hooks, components, types, and tests. Features may use common components and root technical subsystems, but must not import from `pages/`. Keep dependencies between features explicit and avoid dependency cycles.

Promote code here because ownership became cross-page, not merely to shorten a page file. Prefer the narrowest domain folder that accurately owns the behavior.

See [`../../../../docs/architecture/frontend.md`](../../../../docs/architecture/frontend.md) for the complete frontend ownership rules.
