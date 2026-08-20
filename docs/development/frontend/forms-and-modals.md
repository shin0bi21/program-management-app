# Frontend forms and modals

TanStack Query owns remote data; React Hook Form or local React state owns the draft and modal lifecycle.

## Use the shared dialog contract

`Modal` owns dialog semantics, its accessible title, initial focus, focus containment, Escape handling, and focus return. The consuming workflow owns open state, submission state, validation, persistence, and safe close behavior.

- Pass a stable `title` and the workflow's `status`. While status is `submitting` or `success`, Modal disables its X button and Escape dismissal; disable footer Cancel and Submit controls consistently.
- Use `disableClose` only for a non-status state that independently prevents dismissal.
- Keep `onClose` idempotent. Do not clear server-backed state until its operation completes or is deliberately cancelled.
- Use `status`, `statusMessage`, and `successDelay` for submission feedback instead of adding another overlay. Shared `Modal` owns delayed success closure and timer cleanup; a consumer that enters success must not also close immediately or start its own timer.
- Use `ModalFormFooter` when its standard Cancel/Submit behavior fits, and give a body form a stable ID when the footer submit button targets it.
- Use `FormField`, `FloatingSelect`, and `Button` inside forms. Portalled choices use `FloatingSelect` or `FloatingMenuPanel` so positioning, dismissal, keyboard behavior, and focus return remain shared.

## Define entry paths

- Inventory every entry path before building the form: page action, calendar cell, selected dashboard record, list action, and contextual create or edit.
- Keep genuinely different workflows separate at the entry point. Use a floating menu before the modal when the user must choose between distinct flows; do not add a mode selector inside a form merely because the forms share a shell.
- Pass known context into the modal and lock fields the entry path already decided. Do not ask users to reselect a calendar resource, task, date, or other authoritative context.
- Represent mutually exclusive add and edit lifecycles with one domain-named discriminated state, such as `TaskModalState` or `TimeEntryModalState`, plus `null` for closed. Do not coordinate independent `isOpen`, add-target, and edit-target states that can describe impossible combinations.
- Name page handlers for the domain and modal they operate, such as `openAddTaskModal`, `openEditTaskModal`, and `closeTaskModal`. Avoid generic editor terminology or callback names that hide whether they add, edit, or dismiss a specific workflow.

## Align the field contract

- Define required, optional, derived, fixed, and dependent fields across database, backend validation, API types, form state, labels, disabled states, and submit guards.
- Let the backend derive fields owned by a selected record rather than duplicating them in the request or form.
- Define dependent-field transitions explicitly. When a parent value changes, preserve, reset, or default children according to the product rule; avoid forcing users to edit fields in an unnatural order.
- Choose defaults from domain state, such as the active cycle, not incidental array order.
- Keep create and edit initialization deterministic whenever the modal reopens or its target changes.

## Own remote data and mutations

Use a query only when the modal needs server data that its caller does not already have, such as dependent options. Keep it in the modal's focused hook, include every server input in its key, pass request cancellation through the API adapter, and enable it only while the modal is open and its required context exists. Pass an already-loaded complete edit record into the modal instead of fetching it again.

Use one mutation boundary:

- A form owned by one page may call its typed API and return the authoritative saved record through `onSuccess`; the page then reconciles its list, calendar, and dashboard owners.
- A shared contextual modal receives an async mutation callback from its consumer when the consumer must coordinate several views or caches.

The modal owns its draft, submit, and error state. One owner controls the mutation and cache reconciliation; never split one write's cache rules between the modal and its caller.

## Handle lifecycle and errors

- Prevent duplicate submission and keep dismissal behavior correct while submitting.
- Surface centralized API error messages, including empty or non-JSON responses, without replacing them with parsing failures.
- Keep destructive confirmation, conflict messages, and success/cache reconciliation consistent with the authoritative backend result.

## Verify each path

Test required fields, dependent changes, contextual locked fields, defaults, create/edit reset, authoritative mutation and reconciliation ordering, and failure recovery at the workflow owner. Test lock and disabled-state wiring where the workflow exposes a submission path; the shared submit-lock test owns the generic same-tick locking mechanic. Add consumer tests when correctness depends on calendar, table, dashboard, or cache wiring rather than the modal alone.

Shared Modal tests own generic dialog semantics, focus, Escape, disabled-close behavior, delayed success closure, and timer cleanup. Workflow tests set success and prove their domain callback/status wiring without advancing the generic timer. Route tests own entry paths and cross-owner reconciliation. Use Playwright when portal placement or browser focus geometry cannot be established in jsdom.
