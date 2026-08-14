# Forms and validation

React Hook Form owns frontend form state. Zod validates frontend form values and every backend request boundary.

## Frontend form setup

Keep the schema, inferred value type, defaults, and form hook together:

```tsx
const exampleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  programId: z.string().uuid().nullable(),
});

type ExampleFormValues = z.infer<typeof exampleSchema>;

const form = useForm<ExampleFormValues>({
  resolver: zodResolver(exampleSchema),
  defaultValues: { name: '', programId: null },
});
```

Use `register` for native inputs. Use `Controller` when a shared component does not expose a native input ref/value interface.

Reset the form whenever its modal opens or edit target changes:

```tsx
useEffect(() => {
  if (isOpen) form.reset(valuesForExample(example));
}, [example, form.reset, isOpen]);
```

Build the API payload in the submit owner. The backend remains responsible for permissions and business rules. See the [React Hook Form useForm API](https://www.react-hook-form.com/docs/useform) and [Zod API](https://zod.dev/api).

When the modal loads remote options or saves data that appears elsewhere, follow [Queries and mutations in a modal](tanstack-query.md#queries-and-mutations-in-a-modal). Keep form state in React Hook Form and server state in TanStack Query.

## Backend request schemas

Validate the location where each value arrives:

```ts
export const exampleParamsSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid example ID') }),
});

export const setExampleSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    programId: z.string().uuid().nullable(),
  }),
});

export type SetExampleInput = z.infer<typeof setExampleSchema.shape.body>;
```

The route runs `validateRequest` before the controller. Controllers may then use the inferred request type without parsing the same input again.

## Where to look

- Frontend modal hook: `frontend/src/pages/Outreach/Leads/components/useLeadModal.ts`
- Shared Youth form: `frontend/src/common/features/youth/components/YouthModal/`
- Backend schema: `backend/src/validation/taskSchemas.ts`
- Complete workflow: [Forms and modals](../frontend/forms-and-modals.md)
