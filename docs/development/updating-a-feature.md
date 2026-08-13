# Updating a feature

An update follows the same ownership path as a new feature, but begins by tracing the existing contract before changing it.

## 1. Trace the current behavior

Read the applicable contract under [`docs/features/`](../features/README.md), then identify the owning migration and constraints, service queries, policies, validation, controller and route, typed frontend adapter, state owner, page or shared feature, tests, and API documentation. Read component-local READMEs for every shared primitive the change consumes.

## 2. Define the changed contract

Record what changes and what must remain stable: stored data, authorization and visibility, request and response fields, error behavior, cache reconciliation, destructive behavior, and concurrency. Search for all consumers of a renamed or finite value.

## 3. Change the narrowest owners in dependency order

When persistence changes, start with a new forward-only migration and follow [Database changes](backend/database-changes.md). Then update services and policies before HTTP adapters and frontend consumers. When persistence is unchanged, begin at the lowest owner of the changed rule rather than mechanically touching every layer.

Use the specialized backend and frontend guides linked from the [development handbook](README.md). Update the feature contract with approved behavior changes and preserve existing public contracts unless the product change explicitly replaces them.

## 4. Review and ship

Run focused verification for the exact changed concern and `node scripts/agents/check-patterns.js --changed`. Then follow [Review and shipping](review-and-shipping.md). Deployment remains a separate authorization.
