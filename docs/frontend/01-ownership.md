# Ownership

## Choose the Narrowest Owner

Choose by responsibility, dependency direction, and lifecycle; file length does not determine ownership.

| Owner | Responsibility |
|---|---|
| `pages/<RouteFamily>/<Page>/` | Route-specific composition, APIs, hooks, types, and behavior |
| `pages/<RouteFamily>/common/` | Behavior shared by sibling routes in one family |
| `common/features/<domain>/` | Business-aware capability used by multiple route families |
| `common/components/` | Domain-agnostic UI and interaction primitives |
| `common/hooks/` and `common/utils/` | Small generic hooks and pure utilities |
| `app`, `auth`, `http`, `query` | Root composition and technical infrastructure |

- Keep implementation, tests, and supporting files with their feature or component.
- Promote a contract only when its ownership becomes shared. A second consumer or similar values alone do not justify promotion.

## Preserve Import Direction

- Follow `pages → common/features → common/components`, with root infrastructure below these layers.
- Never import a page from common code.
- Pages may import another page's route-owned code when that page remains the clearest owner.
- Import contracts from their owner without circular dependencies or runtime dependencies back to parent components.

## Place Hooks

1. Place a component-private hook in that component's `hooks/` directory.
2. Lift it to the nearest common owner only when it coordinates children, shares resources, or must survive a child's unmount.
3. Pass parent-coordinated behavior through props.

The page owns `hooks/data/use<Domain>Data` for shared reference
lookups. Table, calendar, and dashboard query hooks stay with their consuming
components. Follow the [page data flow contract](02-state-and-data.md#page-data-flow)
for the target structure and downward data flow.

Do not collect descendant hooks at a parent merely because it renders those descendants.

## Place Types and Utilities

- Keep pure transforms, constants, date arithmetic, and library adapters in utilities.
- Keep endpoint-only request, filter, pagination, and payload types in the API adapter.
- Keep component-, hook-, and page-only types beside their owner.
- Define each shared contract once at its owner.
- Put actions shared by a page's table and calendar in the page's `types.ts`.
- Declare the reference-data result beside the page hook that supplies it.
- Import the owner's type in consumer props and hook options. Use `Pick` if
  the consumer receives only part of the object.

See [Page Data Flow](02-state-and-data.md#page-data-flow) for examples.

Follow [TypeScript Contracts](../coding-standards/typescript-contracts.md)
for explicit boundary inputs and returns, named object contracts, and local inference.

## Rendered Components

1. Extract a region when it has a clear name and independent contract.
2. Keep simple local state and presentation handlers in the component.
3. Use a focused hook for stateful policy, effects, subscriptions, or async coordination.
4. Place private helpers below the component in caller order.

Do not create hooks merely to rename state or forward props.

## Own Interaction Lifecycles

- Keep each interaction's guards, transitions, completion, cancellation, and cleanup together.
- Separate unrelated lifecycles.
- Coordinate global registrations at the narrowest shared owner; keep instance resources with their instance.
- Pair listeners, observers, timers, subscriptions, and external instances with cleanup on completion, cancellation, dependency changes, and unmount.

### Modal and Form Lifetimes

- Mount each modal interaction's content on open and unmount it on close or
  successful completion. This includes forms, viewers, reports, details, and confirmations.
- Keep the open target with the page or interaction owner. A form's draft,
  validation, feedback, and submission lock belong to its mounted instance.
- Use React Hook Form for modal form values and submission. Register native
  inputs, and connect custom controls with `Controller` or `setValue` when
  their changes also coordinate related fields. Keep domain validation and
  request feedback with the mounted workflow.
- Keep an explicit `isOpen` interface when the modal uses one. A thin modal owner
  can conditionally mount its state-owning content without another visibility state.
- Initialize once from supplied edit data or add defaults. Pass records already
  loaded by the opening view; do not fetch them again to initialize the draft.
- Name incoming records and context by their domain meaning, such as `task`,
  `programId`, and `date`, without `initial` or `supplied` prefixes. Keep editable
  values together under `draft`, using the same field names (`draft.programId`,
  `draft.date`). A form library may own the draft instead. Reserve `selected`
  names for selection outside the form draft.
- Order draft field declarations and initialization to match the form's DOM
  order, including fields within conditional sections. Keep non-rendered
  identifiers and interaction metadata separate from that field sequence.
- Close or successful completion clears the target and unmounts the interaction.
  Preserve the shared dialog's success feedback until its close callback runs.
- Reopening starts a fresh instance. Key the form by target identity if the target
  can change without closing. Background record refreshes do not replace drafts.
- Do not clear drafts on close or simulate mounting with reset effects or draft refs.
  Keep option loading and resource cleanup separate from draft initialization.
- Preview URLs, zoom controls, and modal-owned requests follow the same lifetime;
  unmounting releases resources and cancels unfinished loads.
- A related child dialog can suspend its parent while keeping that parent mounted.
  Closing the parent interaction discards both forms.
- Inline and route forms follow their interaction's lifetime: completion or
  navigation unmounts the editor; starting another entry mounts a fresh instance.

## Add Sidebar Navigation

The application shell owns sidebar destinations:

1. Connect the protected route in `app/App.tsx`.
2. Define permission-derived visibility in `useAppNavigation`.
3. Add the label and URL in `AppNavigation`.

Redirect aliases and public authentication routes do not need sidebar entries.

## Enforcement

See [Review](../../.agents/skills/02-review-changes/SKILL.md) for assessment and evidence.
