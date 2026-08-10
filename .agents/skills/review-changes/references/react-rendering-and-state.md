# React Rendering and State

For interactive grids, calendars, canvases, large lists, drag/drop surfaces, and other render-sensitive changes, review:

- render fan-out during pointer movement, scrolling, resizing, filtering, selection, and mutations;
- whether virtualization bounds work at the largest supported viewport;
- whether high-frequency transient values that do not affect declarative UI stay in refs;
- whether `React.memo`, `useMemo`, and `useCallback` have stable inputs and prevent meaningful work instead of being decorative;
- whether updates preserve unaffected object and array references;
- whether independently changing rows, cells, overlays, and controls have focused components or hooks;
- whether large-fixture or render-count tests demonstrate intended render scope.

Do not infer performance from functional test success alone. When profiling is unavailable, require structural evidence plus targeted performance-sensitive tests.

## Time-based behavior

Review local-calendar arithmetic across daylight-saving transitions, leap days, month boundaries, and year boundaries. Calculate day/week/month boundaries as calendar units rather than fixed millisecond durations, and preserve date-only values across persistence, API, state, and rendering.

## Buffered, optimistic, and realtime state

Review overlapping loads and mutations, out-of-order responses, repeated same-item updates, rollback order, reset during loading, and deletion tombstones. Require an explicit reconciliation policy—such as item revisions, serialization, or cancellation—and tests showing stale responses cannot overwrite newer client or database state.

## Effects and external lifecycles

Verify complete dependency sets, symmetric setup/cleanup, stable event boundaries, and removal of listeners or observers on every completion path. Keep query definitions declarative; place subscriptions, cancellation bridges, and browser observers in named helpers or hooks when they form a coherent lifecycle.
