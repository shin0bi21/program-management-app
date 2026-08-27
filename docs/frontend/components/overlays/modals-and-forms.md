# Modals and forms

A page-owned modal owns one form draft, validation, submission lifecycle, and failure recovery. The route page owns the modal target and entry paths; shared `Modal` owns generic dialog semantics, focus, Escape handling, and focus return.

Keep one-off props beside the component. A non-trivial workflow hook owns initialization, draft transitions, validation, submit locking, API errors, reset, and the authoritative success callback.

## Open the modal from its owner

Represent mutually exclusive add and edit lifecycles with one discriminated page state plus `null` for closed.

```tsx
type ExampleModalState =
  | { mode: 'add'; initialValues: AddExampleInitialValues }
  | { mode: 'edit'; example: Example }
  | null;

const openAddExampleModal = (initialValues: AddExampleInitialValues) => {
  setExampleModalState({ mode: 'add', initialValues });
};
const openEditExampleModal = (example: Example) => {
  setExampleModalState({ mode: 'edit', example });
};
const closeExampleModal = () => setExampleModalState(null);
```

Inventory page actions, table rows, calendar cells/items, and dashboard cards that open the modal. Pass known context in and lock fields the entry path already decided.

## Render the modal

```tsx
function ExampleModal({ state, onClose, onSaved }: ExampleModalProps) {
  const workflow = useExampleModal({ state, onSaved });

  return <Modal
    isOpen
    title={state.mode === 'add' ? 'Add Example' : 'Edit Example'}
    status={workflow.submitStatus}
    statusMessage={workflow.statusMessage}
    onClose={onClose}
    footer={<ModalFormFooter
      formId="example-form"
      onCancel={onClose}
      disabled={workflow.locked}
    />}
  >
    <form id="example-form" onSubmit={workflow.submit}>
      <FormField id="example-name" label="Name" error={workflow.errors.name?.message}>
        <input id="example-name" {...workflow.register('name')} />
      </FormField>
    </form>
  </Modal>;
}
```

Use `FormField`, `FloatingSelect`, `Button`, and `ModalFormFooter` when their contracts fit. Portalled choices use shared floating primitives so positioning, dismissal, keyboard behavior, and focus return remain centralized.

## Manage fields, data and mutations

- Align required, optional, derived, fixed, and dependent fields across persistence, backend validation, API types, form state, labels, disabled states, and submit guards.
- Let the backend derive fields owned by selected records instead of duplicating them in the request.
- Define dependent-field resets and defaults explicitly.
- Keep add/edit initialization deterministic whenever the modal reopens or its target changes.
- Query only data the caller does not already have. Keep the query in the workflow hook, include every server input, forward cancellation, and enable it only while required context exists.
- Prevent same-tick duplicate submission and disable every dismissal/submit path consistently while locked.
- Surface centralized API error messages and field details without replacing them with parsing failures.

One owner controls each mutation. A page-private modal may call its typed API and return the authoritative saved record through `onSaved`; the page action owner then reconciles its children. A shared contextual modal receives an async callback when its consumer must coordinate several views or caches. Table results follow the [row-operation contract](../tables/rows.md).

## Test the modal workflow

Workflow-hook tests own defaults, required fields, dependent transitions, contextual locks, add/edit reset, exact command payloads, submit locking, authoritative success ordering, retry, and failure recovery. Component tests own field and status wiring. Route tests own entry paths and cross-child reconciliation. Shared `Modal` tests own generic focus, Escape, delayed success, disabled-close, and timer cleanup. Use Playwright when portal or browser focus geometry matters.
