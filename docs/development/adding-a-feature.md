# Adding a feature

Add a feature from durable data and authority outward. Define the contract once, enforce it on the backend, and then expose it through typed frontend workflows.

## 1. Define the product contract

Write down the records, lifecycle, ownership, visibility, mutation permissions, destructive behavior, date boundaries, request and response shapes, and user-visible error behavior. Separate current requirements from speculative future states.

For cross-stack work, keep finite values, nullable fields, identifiers, permissions, and error semantics aligned from database through UI.

If the capability has meaningful cross-layer lifecycle, authorization, persistence, destructive, date, concurrency, or multi-consumer behavior, add its canonical product contract under [`docs/features/`](../features/README.md). Group it by product area, not by its current page-local or shared-code placement.

## 2. Build the backend foundation

Follow [Adding a backend domain](backend/adding-a-domain.md) in its documented order:

1. migration and generated database types;
2. service queries, transactions, and business rules;
3. authorization policies and record scope;
4. validation, controllers, and routes;
5. production and test application mounting;
6. backend tests and API documentation.

The backend must independently enforce every invariant and authorization rule before the frontend depends on it.

## 3. Build the frontend capability

Follow [Adding a frontend page](frontend/adding-a-page.md) when the feature owns a route. That guide routes to specialized workflows for page shells, list views, calendar views, forms and modals, React state, and browser interactions.

Start with the typed endpoint adapter and state owner, then compose the page and its specialized views. Do not let UI implementation invent a broader contract than the backend provides.

## 4. Verify the concern

Use the narrow owner tests while developing. Preview affected-suite routing with:

```bash
bash scripts/tests/test-app.sh --plan-changed
```

Run the selected focused scripts under `scripts/tests/backend/` and `scripts/tests/frontend/`. Before review or handoff, run applicable builds or type checks, then:

```bash
node scripts/agents/check-patterns.js --changed
git diff --check
```

Use [Testing](../operations/testing.md) for runner ownership. After implementation, follow [Review and shipping](review-and-shipping.md); review and shipping do not authorize deployment.
