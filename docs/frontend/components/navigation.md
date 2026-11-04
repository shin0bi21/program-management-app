# App Navigation

`frontend/src/app/components/AppNavigation/` owns the application sidebar, mobile navigation shell, and the visible path into each navigable application route. It is an application-shell component, not a route page and not a product-agnostic common component.

## Assign Navigation Ownership

| Owner | Responsibility |
|---|---|
| `App.tsx` | Lazy route mounting and `ProtectedRoute` authorization. |
| `useAppNavigation` | Permission-derived capabilities, active-route state, menu coordination, navigation cleanup, and closing menus when the location changes. |
| `AppNavigation` | Destination labels, grouping and order; authenticated and public actions; desktop sidebar and mobile trigger/backdrop rendering. |
| Route page | The workflow rendered after navigation. It does not own its sidebar entry. |

Keep route authorization and navigation visibility aligned with the same backend-defined permission. Group visibility is derived from its visible children: for example, Staff is visible when the user can read Hours or Tasks. An active group follows the current route family, while an active menu item matches its canonical destination.

Desktop and mobile navigation expose one destination contract. Selecting a destination closes the mobile sidebar and every open flyout. A location change also closes stale flyouts. The logo returns to the public homepage; authentication actions remain in the navigation footer.

## Add or Change a Visible Application Destination

1. Mount the lazy route in `frontend/src/app/App.tsx` and protect it with the backend-aligned required permission.
2. Derive its destination visibility and any parent-group capability in `useAppNavigation`.
3. Render the exact canonical URL under the correct group and order in `AppNavigation`.
4. Update navigation-owner tests for capability, visibility, active state, ordering, and navigation.
5. Keep the route-page test focused on the page workflow rather than sidebar behavior.

Programming contains Programs (`/programming/programs`, `read:programs`) and Sessions
(`/programming/sessions`, `read:sessions`). Its group is visible with either capability.
Program/cycle edit actions require `write:programs`; they are not a Settings destination.
Legacy calendar, cohort, and programming-settings URLs redirect to the matching page,
whose canonical route enforces read access. The public `/programming` homepage section
remains separate.

Public authentication routes and redirect-only aliases remain route concerns and intentionally skip navigation registration.

Homepage is a direct top-level navigation item above Settings that opens image
management at `/homepage/images`. Viewing requires `read:homepage`; editing
requires `write:homepage`. The former `/homepage/manage` URL redirects to Images.
The image workflow belongs to `pages/Homepage/Images/`.

Use `useFloatingMenu` and `FloatingMenuPanel` for flyouts. Those shared owners provide positioning, focus, keyboard navigation, outside/Escape dismissal, and focus return. App navigation owns only which menu is open, its domain destinations, and the callbacks and anchor refs passed to the shared primitives.

## Testing

`useAppNavigation.test.tsx` covers permission-derived groups, active routes and menu cleanup.
`AppNavigation.test.tsx` covers destination labels and order, visibility, exact URLs,
authentication actions and mobile controls. Keep sidebar assertions here rather than in
route-page tests. Shared floating-menu tests own their mechanics; use browser tests for
responsive layout, clipping and focus geometry. See
[Testing](../../workflows/delivery/testing.md#frontend-test-ownership).
