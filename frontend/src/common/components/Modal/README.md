# Modal

`Modal` is the shared application dialog. It owns dialog semantics, initial focus, focus containment, Escape handling, and focus return. The consuming form or workflow owns open state, submission state, validation, and persistence.

## Consumer contract

- Pass a stable `title`; Modal connects it to the dialog's accessible name.
- Pass the workflow's `status`. Modal automatically disables its X button and Escape dismissal while `status` is `submitting` or `success`; consumers must not repeat that rule with `disableClose`. Disable footer cancel and submit controls consistently.
- Use `disableClose` only for work that does not use Modal status or for another non-status state that must prevent dismissal.
- Keep `onClose` safe and idempotent. Do not clear server-backed state until the operation that owns it has completed or been cancelled deliberately.
- Use `status`, `statusMessage`, and `successDelay` for the supported submission feedback flow instead of adding a second overlay.
- Use `ModalFormFooter` when its standard cancel/submit behavior fits the form.
- Give forms stable IDs when a footer submit button targets a form inside the modal body.

## Form controls

Use the existing application primitives inside modals:

- `FormField` for labels, help text, and validation errors.
- `FloatingSelect` for normal single-choice selection. Do not add a native `<select>` or custom dropdown unless the interaction has a concrete semantic or platform requirement that `FloatingSelect` cannot meet.
- `Button` for footer and form actions.

Portalled floating menus are supported inside Modal and should use `FloatingSelect` or `FloatingMenuPanel` so positioning, keyboard navigation, dismissal, and focus return stay consistent.

## Testing

Shared Modal tests own the generic dialog, focus, Escape, and disabled-close contract. Consumer tests should prove only behavior that depends on their wiring:

- submission cannot be triggered twice;
- the correct status is passed and Cancel is disabled during submission;
- success closes or refreshes the intended state;
- failure keeps the form open and presents an error.

Test browser focus and portal geometry with Playwright when jsdom cannot establish the behavior.
