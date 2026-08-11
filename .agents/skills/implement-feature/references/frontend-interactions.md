# Frontend interaction workflow

## Own the lifecycle

- Keep interaction state and lifecycle behavior at the narrowest component that defines the interaction. Coordinate owners through typed props, callbacks, or focused context.
- Do not patch shared behavior with global body classes, document-wide DOM queries, duplicated flags, or consumer-specific checks.
- Preserve nested control semantics when a parent owns pointer gestures. Ordinary click, focus, keyboard, menu, and tooltip behavior remains with the child control.
- Define activation thresholds, cancellation, cleanup, focus return, and overlapping operations explicitly. Clean up listeners, capture, observers, animation frames, and portalled state on every completion path and unmount.

## Handle pointer and drag behavior

- Keep drag detection, thresholding, pointer capture, movement, drop, cancellation, and cleanup inside the interaction owner.
- Before adding another item geometry or interaction mode to a shared owner, inventory the existing modes and define a parity matrix for threshold, capture, ghost movement, clipping, targeting, autoscroll boundaries, cancellation, cleanup, click suppression, hover suppression, and keyboard behavior. Implement shared mechanics once and keep geometry-specific code limited to coordinate and result adapters.
- Begin pointer capture only after movement crosses the drag threshold so item-owned clicks, menus, focus, and tooltips remain intact.
- Let item components dismiss their own transient details when pointer interaction begins; prevent hover transfer during an active drag through the shared pointer lifecycle rather than page-specific suppression.
- Keep high-frequency movement outside declarative rerender paths when DOM transforms or refs can update geometry safely.
- Keep one authoritative live interaction session in a ref. React state may start or stop declarative UI, but rerenders from scrolling or virtualization must never overwrite newer pointer coordinates, preview nodes, targets, or cleanup handles with a stale state snapshot.
- Treat `pointercancel`, unmount, lost capture, and invalid targets as cancellation: remove previews, release capture, stop animation frames/listeners, restore transient classes, and never commit the mutation.
- Scope hit-testing to the owning interaction surface. A document-level `elementFromPoint` result must be verified as a descendant of the active viewport before it can become a drop target.
- Derive autoscroll boundaries from owner geometry once. Covered sticky regions such as a resource column are not part of the horizontal item zone, and consumers must not provide alternate boundary calculations.

## Verify real behavior

- Test the generic contract at its shared owner and the integration at the narrowest real consumer.
- When behavior crosses portals, nested controls, pointer capture, focus, hover, scrolling, or virtualization, add Playwright coverage using the real consumer. A synthetic button or isolated unit test is not sufficient evidence.
- For shared interaction modes, browser tests must compare sibling modes rather than testing each only for its unique callback. Assert the same threshold behavior, free ghost motion before drop-time snapping, clipping host, edge trigger, cancellation semantics, virtualization survival, and cleanup.
- Verify ordinary clicks still open actual menus/actions, pointer-down dismisses actual hover details, neighboring details stay suppressed during drag, and release/cancellation restores normal interaction.
- Cover keyboard activation, focus visibility and return, Escape/dismissal, cancellation, unmount cleanup, scroll geometry, and mobile pointer behavior where applicable.
