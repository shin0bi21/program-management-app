# ResourceCalendar

`ResourceCalendar` owns generic resource-by-period rendering, navigation, virtualization, overflow, drag interactions, and optional resource selection. Business data loading, permissions, mutations, and selection-driven content remain with the consuming page.

## Resource selection

- Pass `selectedResourceId` and `onResourceSelect` together for controlled selection.
- Selection is activated from the sticky resource-name control. Date cells and calendar items retain their own click behavior.
- The calendar supplies the selected-row presentation and accessible pressed state. The consumer owns what selecting a resource means and whether selection is available to the current user.
- Use durable IDs returned by `getResourceId`; do not use array indexes as selection state.

## Interaction ownership

- Keep item rendering and domain actions in `buildItem` and the page-level callbacks.
- Use `onCellClick` for period-cell actions and `onResourceSelect` for resource-level actions; do not make both callbacks compete for the same pointer target.
- Treat `isItemDraggable` and `canDropItem` as UI eligibility only. Consumers must preserve authorization and domain validation in their mutation path.
