---
name: review-file-structure
description: Review file responsibilities, layer boundaries, internal reading order, and test ownership against repository owner guides. Use for explicit file-structure reviews and the structural pass within implementation or change review, including script workflows and frontend scaffold alignment.
---

# Review File Structure

Read [File Structure and Ownership](../../../docs/workflows/file-structure.md)
and follow its routing to the affected owner guides. Keep rules in those guides;
this skill owns the review procedure rather than a parallel architecture standard.

## Establish the Boundary

- For a standalone request, use the specified files and inspect only the callers,
  dependencies, and tests needed to understand their responsibility. A file review
  does not require mapping the whole working tree.
- Within `develop-feature`, use the implementation's affected owners and apply
  the pass before handoff. Within `review-changes`, reuse the current concern map,
  scope, snapshot, and verification evidence; do not repeat inventory or testing.
- Review is read-only unless the current request authorizes implementation or
  fixes. Do not expand into unrelated refactoring, shipping, or deployment.

## Perform the Structural Pass

1. State the file's responsibility and identify the applicable guide or scaffold.
2. Follow the guide's file-and-boundary review: responsibility, dependencies,
   lifecycle order, function phases, test ownership, and explanatory comments.
3. Inspect complete affected functions and their contracts, not just added lines.
   A numbered outline is insufficient when the code inside a function is unclear.
4. For scripts, apply [Script Structure](../../../docs/workflows/scripts.md).
   For frontend and backend files, follow their focused owner guides rather than
   imposing script sections on application code.
5. Distinguish a concrete mismatch from an optional improvement or missing rule.
   Do not infer defects from file size, helper count, or absent section headings.

## Return Evidence

Report concrete findings with file/line, owner rule, impact, and correction. If
none remain, say so and name the surfaces inspected and any unverified boundaries.
When embedded in change review, merge findings into its report without a second
severity system or duplicate findings. Reuse its testing evidence; this pass does
not require an additional test run.

When fixes are authorized, correct the narrowest owner and repeat the affected
structural pass. Route missing or contradictory rules to their canonical guide
within the authorized documentation scope instead of accumulating skill rules.
