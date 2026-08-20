# Frontend state and asynchronous workflows

Keep one authoritative owner for each state value and choose the owner by lifetime and source.

## State ownership

| State | Owner |
|---|---|
| Remote lists, records, and aggregates | TanStack Query or the owning buffered-data hook |
| Authentication session | `auth/` provider and storage services |
| Persisted page controls | Page preference hook plus page-owned React state |
| Selection and modal targets | Route page or focused page hook |
| Form draft and validation | Owning modal/form workflow |
| High-frequency pointer state | Narrow interaction owner using refs |

Do not mirror remote data into unrelated local state or use refs for ordinary rendered values.

## Focused hook pattern

Use a hook when behavior owns meaningful derivation, stable-reference contracts, effects, subscriptions, or asynchronous coordination.

```tsx
function useExampleSelection(records: Example[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => records.find(record => record.id === selectedId) ?? null,
    [records, selectedId],
  );

  const syncSaved = useCallback((saved: Example) => {
    if (saved.id === selectedId) setSelectedId(saved.id);
  }, [selectedId]);

  return { selectedId, selected, select: setSelectedId, syncSaved };
}
```

Use `useMemo` and `useCallback` only for meaningful computation or an explicit downstream reference contract. Keep effect dependencies complete. Use optional values only when absence is part of the typed product contract.

## Remote and asynchronous rules

- Use stable domain query keys and include every server input.
- Pass request cancellation through typed API adapters.
- Use an existing pending or submit lock when overlap should be unavailable.
- Add serialization, revisions, or mutation queues only when overlapping work can reach the same state and a regression test demonstrates the race.
- Use refs for live non-rendering sessions and imperative caches, not as substitutes for declarative state.
- Add manual reference caches only when they materially bound downstream work and focused identity tests prove the contract.
- Give complex predicates and transitions names instead of compressing unrelated decisions.

Table row cache behavior belongs only to [table rows](../page/table-view/rows.md). Calendar buffer behavior belongs to [CalendarView](../page/calendar-view/README.md).

## State tests

Test the behavior that justifies the owner: initialization, meaningful input changes, filter semantics, loading/error state, resets, callback ordering, cleanup, and reference reuse. Test stale-response rejection or rollback only when the owner exposes overlapping paths.
