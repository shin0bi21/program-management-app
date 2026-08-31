# App navigation

`frontend/src/app/components/AppNavigation/` owns the application sidebar, mobile navigation shell, and the visible path into each navigable application route. It is an application-shell component, not a route page and not a product-agnostic common component.

## Assign navigation ownership

| Owner | Responsibility |
|---|---|
| `App.tsx` | Lazy route mounting and `ProtectedRoute` authorization. |
| `useAppNavigation` | Permission-derived capabilities, active-route state, menu coordination, navigation cleanup, and closing menus when the location changes. |
| `AppNavigation` | Destination labels, grouping and order; authenticated and public actions; desktop sidebar and mobile trigger/backdrop rendering. |
| Route page | The workflow rendered after navigation. It does not own its sidebar entry. |

Keep route authorization and navigation visibility aligned with the same backend-defined permission. Group visibility is derived from its visible children: for example, Staff is visible when the user can read Hours or Tasks. An active group follows the current route family, while an active menu item matches its canonical destination.

Desktop and mobile navigation expose one destination contract. Selecting a destination closes the mobile sidebar and every open flyout. A location change also closes stale flyouts. The logo returns to the public homepage; authentication actions remain in the navigation footer.

## Add or change a visible application destination

1. Mount the lazy route in `frontend/src/app/App.tsx` and protect it with the backend-aligned required permission.
2. Derive its destination visibility and any parent-group capability in `useAppNavigation`.
3. Render the exact canonical URL under the correct group and order in `AppNavigation`.
4. Update navigation-owner tests for capability, visibility, active state, ordering, and navigation.
5. Keep the route-page test focused on the page workflow rather than sidebar behavior.

Public authentication routes and redirect-only aliases remain route concerns and intentionally skip navigation registration.

Use `useFloatingMenu` and `FloatingMenuPanel` for flyouts. Those shared owners provide positioning, focus, keyboard navigation, outside/Escape dismissal, and focus return. App navigation owns only which menu is open, its domain destinations, and the callbacks and anchor refs passed to the shared primitives.

## Test app navigation

`useAppNavigation.test.tsx` owns permission capability derivation, group aggregation, route-family and exact-path activity, mutually exclusive menu coordination, closing after navigation or location changes, and mobile-state cleanup where those behaviors live in the hook.

`AppNavigation.test.tsx` owns representative authenticated and unauthenticated navigation trees, destination labels/grouping/order, capability values reaching the rendered controls, exact path navigation, homepage/login/logout actions, and mobile open/backdrop wiring. It does not repeat shared floating-menu positioning, dismissal, focus, or keyboard tests.

For example, the hook test proves that `read:tasks` enables both Tasks and its Staff group. The component test proves that Staff destinations follow their capability and canonical URL, while the Tasks route test does not assert its sidebar entry.

Use Playwright only when correctness depends on the responsive breakpoint, real sidebar layout, clipping, or portal/focus geometry. The cross-cutting [testing guide](../../../workflows/testing.md#frontend-test-ownership) owns runner selection and the narrowest-owner rule.
