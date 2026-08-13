# Development handbook

This directory is the human-facing guide to changing the application. Architecture documents explain system boundaries; these guides explain the ordered work required to add or update behavior within those boundaries.

Product behavior that crosses implementation layers lives under [`../features/`](../features/README.md). Development work reads or creates the applicable feature contract, then follows these procedural guides.

Use the guides in this order:

1. Start with [Adding a feature](adding-a-feature.md) or [Updating a feature](updating-a-feature.md).
2. Follow the linked backend and frontend workflows that apply.
3. Read the architecture documents referenced by those workflows before changing an ownership boundary.
4. Use [Testing](../operations/testing.md) and the repository scripts for focused verification.

## Guide map

| Task | Guide |
|---|---|
| Add an end-to-end capability | [Adding a feature](adding-a-feature.md) |
| Change an existing capability | [Updating a feature](updating-a-feature.md) |
| Add a backend domain or API | [Adding a backend domain](backend/adding-a-domain.md) |
| Add a route page | [Adding a frontend page](frontend/adding-a-page.md) |
| Add a list or calendar | [List view](frontend/list-view.md) or [calendar view](frontend/calendar-view.md) |
| Add a form or modal | [Forms and modals](frontend/forms-and-modals.md) |
| Choose React state patterns | [React state](frontend/react-state.md) |
| Prepare or operate an environment | [Operations](../operations/README.md) |
| Select and run tests | [Testing](../operations/testing.md) |
| Review and ship completed work | [Review and shipping](review-and-shipping.md) |

The source tree and component-local READMEs remain authoritative for exact current names. These guides own the repeatable repository workflow and link to code locations rather than duplicating a complete file inventory.
