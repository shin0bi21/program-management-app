# React and routing

React components render the UI. Hooks own stateful behavior. React Router mounts route pages and protects authenticated destinations.

## APIs used here

| API | Use it for | Repository examples |
|---|---|---|
| `useState` | Values that change rendered output | [Tasks page](../../../frontend/src/pages/Staff/Tasks/Tasks.tsx), [Time Entry modal](../../../frontend/src/common/features/timeEntries/components/TimeEntryModal/TimeEntryModal.tsx) |
| `useMemo` | Meaningful derived work or a tested reference-stability requirement | [Task calendar data](../../../frontend/src/pages/Staff/Tasks/components/TaskCalendarView/hooks/useTaskCalendarData.ts), [virtualized periods](../../../frontend/src/common/components/ResourceCalendar/periods/useVirtualizedPeriods.ts) |
| `useCallback` | Stable callbacks that prevent downstream work or belong to another hook's dependency contract | [Task Calendar view](../../../frontend/src/pages/Staff/Tasks/components/TaskCalendarView/TaskCalendarView.tsx), [profile-note workflow](../../../frontend/src/pages/Youth/components/ProfileNotes/useProfileNotes.ts) |
| `useEffect` | Synchronization with systems outside React; always include cleanup and complete dependencies | [Lead modal reset](../../../frontend/src/pages/Outreach/Leads/components/useLeadModal.ts), [calendar position persistence](../../../frontend/src/common/components/ResourceCalendar/periods/useVirtualizedPeriods.ts) |
| `useRef` | DOM nodes and live values that must not trigger a render | [preference write queue](../../../frontend/src/common/features/preferences/hooks/useUserPreference.ts), [range-move pointer session](../../../frontend/src/common/components/ResourceCalendar/interactions/useCalendarRangeMove.ts) |
| `lazy` and `Suspense` | Authenticated route bundles and their loading fallback | [Application routes](../../../frontend/src/app/App.tsx) |
| `Routes`, `Route`, `Navigate`, and `Outlet` | Route composition, redirects, and the authenticated layout | [Application routes](../../../frontend/src/app/App.tsx) |

Use [React state](../frontend/react-state.md) for the repository's ownership rules. The complete upstream API is in the [React reference](https://react.dev/reference/react) and [React Router v6 concepts](https://reactrouter.com/docs/en/v6/start/concepts).

## Page example

Keep the route page readable by moving owned behavior into focused hooks and view components:

```tsx
export default function ExamplePage() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <main className="page-container page-container--data">
      <PageHeader
        title="Examples"
        search={<SearchInput
          label="Search examples"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />}
      />
      <PageBody
        ariaLabel="Example overview and records"
        dashboard={<ExampleDashboard selectedId={selectedId} />}
        table={<ExampleListView search={search} onSelect={setSelectedId} />}
      />
    </main>
  );
}
```

Use state for `search` because it affects rendering and requests. A ref would hide updates from React.

Use `useMemo` to derive filtered or shaped values from state. Use `useRef` only when React does not need to render the value, such as the latest pointer coordinates or a queued preference write. Do not move ordinary filters into refs to avoid renders.

## Route example

Register lazy authenticated pages in `frontend/src/app/App.tsx`:

```tsx
const Examples = lazy(() => import('../pages/Examples/Examples'));

<Route
  path="/examples"
  element={
    <ProtectedRoute requiredPermission="read:examples">
      <Examples />
    </ProtectedRoute>
  }
/>
```

Add navigation and its permission-aware tests with the route. Create an `Outlet` layout only when child routes share persistent rendered UI or state.

## Where to look

- Route composition: `frontend/src/app/App.tsx`
- Page structure: `frontend/src/pages/Staff/Tasks/Tasks.tsx`
- Stateful interaction hooks: `frontend/src/common/components/ResourceCalendar/interactions/`
- Page workflow: [Adding a frontend page](../frontend/adding-a-page.md)
