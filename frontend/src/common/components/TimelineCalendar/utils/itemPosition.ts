import type { CalendarPeriod, ItemRange, ItemDensity } from '../types';

export interface PositionedItem<TItemData> {
  // Source record
  item: TItemData;
  range: ItemRange;

  // Visible placement
  startIndex: number;
  endIndex: number;
  lane: number;
  laneCount: number;
}

type VisibleItem<TItemData> = Omit<PositionedItem<TItemData>, 'lane' | 'laneCount'>;
type LaneItem<TItemData> = Omit<PositionedItem<TItemData>, 'laneCount'>;

/** Produces density for overlapping lanes; e.g. six lanes use dense presentation. */
export function getItemDensity(laneCount: number): ItemDensity {
  if (laneCount >= 6) return 'dense';
  if (laneCount >= 4) return 'compact';
  return 'normal';
}

/**
 * Positions visible records in overlap lanes while preserving their original ranges.
 * Requires: periods are ordered by key and item ranges use comparable inclusive keys.
 * Example: an item beginning before the visible range starts in column zero but keeps its original start key.
 */
export function positionItems<TItemData>(
  items: readonly TItemData[],
  periods: readonly CalendarPeriod[],
  getItemRange: (item: TItemData) => ItemRange,
): PositionedItem<TItemData>[] {
  const visibleItems = clipVisibleItems(items, periods, getItemRange);
  const laneItems = assignOverlapLanes(visibleItems);

  return addOverlapLaneCounts(laneItems);
}

/** Clips visible indices and orders records by start, placing longer equal-start records first. */
function clipVisibleItems<TItemData>(
  items: readonly TItemData[],
  periods: readonly CalendarPeriod[],
  getItemRange: (item: TItemData) => ItemRange,
): VisibleItem<TItemData>[] {
  return items.flatMap(item => {
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
  }).sort((left, right) => left.startIndex - right.startIndex || right.endIndex - left.endIndex);
}

/** Assigns the first free lane among items whose inclusive ranges overlap. */
function assignOverlapLanes<TItemData>(items: readonly VisibleItem<TItemData>[]): LaneItem<TItemData>[] {
  const positioned: LaneItem<TItemData>[] = [];

  items.forEach(item => {
    const occupiedLanes = positioned
      .filter(prior => prior.endIndex >= item.startIndex)
      .map(prior => prior.lane);
    let lane = 0;

    while (occupiedLanes.includes(lane)) lane += 1;

    positioned.push({ ...item, lane });
  });

  return positioned;
}

/** Gives every item the lane count of its connected overlap group. */
function addOverlapLaneCounts<TItemData>(items: readonly LaneItem<TItemData>[]): PositionedItem<TItemData>[] {
  const result: PositionedItem<TItemData>[] = [];
  let groupStart = 0;

  while (groupStart < items.length) {
    let groupEnd = groupStart + 1;
    let latestEnd = items[groupStart]!.endIndex;

    while (groupEnd < items.length && items[groupEnd]!.startIndex <= latestEnd) {
      latestEnd = Math.max(latestEnd, items[groupEnd]!.endIndex);
      groupEnd += 1;
    }

    const group = items.slice(groupStart, groupEnd);
    const laneCount = group.reduce((count, item) => Math.max(count, item.lane + 1), 0);

    group.forEach(item => result.push({ ...item, laneCount }));
    groupStart = groupEnd;
  }

  return result;
}
