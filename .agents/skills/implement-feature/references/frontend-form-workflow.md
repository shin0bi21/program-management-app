# Frontend form and modal workflow

## Define entry paths

- Inventory every entry path before building the form: page action, calendar cell, selected dashboard record, list action, and contextual create or edit.
- Keep genuinely different workflows separate at the entry point. Use a floating menu before the modal when the user must choose between distinct flows; do not add a mode selector inside a form merely because the forms share a shell.
- Pass known context into the modal and lock fields the entry path already decided. Do not ask users to reselect a calendar resource, task, date, or other authoritative context.

## Align the field contract

- Define required, optional, derived, fixed, and dependent fields across database, backend validation, API types, form state, labels, disabled states, and submit guards.
- Let the backend derive fields owned by a selected record rather than duplicating them in the request or form.
- Define dependent-field transitions explicitly. When a parent value changes, preserve, reset, or default children according to the product rule; avoid forcing users to edit fields in an unnatural order.
- Choose defaults from domain state, such as the active cycle, not incidental array order.
- Keep create and edit initialization deterministic whenever the modal reopens or its target changes.

## Handle lifecycle and errors

- Prevent duplicate submission and keep dismissal behavior correct while submitting.
- Surface centralized API error messages, including empty or non-JSON responses, without replacing them with parsing failures.
- Keep destructive confirmation, conflict messages, and success/cache reconciliation consistent with the authoritative backend result.

## Verify each path

Test required fields, dependent changes, contextual locked fields, defaults, create/edit reset, failure recovery, duplicate-submit prevention, and each distinct entry path. Add consumer tests when correctness depends on calendar/list/dashboard wiring rather than the modal alone.
