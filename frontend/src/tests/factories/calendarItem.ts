import type { ItemCalendarProps, ItemCapabilityContext } from '../../common/components/TimelineCalendar/types';

/** Produces complete interaction props for an item's record; overrides supply the behavior under test. */
export function makeItemCalendarProps<TRow, TItemData>(
  target: ItemCapabilityContext<TRow, TItemData>,
  overrides: Partial<ItemCalendarProps<TRow, TItemData>> = {},
): ItemCalendarProps<TRow, TItemData> {
  return {
    target,
    stateRef: { current: { rows: [target.row], getRowId: () => 'row-1', moveEnabled: true, resizeEnabled: true } },
    layout: {
      id: 'item-1', rowId: 'row-1', start: target.range.start, end: target.range.end,
      style: { gridColumn: '3 / 5', gridRow: 1, top: 8, height: 26 },
      density: 'normal', hideSummary: false, startsInWindow: true, endsInWindow: true,
    },
    movable: false,
    resizable: false,
    onSelect: () => undefined,
    onActivate: () => undefined,
    environment: {
      viewportRef: { current: null },
      getPeriods: () => [19, 20, 21, 22].map(day => ({
        key: `2026-08-${day}`, start: new Date(2026, 7, day), end: new Date(2026, 7, day + 1),
      })),
      periodWidth: 100, coveredLeftWidth: 0, dragEdgeSize: 40, dragScrollSpeed: 12,
      onPointerSessionRequest: () => false,
      onClickSuppressionRequest: () => undefined,
      isClickSuppressed: () => false,
    },
    onMove: () => undefined,
    onResize: () => undefined,
    ...overrides,
  };
}
