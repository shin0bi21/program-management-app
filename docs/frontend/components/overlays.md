# Overlays

An overlay appears above the current interface. Choose the pattern by how the user enters it and whether it blocks the page.

## Choose the overlay

| Pattern | Use it for | Behaviour |
|---|---|---|
| Modal or dialog | A focused task that must be completed or dismissed | Blocks the page and manages focus |
| Floating menu or popover | Actions or choices anchored to a control | Does not block the page |
| Tooltip | A short explanation for one control or value | Informational and not interactive |

“Popover” is the technical name for an anchored floating surface. In human-facing documentation, prefer the more specific term, such as “action menu,” “filter menu” or “date picker.” Use “floating menu” when several anchored patterns share the same rule.

## Use shared overlay behaviour

Use shared overlay primitives when their contracts fit. They centralize portal rendering, positioning, dismissal, keyboard behaviour and focus return. A portalled surface needs its own root CSS class because it renders outside its caller's document subtree.

Anchored forms use `FloatingMenuPanel` with `keyboardMode="form"` and an accessible label. This exposes a dialog, preserves native input editing and Tab between controls, and keeps Escape dismissal. Option-only menus retain menu keyboard navigation.

The route or component that opens an overlay owns its target and open state. The overlay owns its internal interaction. Keep blocking form workflows in [Modals and forms](modals-and-forms.md).

## Filter menus

`FilterCard` owns the trigger, popup, category list, navigation, and Clear all. `FilterCategoryCard` owns each category’s local checklist draft, back arrow, title, and Clear/Apply footer. Inactive categories stay mounted during an open filter session so Back preserves drafts; closing the popup discards unapplied edits. Pages own applied values.

Applying or clearing filters keeps the popup and current category open, including
when refreshed table or calendar results change their scroll position. The user
can continue adjusting filters or dismiss the popup with its trigger, Escape,
or an outside click.

## Testing

Test target, open-state and callback wiring at the trigger. Shared overlay tests own
positioning, dismissal, keyboard behavior and focus return. Use browser tests when correctness
depends on portal placement, clipping or real pointer and focus behavior. See
[Testing](../../workflows/testing.md).
