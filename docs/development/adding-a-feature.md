# Adding a feature

If the feature needs new stored data, API endpoints, or permission rules, start with the backend. If the backend already supports everything the feature needs, jump to [Build the frontend](#3-build-the-frontend).

If an API in the examples is unfamiliar, use the [Stack guide](stack/README.md). It explains the libraries and APIs this repository uses without changing the implementation order below.

## 1. Confirm what you are building

Write down what the feature must do, who can use it, and the important failure cases. Add a short document under [`docs/features/`](../features/README.md) when these rules affect both backend and frontend behavior.

Do not document possible future versions of the feature as current behavior.

## 2. Build the backend when needed

Follow [Adding a backend domain](backend/adding-a-domain.md). The usual order is:

1. create and run the migration when stored data changes;
2. define record-level access rules;
3. add the service queries and commands;
4. add validation, the controller, and routes;
5. mount the route and add focused API tests.

The policy comes before the service because service reads and writes must apply those access rules.

## 3. Build the frontend

Follow [Adding a frontend page](frontend/adding-a-page.md) when the feature adds a route. That guide covers the page directory, route, navigation, typed API calls, and state.

Then use only the guide needed for the UI you are adding:

- [List view](frontend/list-view.md) for a remote table or list;
- [Calendar view](frontend/calendar-view.md) for a resource calendar;
- [Forms and modals](frontend/forms-and-modals.md) for create, edit, and delete workflows;
- [Page shell](frontend/page-shell.md) for the standard page layout.

## 4. Test the feature

Use the narrow owner tests while developing. Preview affected-suite routing with:

```bash
bash scripts/tests/test-app.sh --plan-changed
```

Run the selected focused scripts under `scripts/tests/backend/` and `scripts/tests/frontend/`. Before review or handoff, run applicable builds or type checks, then:

```bash
node scripts/agents/check-patterns.js --changed
git diff --check
```

Use [Testing](../operations/testing.md) to choose the right test command. After implementation, follow [Review and shipping](review-and-shipping.md). Deployment is a separate step.
