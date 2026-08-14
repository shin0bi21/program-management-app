# Development handbook

Use this handbook when adding or changing application code. It tells you what to change and in what order. Architecture documents explain why the repository is organized that way.

If the feature already has a document under [`docs/features/`](../features/README.md), read it first. It records business rules that must stay consistent across the backend and frontend.

Use the guides in this order:

1. Start with [Adding a feature](adding-a-feature.md) or [Updating a feature](updating-a-feature.md).
2. Follow the linked backend and frontend workflows that apply.
3. Read a linked architecture document when the change affects that boundary.
4. Use [Testing](../operations/testing.md) and the repository scripts for focused verification.

## Guide map

| Task | Guide |
|---|---|
| Understand the application stack | [Stack guide](stack/README.md) |
| Add an end-to-end capability | [Adding a feature](adding-a-feature.md) |
| Change an existing capability | [Updating a feature](updating-a-feature.md) |
| Add a backend domain or API | [Adding a backend domain](backend/adding-a-domain.md) |
| Add a route page | [Adding a frontend page](frontend/adding-a-page.md) |
| Add a list or calendar | [List view](frontend/list-view.md) or [calendar view](frontend/calendar-view.md) |
| Add a form or modal | [Forms and modals](frontend/forms-and-modals.md) |
| Choose React state patterns | [React state](frontend/react-state.md) |
| Add or synchronize a package dependency | [Local development dependency commands](../operations/local-development.md#which-command-to-use) |
| Diagnose a client, API, or backend failure | [Debugging](../operations/debugging.md) |
| Prepare or operate an environment | [Operations](../operations/README.md) |
| Select and run tests | [Testing](../operations/testing.md) |
| Review and ship completed work | [Review and shipping](review-and-shipping.md) |

The source tree remains authoritative for exact filenames. These guides explain the repeatable pattern without trying to inventory every file in the repository.
