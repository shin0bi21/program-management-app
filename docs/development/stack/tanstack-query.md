# TanStack Query

TanStack Query owns remote frontend state. Components should not copy API results into a second `useState` store.

## Typed API adapters

Put paths, request parameters, and response types in a page- or feature-owned `.api.ts` file. Route every request through `apiClient`:

```ts
export function getExampleList(
  filters: ExampleFilters,
  pagination: CursorRequest,
  opts?: RequestOptions,
) {
  const params = new URLSearchParams({
    search: filters.search,
    sort: pagination.key,
    direction: pagination.direction,
    limit: String(pagination.limit ?? 25),
  });
  if (pagination.cursor) params.set('cursor', pagination.cursor);
  return apiClient.get<CursorPage<Example>>(`/examples/list?${params}`, opts);
}

export function setExample(input: SetExampleInput, id?: string) {
  return id
    ? apiClient.put<Example>(`/examples/${id}`, input)
    : apiClient.post<Example>('/examples', input);
}
```

The shared client owns authentication, token refresh, timeouts, request cancellation, request IDs, and typed errors. Feature code must not call `fetch` directly.

## Query keys and reads

Give each remote list a stable prefix that matches only that list's cache entries. Put it in the page or feature's query-key file so reads and mutations use the same value:

```ts
export const EXAMPLE_LIST_QUERY_KEY = ['examples', 'list'] as const;
```

Every server input belongs after that prefix. Pass the query signal to the API adapter so stale work can be cancelled.

```tsx
const query = useQuery({
  queryKey: [...EXAMPLE_LIST_QUERY_KEY, { search, status }],
  queryFn: ({ signal }) => getExamples({ search, status }, { signal }),
  enabled: controlsReady,
});
```

Use `isLoading` for the first load. Use `isFetching` when already-rendered data is refreshing. Convert errors with `getErrorMessage` at the owning hook or page.

The upstream references are [useQuery](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery), [query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), and [infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries).

## Cursor-paginated lists

Use the shared `useInfiniteListQuery` wrapper for remote tables:

```tsx
const list = useInfiniteListQuery({
  queryKey: [...EXAMPLE_LIST_QUERY_KEY, { search, sorting, filters }],
  queryFn: ({ pageParam, signal }) => getExampleList(
    { ...filters, search },
    { ...sorting, cursor: pageParam, limit: 25 },
    { signal },
  ),
  errorMessage: 'Could not load examples',
});
```

The wrapper deduplicates rows and exposes load-more state. Mutation owners update or invalidate its global cache through `QueryClient`; they do not reach through the mounted list hook.

## Mutations and cache updates

The mutation owner uses `QueryClient` and the domain's stable list-key prefix. Invalidate server-filtered cursor lists by default:

```tsx
await setExample(input, id);
await queryClient.invalidateQueries({ queryKey: EXAMPLE_LIST_QUERY_KEY });
```

If one backend command changes several domains, invalidate each changed domain. For example, signing up a Lead also creates a Youth profile and may change Cohort enrollment. Invalidating an inactive query marks it stale; it does not immediately fetch a page that is not mounted.

Direct replacement is safe only when the response is the canonical list row and the mutation cannot change filter membership or sorted position:

```tsx
replaceInfiniteListRow(queryClient, EXAMPLE_LIST_QUERY_KEY, saved);
```

After a confirmed delete, `removeInfiniteListRow` removes the row from every cached filter/sort variant under the prefix. Do not append a created row or replace a membership-changing row merely because the mutation returned data. Keep custom calendar buffers and other non-TanStack owners behind their own narrow adapters.

## Queries and mutations in a modal

Do not use TanStack Query for the modal's open state, draft fields, validation errors, or selected controls. Those belong to React state or React Hook Form.

Use `useQuery` when the modal needs server data that its caller does not already have, such as dependent options. Put the query in the modal's focused hook, or in the modal component while it remains small:

```tsx
const taskQuery = useQuery({
  queryKey: ['tasks', 'options', { staffId }],
  queryFn: ({ signal }) => getAvailableTasks(staffId, { signal }),
  enabled: isOpen && Boolean(staffId),
});
```

Include every server input in the key, pass the cancellation signal, and use `enabled` so a closed or incomplete modal does not request data. If the caller already has the complete record being edited, pass it into the modal instead of fetching it again.

Use one of the two established modal boundaries.

For a form owned by one page, the modal hook calls the typed API and returns the authoritative record through `onSuccess`. The page passes that result to its mutation/cache coordinator:

```tsx
<ExampleModal
  isOpen={editorOpen}
  example={selectedExample}
  onSuccess={saved => {
    reconcileExample(saved);
    setEditorOpen(false);
  }}
/>
```

The modal hook performs the request:

```tsx
const onValid = async (input: SetExampleInput) => {
  try {
    const saved = await setExample(input, example?.id);
    onSuccess(saved);
  } catch (cause) {
    setError(getErrorMessage(cause, 'Could not save example'));
  }
};
```

For a shared contextual modal, pass an async mutation callback from the owner:

```tsx
<TimeEntryModal
  isOpen={editorOpen}
  onAdd={async input => {
    const saved = await setTimeEntry(input, selectedEntry?.id);
    reconcileTimeEntry(saved);
  }}
/>
```

The modal owns draft, submit, and error state. The caller owns the mutation when it must coordinate multiple page views. Do not split one mutation's cache rules between both owners.

## Preferences

`useUserPreference` also uses TanStack Query. Pass a complete typed preference value to `save`, including the first time a user changes a control:

```tsx
preference.save({
  view,
  filters,
  sorting,
  columnWidths,
  hiddenColumns,
});
```

## Where to look

- Query client: `frontend/src/query/queryClient.ts`
- Typed endpoint adapter: `frontend/src/common/features/tasks/api/tasks.api.ts`
- HTTP client: `frontend/src/http/client.ts`
- Standard list query: `frontend/src/query/hooks/useListQuery.ts`
- Infinite list query: `frontend/src/query/hooks/useInfiniteListQuery.ts`
- Infinite list cache helpers: `frontend/src/query/infiniteListCache.ts`
- Preferences: `frontend/src/common/features/preferences/hooks/useUserPreference.ts`
- Modal option queries: `frontend/src/common/features/timeEntries/components/TimeEntryModal/TimeEntryModal.tsx`
- Page-owned modal request: `frontend/src/pages/Settings/Users/components/AccountModal/useAccountModal.ts`
- Owner-supplied modal mutation: `frontend/src/common/features/timeEntries/components/TimeEntryModal/TimeEntryModal.tsx`
- List rules: [List views](../frontend/list-view.md)
