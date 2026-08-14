# Updating a feature

Start with the part of the application that owns the behavior. If the change affects stored data, API output, or permissions, start with the backend. Otherwise, jump to [Update the frontend](#3-update-the-frontend).

Use the [Stack guide](stack/README.md) when you need an example of the React, TanStack, form, validation, Express, or SQL API used by that owner.

## 1. Find the current behavior

Read the feature document under [`docs/features/`](../features/README.md) when one exists. Then follow the request from the page's API file to the backend route, controller, and service. You only need to inspect the layers involved in this change.

Before editing a shared component, read its local README and inspect one existing consumer that uses the same pattern.

## 2. Update the backend when needed

Use the guide that matches the change:

- Database column, constraint, or relationship: start with a new migration and follow [Database changes](backend/database-changes.md).
- Returned fields shared by list and direct-record endpoints: update the domain's `RecordQuery`, then check both consumers.
- Search, filters, sorting, or pagination: update the `ListService`.
- Loading or setting one record, deleting it, or running another command: update the main domain service.
- Record visibility or mutation access: update the policy and the service query that applies it.
- Request or response shape: update validation, controller wiring, frontend types, and tests with the service change.

See [Backend services](backend/services.md) for file ownership and declaration order. Do not touch every backend layer automatically; change only the owners of the behavior.

## 3. Update the frontend

Start at the typed `.api.ts` adapter when the HTTP contract changed. Then update the hook or component that owns the affected state and rendering.

Use the relevant guide for a [page](frontend/adding-a-page.md), [list](frontend/list-view.md), [calendar](frontend/calendar-view.md), or [form/modal](frontend/forms-and-modals.md). Keep filters, sorting, column settings, and view settings in the established preference object. When no preference row exists yet, the first save must create a complete valid value.

Search all consumers when renaming a field or changing a finite value. Keep database values, validation, API types, frontend types, labels, filters, and tests aligned.

## 4. Review and ship

Run the focused backend and frontend tests for the behavior you changed. Preview test routing when needed:

```bash
bash scripts/tests/test-app.sh --plan-changed
```

Before review, run applicable builds or type checks, then:

```bash
node scripts/patterns/check-patterns.js --changed
git diff --check
```

Update the feature document when business behavior changed. Then follow [Review and shipping](review-and-shipping.md). Deployment remains a separate step.
