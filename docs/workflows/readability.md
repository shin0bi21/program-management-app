# Code Readability

Clarity over conciseness, during implementation and review.

## Names and Expressions

- Name intermediate values and decisions instead of packing several operations inline.
- Include units where relevant: `durationMinutes`, `totalCents`.
- Avoid repeated derivation and chains of lookups, fallbacks, and transformations.
- Keep simple, immediately understandable expressions inline.

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

## Abstractions

- Extract helpers for distinct responsibilities or contracts; keep cohesive flows together.
- Avoid layers added solely to shorten functions or meet a line count.
- Add memoization, callback indirection, or caching only for a required identity
  contract or demonstrated benefit.

See [Code Documentation](documentation.md) for contracts and comments.
