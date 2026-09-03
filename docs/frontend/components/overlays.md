# Overlays

An overlay appears above the current interface. Choose the pattern by how the user enters it and whether it blocks the page.

## Choose the overlay

| Pattern | Use it for | Behaviour |
|---|---|---|
| Modal or dialog | A focused task that must be completed or dismissed | Blocks the page and manages focus |
| Floating menu or popover | Actions or choices anchored to a control | Does not block the page |
| Tooltip | A short explanation for one control or value | Informational and not interactive |

“Popover” is the technical name for an anchored floating surface. In human-facing documentation, prefer the more specific term, such as “action menu,” “filter menu” or “date picker.” Use “floating menu” when several anchored patterns share the same rule.

## Use and test shared overlay behaviour

Use shared overlay primitives when their contracts fit. They centralize portal rendering, positioning, dismissal, keyboard behaviour and focus return. A portalled surface needs its own root CSS class because it renders outside its caller's document subtree.

The route or component that opens an overlay owns its target and open state. The overlay owns its internal interaction. Keep blocking form workflows in [Modals and forms](modals-and-forms.md).

The trigger owner tests only the target/open-state wiring, domain content, and callback values it supplies. Shared overlay component and hook tests own generic toggle, positioning, dismissal, keyboard behavior, and focus return. Consumers do not repeat those mechanics merely because they render the shared overlay.

Use jsdom for interaction contracts it can observe. Use Playwright when correctness depends on real focus trapping or return, outside-pointer behavior, portal placement, clipping, responsive layout, or pointer geometry.
