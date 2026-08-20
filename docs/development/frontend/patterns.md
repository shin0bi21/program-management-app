# Frontend ownership patterns

Use this guide when deciding whether behavior belongs in a route page, component, hook, utility, API adapter, or shared owner. The goal is traceable ownership, not a maximum file size or a required number of folders.

## Choose the narrowest real owner

- Keep route-specific behavior under its route page or route-family `common/` directory.
- Put business-aware behavior used by multiple route families under `common/features/<domain>/`.
- Put domain-agnostic UI and interaction primitives under `common/components/`.
- Keep root composition, authentication, HTTP, and query infrastructure in their root subsystems.
- Promote code only when ownership is genuinely shared. Do not move a one-page workflow into common code merely to shorten its source file.

A non-trivial owner may colocate its entry component, styles, internal components, hooks, utilities, types, and tests. Create `components/` or `hooks/` only when multiple peer files make the owner clearer; the absence of either directory is not itself a defect.

## Keep entry components readable

An entry TSX file should make composition and data flow easy to scan. Extract a focused hook when stateful behavior has a coherent name and owns effects, subscriptions, observers, asynchronous transitions, cache coordination, or several callbacks that implement one workflow. Extract a component when a UI region owns meaningful rendering, interaction, accessibility, or an independently testable state surface.

Review an entry TSX when it directly owns any of these signals:

- several related state values or a create/edit/reopen state machine;
- effects, timers, observers, subscriptions, object URLs, or imperative browser cleanup;
- remote queries, mutations, API calls, or cache reconciliation;
- dependent-field transitions, validation, submission, and callback ordering;
- multiple independently meaningful form, dashboard, list, or calendar regions.

These are review prompts, not automatic extraction rules. Keep a focused leaf inline when moving it would create a ceremonial one-line hook, hide a short cohesive lifecycle, or replace readable local behavior with prop plumbing. Do not extract merely to silence a report.

Pages remain orchestrators. They may own cross-view controls, selections, dialogs, and synchronization, while substantial list and calendar views own their remote data and view-specific behavior. Components own presentation and interaction; hooks own stateful policy and lifecycle; API adapters own transport paths and response typing; utilities own pure transforms.

### Split page-wide behavior by responsibility

Use focused `use*Data`, `use*Preferences`, `use*Filters`, `use*Actions`, and `use*Selection` hooks only when each owns real behavior. Keep their initialization in dependency order so the route still reads as the composition owner.

`use*Data` owns remote options, loading and error state, and derived option collections. `use*Selection` owns selected resource/row/item state and two distinct synchronization paths: selection reconciliation repairs or defaults a selection when its available resources change, while selection sync updates or clears the selected record after a successful mutation. Keep both paths in the selection owner rather than placing rendered selection state in `use*Data`.

Do not collect unrelated persistence, filtering, remote data, selection, and mutation behavior in a catch-all `use*Controls` hook. Keep a simple view value and its update with the preference owner instead of creating a pass-through `use*View` hook. A small value or callback does not need its own abstraction merely to match a directory shape.

## Keep defensive behavior at real boundaries

Validate and normalize data where uncertainty enters the system:

- API response parsing;
- persisted or legacy browser/server data;
- user input and form submission;
- permissions and authentication state;
- browser APIs and asynchronous failures.

Inside a typed owner, do not manufacture required values with placeholder defaults, cast unknown strings into finite unions, silently relabel an exhaustive value, or preserve compatibility branches for impossible shapes. Fix the transport or persisted-data boundary instead. Defensive handling is appropriate when the external uncertainty is real and the behavior is explicit and tested.

## Keep files and imports owned

- Import named implementation files directly; do not add an `index.ts` that only re-exports one component.
- Keep one-off prop types beside their component and contracts shared only by a component's internal files inside that component folder.
- Put contracts used by sibling page units in the page `types.ts`; keep runtime column and query keys with the owner that uses them.
- Route HTTP through the centralized client and keep endpoint adapters outside presentational components.
- Colocate each component, hook, API adapter, and route test with its narrowest public owner.
- Keep architecture and integration guidance under `docs/`; do not add READMEs beside frontend source.

## Pattern automation

`node scripts/patterns/check-patterns.js --changed` runs two complementary layers:

- `scripts/patterns/enforce/` contains deterministic repository invariants. Findings fail the command.
- `scripts/patterns/review/` reports lightweight signals for AI-assisted review. Findings never fail the command, score complexity, or decide that extraction is required.

Review scans changed files by default. A reviewed exception may use a narrowly documented file annotation such as:

```ts
// pattern-review-ignore review-inline-workflow: focused browser lifecycle is clearer beside its rendered owner
```

The reason is required. Prefer correcting an ownership problem over suppressing it, and revisit the annotation when the owner changes materially. Use `--all` only for an intentional repository-wide scrub.
