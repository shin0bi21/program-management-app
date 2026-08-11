# Structure and Ownership

## Discover patterns

Inspect conventions relevant to the change: page and feature organization; API, service, hook, schema, and type boundaries; database migrations and transactions; permissions and authentication; naming and responsive layout.

Use repeated repository patterns only when they meet the baseline boundaries below.

## Inventory materially changed files

For every material implementation file:

1. List rendering, state, effects, event flows, data adaptation, validation, and external-library responsibilities.
2. Identify nested components, hooks, state machines, and reusable pure helpers.
3. Compare at least two nearby examples before claiming a strong local convention.
4. Check whether the feature warrants `components/`, `hooks/`, `api/`, types, schemas, utilities, or focused tests.
5. Verify a clear dependency direction and cohesive extracted contracts.
6. Search changed ownership layers, tests, fixtures, and local aliases for legacy or neighboring-domain terminology. Require canonical names unless the value crosses a documented domain boundary where the other term remains accurate.

Apply these baseline rules:

- Keep main components focused on composing named UI units and connecting inputs and outputs.
- Extract UI regions with meaningful conditional rendering, interaction, accessibility behavior, or a stable conceptual name. Reuse is not required.
- Extract coherent stateful behavior, effects, subscriptions, observers, or callback groups into named hooks.
- Move pure transforms, constants, mapping logic, and external-library adapters into utilities when they obscure orchestration.
- Flag dense inline derivation—nested ternaries, chained filtering/grouping, or multiple state transitions compressed into JSX—even when the file is not large. Prefer named predicates and transforms with a focused hook when memoization or reference preservation is part of the contract.
- Trace every optional chain, nullish fallback, default, catch-and-continue path, and broad empty-state substitution to an explicit contract. Flag defensive code that hides required-data failures, as well as fallback chains that make malformed states appear valid.
- Trace each mutation from user action to persistence. Flag full-record payloads assembled from cached entities when the action owns only a subset of fields, even if the endpoint and types permit the broader write.
- Flag AI-spaghetti even when behavior currently passes: compressed boolean pipelines, mixed-responsibility transform chains, repeated inline conditionals, and helpers whose fallback behavior cannot be stated as one business rule.
- Put cross-unit contracts in the feature's types file; keep private one-off props beside their component.
- Preserve entry component → focused components/hooks → utilities/types direction.
- Keep public behavior covered at the feature entry; add focused tests only where they materially improve diagnosis.

## Classify ownership

- Keep root composition and failure handling in `app/`; authentication in `auth/`; HTTP transport in `http/`; query infrastructure in `query/`.
- Put domain-agnostic reusable UI in `common/components/`.
- Put cross-page business capabilities in `common/features/<domain>/`.
- Keep route-family behavior under its page directory.
- Never import pages from common features or common components.
- Split mixed shared files when exports belong to different domains or ownership layers.

Explicitly determine whether:

- the main component owns multiple independent behaviors;
- named effects or callback groups warrant hooks;
- meaningful nested components are hidden in a large file;
- pure transforms or adapters are mixed into render code;
- extraction would clarify ownership or independent testing;
- the directory communicates the feature's actual complexity.

Treat missing structural extraction as a finding when a file contains multiple independently meaningful peer units. Do not require extraction for trivial one-use markup or split cohesive behavior merely to reduce line count.
