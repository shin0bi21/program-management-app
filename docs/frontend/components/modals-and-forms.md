# Modals and Forms

A page-owned modal owns one form draft, validation, submission lifecycle, and failure recovery. The route page owns the modal target and entry paths; shared `Modal` owns generic dialog semantics, focus, Escape handling, and focus return.

Keep one-off props beside the component. A non-trivial workflow hook owns initialization, draft transitions, validation, submit locking, API errors, reset, and the authoritative success callback.

## Open the Modal from Its Owner

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

## Render the Modal

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
      onClose={onClose}
      submitStatus={workflow.submitStatus}
      submitDisabled={workflow.locked}
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

Form modal footers use **Cancel** and **Save** for both creation and editing.
`ModalFormFooter` owns these labels; callers do not customize them. Confirmation footers use **Cancel** and **Confirm**, including destructive
actions; their titles and messages describe the action. Close-only dialogs keep
**Close**.

Use `FormField`, `FloatingSelect`, `Button`, and `ModalFormFooter` when their contracts fit. Portalled choices use shared floating primitives so positioning, dismissal, keyboard behavior, and focus return remain centralized.

`Modal` closes automatically 1000 ms after its status becomes `success`. Omit
`successDelay` to use this standard; pass an explicit delay only when a workflow
needs different timing, or `0` to disable automatic closure. Shared modal wrappers
should inherit this default rather than define their own.

Use `FormField` for one labeled control (input, date, textarea, or select). Use
`FormFieldGroup` from the same component directory for a checklist or other group of
controls that needs a `fieldset` and `legend`. Both share label typography, a 4px
label-to-control gap, and field spacing through `common/styles/forms.css`. Keep
these rules with the shared field owner rather than adding page-specific title
or group spacing. Grouped fields do not inherit the single-input styling.

## Manage Fields, Data and Mutations

- Align required, optional, derived, fixed, and dependent fields across persistence, backend validation, API types, form state, labels, disabled states, and submit guards.
- Let the backend derive fields owned by selected records instead of duplicating them in the request.
- Define dependent-field resets and defaults explicitly.
- Keep add/edit initialization deterministic whenever the modal reopens or its target changes.
- Query only data the caller does not already have. Keep the query in the workflow hook, include every server input, forward cancellation, and enable it only while required context exists.
- Prevent same-tick duplicate submission and disable every dismissal/submit path consistently while locked.
- Surface centralized API error messages and field details without replacing them with parsing failures.

One owner controls each mutation. A page-private modal may call its typed API and return the authoritative saved record through `onSaved`; the page action owner then reconciles its children. A shared contextual modal receives an async callback when its consumer must coordinate several views or caches. Table results follow the [row-operation contract](table-rows.md).

## Testing

Cover field and status wiring in the component. The workflow tests cover initialization,
dependent fields, contextual locks, command payloads, duplicate-submit guards and failure
recovery. Shared `Modal` tests own dialog mechanics; route tests cover entry context and
success callbacks. See [Testing](../../workflows/delivery/testing.md).

## Scaffolding

Form modals use this workflow-specific file layout:

```bash
npm run scaffold:frontend -- modal frontend/src/pages/Staff/Schedules/components ScheduleModal --dry-run
```

Remove `--dry-run` to generate the skeleton below. The owner path may be inside a page or page-family `common/`. For a cross-route business workflow, it may also be the `common/features/` root or a `components/` directory inside a broader shared feature.

```text
components/
  ExampleModal/
    ExampleModal.tsx
    ExampleModal.test.tsx
    hooks/
      useExampleModal.ts
      useExampleModal.test.ts
```

A modal that is itself the shared capability uses the direct form `common/features/ExampleModal/`. A modal belonging to a broader shared domain uses `common/features/ExampleDomain/components/ExampleModal/`. Choose between those forms from actual ownership; the scaffold supports both.

The modal component and test are required. Add the workflow hook and its test when the modal owns non-trivial state or asynchronous coordination; keep a simple focused dialog in its component instead of generating a pass-through hook.
