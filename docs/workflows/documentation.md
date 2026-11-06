# Code Documentation

Follow the [Waterloo CS135 design recipe](https://student.cs.uwaterloo.ca/~cs135/assign/style_guide/cs135_style.pdf).

## Function Design Recipe

1. **Data:** define meanings, units, valid values, and constraints; reuse domain definitions.
2. **Contract:** specify input/output types, preconditions, guarantees, and relevant errors or side effects.
3. **Purpose:** state what the function does and how its parameters contribute.
4. **Examples:** work out concrete inputs and expected outputs.
5. **Template:** plan the branches, traversal, or calculation from the data.
6. **Definition:** implement that structure.
7. **Tests:** execute the examples and relevant boundary cases.

## Source Documentation

- Place purpose, contract, and illustrative examples immediately above the function.
- Express types in TypeScript; document parameter meanings and additional constraints in JSDoc.
- Distinguish caller preconditions from validation and errors the function implements.
- Document relevant mutation, asynchronous completion, permissions, and resource ownership.
- Replace the design template with completed code; do not retain unfinished skeletons.
- Use equivalent comments in other languages.

## Helpers

- Require **purpose, contract, and at least one illustrative example**, including small helpers.
- Waterloo encourages the full recipe for helpers but does not require it.
- Exercise private helpers through their public owner when appropriate; do not export them solely for tests.
- An `@example` documents behavior; executable tests verify it.

```ts
/**
 * Converts durationMinutes to seconds.
 * @param durationMinutes - A non-negative finite duration in minutes.
 * @returns The equivalent duration in seconds.
 * @example minutesToSeconds(1.5) // 90
 */
function minutesToSeconds(durationMinutes: number): number {
  return durationMinutes * 60;
}
```

## Complete Example

- **Data:** non-negative whole minute counts; non-negative whole billable hours.
- **Template:** subtract the allowance → clamp to zero → convert to hours → round up.
- **Contract, purpose, examples, and definition:**

```ts
/**
 * Calculates billable hours from workedMinutes after deducting includedMinutes.
 * Any partial billable hour counts as a whole hour.
 *
 * @param workedMinutes - Non-negative safe integer counting minutes worked.
 * @param includedMinutes - Non-negative safe integer counting minutes covered by the allowance.
 * @returns Whole billable hours; zero when the allowance covers the work.
 * @example getBillableHours(60, 60) // 0
 * @example getBillableHours(61, 60) // 1
 * @example getBillableHours(121, 60) // 2
 */
function getBillableHours(workedMinutes: number, includedMinutes: number): number {
  const extraMinutes = Math.max(0, workedMinutes - includedMinutes);
  const extraHours = extraMinutes / 60;

  return Math.ceil(extraHours);
}
```

- **Preconditions:** callers supply valid minute counts; this function does not validate them.
- **Tests:** cover no work, unused allowance, exact boundaries, and rounding.

```ts
it.each([
  [0, 60, 0],
  [30, 60, 0],
  [60, 60, 0],
  [61, 60, 1],
  [120, 60, 1],
  [121, 60, 2],
])('bills %i worked minutes with %i included as %i hours', (worked, included, expected) => {
  expect(getBillableHours(worked, included)).toBe(expected);
});
```

## Inline Comments

- Explain non-obvious variable roles, business rules, invariants, assumptions,
  ordering, input formats, error behavior, and deliberate exceptions.
- State the rule plainly; do not narrate operations or repeat variable names.
- Place comments directly above their statement group, at the same indentation,
  with no intervening blank line.
- Keep purposes, contracts, examples, and comments accurate as behavior changes.

```ts
// Archived records remain editable until the reporting period closes.
const canEdit = hasEditPermission && !isReportingPeriodClosed;
```

See [Code Readability](readability.md) for code layout and
[Documentation Maintenance](../README.md) for handbook writing.
