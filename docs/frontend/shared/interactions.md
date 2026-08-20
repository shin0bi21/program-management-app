# Frontend shared interactions

Keep focus, portal, pointer, keyboard, and browser lifecycle behavior at the narrowest component that defines the interaction. Coordinate owners through typed props, callbacks, or focused context.

## Lifecycle pattern

```tsx
function useOwnedInteraction(target: RefObject<HTMLElement>) {
  useEffect(() => {
    const element = target.current;
    if (!element) return;

    const cancel = () => finishInteraction({ commit: false });
    element.addEventListener('pointercancel', cancel);
    return () => {
      element.removeEventListener('pointercancel', cancel);
      finishInteraction({ commit: false });
    };
  }, [target]);
}
```

The example is structural: setup and cleanup share one owner, and every cancellation path restores the same invariants.

## Interaction rules

- Preserve nested control click, focus, keyboard, menu, and tooltip semantics when a parent owns pointer gestures.
- Define activation thresholds, cancellation, cleanup, focus return, and overlapping operations explicitly.
- Clean up listeners, capture, observers, animation frames, previews, and portalled state on every completion path and unmount.
- Begin pointer capture only after deliberate movement crosses the shared threshold.
- Keep high-frequency movement out of declarative rerender paths when refs and DOM transforms safely own geometry.
- Keep one authoritative live interaction session; rerenders and virtualization must not overwrite it with stale state.
- Mutually exclusive drag/move/resize modes share one session coordinator.
- Treat `pointercancel`, lost capture, invalid targets, and unmount as cancellation; only a valid release commits.
- Scope hit-testing and autoscroll boundaries to the owning viewport.
- Reuse shared floating and modal primitives rather than adding document-wide queries, body classes, or consumer-specific portal logic.

## Interaction tests

Unit tests own lifecycle and callback behavior that jsdom can establish. Use Playwright with a real consumer for focus geometry, portals, nested controls, pointer capture, scrolling, virtualization, clipping, drag/drop, resize, cancellation, and mobile behavior. When one shared owner supports multiple interaction modes, browser tests compare their threshold, preview, autoscroll, cancellation, and cleanup parity.
