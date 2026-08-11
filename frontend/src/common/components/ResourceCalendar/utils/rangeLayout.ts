import type { CalendarPeriod, ItemRange } from '../types';

export interface PositionedRange<TItemData> {
  item: TItemData;
  range: ItemRange;
  startIndex: number;
  endIndex: number;
  lane: number;
}

export function layoutRangeItems<TItemData>(
  items: readonly TItemData[],
  periods: readonly CalendarPeriod[],
  getItemRange: (item: TItemData) => ItemRange,
) {
  const visible = items.flatMap(item => {
    const range = getItemRange(item);
    const startIndex = periods.findIndex(period => period.key >= range.start);
    let endIndex = -1;
    for (let index = periods.length - 1; index >= 0; index -= 1) {
      if (periods[index].key <= range.end) {
        endIndex = index;
        break;
      }
    }
    return startIndex >= 0 && endIndex >= 0 && startIndex <= endIndex
      ? [{ item, range, startIndex, endIndex }]
      : [];
  }).sort((left, right) => left.startIndex - right.startIndex || left.endIndex - right.endIndex);

  const positioned: Array<PositionedRange<TItemData>> = [];
  visible.forEach(item => {
    const occupiedLanes = positioned
      .filter(prior => prior.endIndex >= item.startIndex)
      .map(prior => prior.lane);
    let lane = 0;
    while (occupiedLanes.includes(lane)) lane += 1;
    positioned.push({ ...item, lane });
  });

  return positioned;
}
