import type { CalendarPeriod, ItemRange } from '../types';

export interface PositionedItem<TItemData> {
  item: TItemData;
  range: ItemRange;
  startIndex: number;
  endIndex: number;
  lane: number;
  laneCount: number;
}

export type ItemDensity = 'normal' | 'compact' | 'dense';

export function getItemDensity(itemCount: number): ItemDensity {
  if (itemCount >= 6) return 'dense';
  if (itemCount >= 4) return 'compact';
  return 'normal';
}

export function positionItems<TItemData>(
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

    const isVisible = startIndex >= 0 && endIndex >= 0 && startIndex <= endIndex;

    return isVisible ? [{ item, range, startIndex, endIndex }] : [];
  }).sort((left, right) => left.startIndex - right.startIndex || left.endIndex - right.endIndex);

  const positioned: Array<Omit<PositionedItem<TItemData>, 'laneCount'>> = [];
  visible.forEach(item => {
    const occupiedLanes = positioned
      .filter(prior => prior.endIndex >= item.startIndex)
      .map(prior => prior.lane);
    let lane = 0;
    while (occupiedLanes.includes(lane)) lane += 1;
    positioned.push({ ...item, lane });
  });

  const result: Array<PositionedItem<TItemData>> = [];
  let groupStart = 0;
  while (groupStart < positioned.length) {
    let groupEnd = groupStart + 1;
    let latestEnd = positioned[groupStart]!.endIndex;
    while (groupEnd < positioned.length && positioned[groupEnd]!.startIndex <= latestEnd) {
      latestEnd = Math.max(latestEnd, positioned[groupEnd]!.endIndex);
      groupEnd += 1;
    }
    const laneCount = positioned
      .slice(groupStart, groupEnd)
      .reduce((count, item) => Math.max(count, item.lane + 1), 0);
    positioned.slice(groupStart, groupEnd).forEach(item => result.push({ ...item, laneCount }));
    groupStart = groupEnd;
  }

  return result;
}
