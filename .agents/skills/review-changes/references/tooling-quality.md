# Tooling Quality

Treat lint, typecheck, formatting, coverage, build, and test output as diagnostic evidence, not as the objective. Prefer an honest warning with a documented cause over code that is harder to reason about or less correct merely to make a tool report clean.

For every tooling-motivated change:

- verify that it improves or preserves runtime behavior, type precision, ownership, and readability independently of silencing the diagnostic;
- reject weakened types, broader casts, non-null assertions, fake dependencies, decorative memoization, ref indirection, redundant state, or custom lifecycle logic added only to satisfy a rule;
- scrutinize disable comments, ignore patterns, warning suppressions, coverage exclusions, and configuration exceptions. Require a narrow technical reason and confirm that a standard library or repository pattern cannot express the contract;
- prefer official framework and library types or APIs over locally reconstructed conditional types and compatibility shims;
- compare behavior before and after, including stale closures, effect timing, focus restoration, asynchronous ordering, and render frequency;
- report remaining diagnostics as residual debt when the sound correction is outside scope. Do not describe a review as clean because a warning was hidden.

Flag a tooling workaround whenever reverting it would leave clearer or safer code with only a warning as the tradeoff. Passing tooling never overrides a code-quality finding.
