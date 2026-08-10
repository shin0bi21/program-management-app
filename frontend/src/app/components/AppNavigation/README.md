# AppNavigation

`AppNavigation` owns authenticated application navigation across desktop and mobile layouts. It is root composition under `app/`, not a generic common component.

## Contract

- Derive destination visibility from granted permissions rather than role-name checks.
- Keep route ownership aligned with `App.tsx`; do not expose destinations that are not mounted or accessible.
- Use `useFloatingMenu` and `FloatingMenuPanel` for grouped destinations so dismissal, positioning, keyboard behavior, and focus return remain shared.
- Route through the navigation hook so navigation closes mobile and floating menus consistently.
- Keep active state based on the current route family and mark both the owning group and exact child destination where applicable.
- Preserve the mobile backdrop, menu toggle semantics, and homepage logo behavior when changing navigation structure.

## Testing

Cover each permission-dependent destination, route-family active state, navigation ordering, and mobile open/close behavior. Shared floating-menu tests own generic keyboard and focus behavior; navigation tests own destination wiring and permissions.
