# Code Readability

Clarity over conciseness, during implementation and review.

## Names and Expressions

- Name intermediate values and decisions instead of packing several operations inline.
- Include units where relevant: `durationMinutes`, `totalCents`.
- Call the signed-in account `user`. Use `userId` for its ID, or `currentUserId`
  when `userId` already identifies the target account in the same scope.
- Avoid repeated derivation and chains of lookups, fallbacks, and transformations.
- Keep simple, immediately understandable expressions inline.
- Name throwing guards `assert<Resource><Condition or Operation>`, with the
  resource first: `assertProgramCycleAccess`, `assertStaffReadAccess`,
  `assertAccountCreationAccess`, or `assertStaffActive`.
- Reserve `can…`, `is…`, and `has…` for boolean checks. Assertions return normally
  when their condition holds and throw when it fails; avoid `assertCan…` names.
- Keep descriptive condition names such as `assertProgramExists`,
  `assertAssignmentUnused`, and `assertYouthEligibility`. General script and test
  assertions such as `assertInside` and `assertOrdered` may name the condition
  directly.

```ts
const hasEditPermission = permissions.includes('records:edit');
const isReportingPeriodClosed = reportingPeriod.status === 'closed';

// Archived records remain editable until the reporting period closes.
const canEdit = hasEditPermission && !isReportingPeriodClosed;
```

## Branching

- Use guards and `if` statements for multiple decisions.
- Avoid nested ternaries and mixed operators that obscure precedence.
- Use a simple ternary for one clear choice.

```ts
if (!hasViewPermission) return 'unavailable';
if (isLoading) return 'loading';

return records.length === 0 ? 'empty' : 'ready';
```

## Reading Order and Spacing

- Follow execution or lifecycle order within functions, methods, and callbacks.
- Separate distinct phases with blank lines: lookups, guards, derived values,
  validation, state changes, and side effects.
- Follow actual dependencies; validate before mutation where required.
- Keep related statements together. Omit unused phases and empty section headings.

## Data Shapes and Boundaries

- Prioritize consistent domain shapes, field names, units, and formats across persistence, APIs, frontend state, and forms.
- Format values for display without introducing artificial domain data. For example, do not turn a date-only value into a timestamp just to format it.
- Convert representations only at boundaries that require it. Keep necessary conversions explicit and local to that boundary, with one canonical representation for the domain value.
- Raise concerns when an existing contract or dependency would require conflicting shapes or extra adapters. Propose the simpler contract instead of silently adding conversions, duplicate representations, or compatibility layers to keep implementation moving.
- Resolve issues within the authorized scope and flag broader decisions for discussion.

Follow [Dates and Times](date-and-time.md) for canonical date/time shapes and
the boundaries where timezone conversion is required.

## Abstractions

- Extract helpers for distinct responsibilities or contracts; keep cohesive flows together.
- Avoid layers added solely to shorten functions or meet a line count.
- Add memoization, callback indirection, or caching only for a required identity
  contract or demonstrated benefit.

See [Code Documentation](documentation.md) for contracts and comments.
