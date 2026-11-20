# TypeScript Contracts

Define boundary types in source so callers can understand inputs and results.
Document constraints and behavior that types cannot express using
[Code Documentation](documentation.md).

## Type Declarations

- Explicitly type function inputs. Allow contextual inference for callbacks when
  a typed caller establishes their parameter types, such as array methods,
  query callbacks, and component event handlers.
- Explicitly annotate return types at API adapters, exported hooks, shared
  utilities, and exported components. Use the actual async contract, such as
  `Promise<Task>`, and include `null` when a component can render nothing.
  Private helper returns may use inference.
- Use named interfaces or type aliases for object contracts at API, component,
  and hook boundaries. Reuse the canonical domain or library contract instead
  of repeating its structure. Keep types beside their owner; follow
  [frontend type ownership](../frontend/01-ownership.md#place-types-and-utilities).
- Infer local variables when the initializer expresses the intended type.
  Annotate contract objects, nullable values, empty collections, or complex
  expressions when needed to clarify or constrain their types.
- Supply generic type arguments when inference cannot establish the intended
  contract. Avoid repeating a type already established by an annotation or
  typed initializer. A response generic describes expected JSON; it does not
  validate the response at runtime.

```ts
interface SaveTaskInput {
  title: string;
}

export function saveTask(input: SaveTaskInput): Promise<Task> {
  const title = input.title.trim();
  const payload: SaveTaskInput = { title };
  return apiClient.post<Task>('/tasks', payload);
}
```

Here the input, payload, and return contracts are explicit; the local `title`
is inferred. The HTTP generic supplies a response type that the URL cannot infer.

## Data Shapes and Boundaries

- Prioritize consistent domain shapes, field names, units, and formats across persistence, APIs, frontend state, and forms.
- Format values for display without introducing artificial domain data. For example, do not turn a date-only value into a timestamp just to format it.
- Convert representations only at boundaries that require it. Keep necessary conversions explicit and local to that boundary, with one canonical representation for the domain value.
- Raise concerns when an existing contract or dependency would require conflicting shapes or extra adapters. Propose the simpler contract instead of silently adding conversions, duplicate representations, or compatibility layers to keep implementation moving.
- Resolve issues within the authorized scope and flag broader decisions for discussion.

Follow [Dates and Times](../workflows/date-and-time.md) for canonical date/time shapes and
the boundaries where timezone conversion is required.
