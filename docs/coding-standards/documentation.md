# Code Documentation

Follow the [Waterloo CS135 design recipe](https://student.cs.uwaterloo.ca/~cs135/assign/style_guide/cs135_style.pdf).

## Function Design Recipe

1. **Data:** define meanings, units, valid values, and constraints; reuse domain definitions.
2. **Contract:** follow [TypeScript Contracts](typescript-contracts.md) for input/output types; document preconditions, guarantees, and relevant errors or side effects.
3. **Purpose:** state what the function does and how its parameters contribute.
4. **Examples:** work out concrete inputs and expected outputs.
5. **Template:** plan the branches, traversal, or calculation from the data.
6. **Definition:** implement that structure.
7. **Tests:** execute the examples and relevant boundary cases.

## Source Documentation

- Place function documentation immediately above the function: purpose first,
  then `@param` for meaningful inputs, `@returns` when needed, and `@example`.
- Use JSDoc for meanings and constraints that the [source types](typescript-contracts.md) cannot express; do not repeat type declarations in comments.
- State what the function displays, supplies, or changes in plain terms. Explain
  the result before its mechanism; keep the purpose to one or two sentences.
- Explain what meaningful inputs represent, rather than repeating their types.
  Filter `categories` are groups such as Status or Staff with available choices;
  `values` are selected choices in each group, e.g. `{ status: ['active'] }`.
- Include quantities and units that explain behavior, such as "42 extra periods
  on each side"; verify them against the code.
- Use concrete examples that make the result clear. Do not turn the contract into
  an implementation checklist or seven comment sections matching the recipe steps.
- Distinguish caller preconditions from validation and errors the function implements.
- Document relevant mutation, asynchronous completion, permissions, and resource ownership.
- Keep implementation explanations beside the code they explain. Include lifecycle
  and integration constraints in the public contract only when callers need them
  to use the function correctly. Keep component contracts in source, not a second
  Markdown description of the same behavior.
- Replace the design template with completed code; do not retain unfinished skeletons.
- Use equivalent comments in other languages.

## Helpers

Apply the same purpose, contract, and example requirements to private helpers.
The full design recipe is optional for helpers. An `@example` illustrates
behavior; follow [Test Ownership](../workflows/delivery/testing.md#test-ownership)
for executable coverage without exporting helpers solely for tests.

## Complete Example

- **Data:** non-negative whole minute counts; non-negative whole billable hours.
- **Template:** subtract the allowance → clamp to zero → convert to hours → round up.
- **Contract, purpose, examples, and definition:**

```ts
/**
 * Calculates billable hours after deducting the included allowance.
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
