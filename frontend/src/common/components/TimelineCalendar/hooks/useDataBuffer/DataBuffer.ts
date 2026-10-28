import type { CalendarPeriod, RowPeriodData } from '../../types';
import { addDays, buildDayPeriod } from '../../utils/periods';

export type BufferDirection = 'initial' | 'left' | 'right';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RUNWAY_DAYS = 42;
const DEFAULT_REPLENISH_THRESHOLD_DAYS = 21;
const DEFAULT_REPLENISH_DAYS = 21;

export interface PeriodBufferAdapter {
  shift: (period: CalendarPeriod, amount: number) => CalendarPeriod;
  distance: (start: CalendarPeriod, end: CalendarPeriod) => number;
  includes: (start: CalendarPeriod, end: CalendarPeriod, periodKey: string) => boolean;
  getRangeAnchor: (
    range: { start: string; end: string },
    start: CalendarPeriod,
    end: CalendarPeriod,
  ) => string | undefined;
}

export const dayPeriodBufferAdapter: PeriodBufferAdapter = {
  shift: (period, amount) => buildDayPeriod(addDays(period.start, amount)),
  // Compare local dates as UTC ordinals so 23- and 25-hour DST days still count as one period.
  distance: (start, end) => (
    (Date.UTC(end.start.getFullYear(), end.start.getMonth(), end.start.getDate())
      - Date.UTC(start.start.getFullYear(), start.start.getMonth(), start.start.getDate())) / DAY_MS
  ),
  includes: (start, end, periodKey) => periodKey >= start.key && periodKey <= end.key,
  getRangeAnchor: (range, start, end) => {
    if (range.start > end.key || range.end < start.key) return undefined;
    if (range.start < start.key) return start.key;
    return range.start;
  },
};

export interface PeriodRange {
  start: CalendarPeriod;
  end: CalendarPeriod;
  direction: BufferDirection;
}

export interface DataBufferOptions<TItemData> {
  // Data loading
  initialData?: RowPeriodData<TItemData>;
  load: (range: PeriodRange) => Promise<RowPeriodData<TItemData>>;
  onData: (data: RowPeriodData<TItemData>) => void;

  // Item identity and ranges
  getItemId?: (item: TItemData) => string;
  getItemRange?: (item: TItemData) => { start: string; end: string };

  // Period buffering
  adapter?: PeriodBufferAdapter;
  targetSize?: number;
  threshold?: number;
  replenishSize?: number;
  maxRetainedPeriods?: number;
}

interface ItemOverride<TItemData> {
  // Reconciliation tracking
  revision: number;
  pendingPeriodKeys: Set<string>;

  // Overridden item placement
  rowId?: string;
  periodKey?: string;
  item?: TItemData;
  range?: { start: string; end: string };
}

interface ItemLocation {
  rowId: string;
  periodKey: string;
  range?: { start: string; end: string };
}

/**
 * Loads ranges around the rendered window and reconciles optimistic item changes.
 * Requires a stable item ID for mutation methods; range-aware items need `getItemRange`.
 * Example: initialize(periods), then periodsBuilt(nextPeriods, 'right') as scrolling continues.
 */
export class DataBuffer<TItemData> {
  private readonly load: DataBufferOptions<TItemData>['load'];
  private readonly onData: DataBufferOptions<TItemData>['onData'];
  private readonly targetSize: number;
  private readonly threshold: number;
  private readonly replenishSize: number;
  private readonly maxRetainedPeriods: number;
  private readonly getItemId?: (item: TItemData) => string;
  private readonly getItemRange?: (item: TItemData) => { start: string; end: string };
  private readonly adapter: PeriodBufferAdapter;
  private readonly itemOverrides = new Map<string, ItemOverride<TItemData>>();
  private readonly itemLocations = new Map<string, ItemLocation>();
  private mutationRevision = 0;
  private data: RowPeriodData<TItemData>;
  private renderedStart: CalendarPeriod | null = null;
  private renderedEnd: CalendarPeriod | null = null;
  private loadedStart: CalendarPeriod | null = null;
  private loadedEnd: CalendarPeriod | null = null;
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private queues: Record<'left' | 'right', Promise<void>> = {
    left: Promise.resolve(),
    right: Promise.resolve(),
  };

  /** function Object() { [native code] } */
  constructor(options: DataBufferOptions<TItemData>) {
    this.load = options.load;
    this.onData = options.onData;
    this.data = options.initialData ?? {};
    this.targetSize = options.targetSize ?? DEFAULT_RUNWAY_DAYS;
    this.threshold = options.threshold ?? DEFAULT_REPLENISH_THRESHOLD_DAYS;
    this.replenishSize = options.replenishSize ?? DEFAULT_REPLENISH_DAYS;
    this.maxRetainedPeriods = options.maxRetainedPeriods ?? 250;
    this.getItemId = options.getItemId;
    this.getItemRange = options.getItemRange;
    this.adapter = options.adapter ?? dayPeriodBufferAdapter;
    this.rebuildItemIndex();
  }

  /** Starts the initial window load once, sharing an in-flight initialization. */
  initialize(renderedPeriods: readonly CalendarPeriod[]): Promise<void> {
    if (this.initialized || !renderedPeriods.length) return Promise.resolve();
    if (this.initializing) return this.initializing;

    this.initializing = this.runInitialization(renderedPeriods);

    return this.initializing;
  }

  /** Waits for pending loads, then rebuilds the buffer around a replacement window. */
  async reset(renderedPeriods: readonly CalendarPeriod[]): Promise<void> {
    if (!renderedPeriods.length) return;

    if (this.initializing) await this.initializing.catch(() => undefined);
    await Promise.all(Object.values(this.queues).map(queue => queue.catch(() => undefined)));

    this.initialized = false;
    this.renderedStart = null;
    this.renderedEnd = null;
    this.loadedStart = null;
    this.loadedEnd = null;
    this.queues = { left: Promise.resolve(), right: Promise.resolve() };

    await this.initialize(renderedPeriods);
  }

  /** Queues directional replenishment as scrolling exposes new periods. */
  periodsBuilt(periods: readonly CalendarPeriod[], direction: 'left' | 'right'): Promise<void> {
    if (!periods.length) return Promise.resolve();

    if (direction === 'left') this.renderedStart = periods[0];
    else this.renderedEnd = periods[periods.length - 1];

    const initialization = this.initializing;

    // Virtualization can publish new edges while initialization is still loading.
    this.queues[direction] = this.queues[direction]
      .catch(() => undefined)
      .then(async () => {
        await initialization?.catch(() => undefined);
        await this.replenishIfNeeded(direction);
      });

    return this.queues[direction];
  }

  /** Applies a saved record locally while guarding it against stale loads. */
  upsertItem(rowId: string, periodKey: string, item: TItemData): void {
    const getItemId = this.getItemId;

    if (!getItemId) throw new Error('getItemId is required for item mutations');

    const itemId = getItemId(item);
    const previousOverride = this.itemOverrides.get(itemId);
    const previousLocation = this.itemLocations.get(itemId);

    const pendingPeriodKeys = new Set(previousOverride?.pendingPeriodKeys);
    if (previousLocation) pendingPeriodKeys.add(previousLocation.periodKey);
    pendingPeriodKeys.add(periodKey);

    const revision = this.mutationRevision + 1;
    const range = this.getItemRange?.(item);
    const anchoredPeriodKey = this.getRangeAnchor(range, periodKey);

    this.mutationRevision = revision;
    this.itemOverrides.set(itemId, {
      revision,
      pendingPeriodKeys,
      rowId,
      periodKey: anchoredPeriodKey,
      item,
      range,
    });

    this.placeIndexedItem(rowId, anchoredPeriodKey, item);
    this.onData(this.data);
  }

  /** Removes a record locally and retains its delete override until acknowledged. */
  removeItem(itemId: string): void {
    if (!this.getItemId) throw new Error('getItemId is required for item mutations');

    const previousOverride = this.itemOverrides.get(itemId);
    const previousLocation = this.itemLocations.get(itemId);

    const pendingPeriodKeys = new Set(previousOverride?.pendingPeriodKeys);
    if (previousLocation) pendingPeriodKeys.add(previousLocation.periodKey);

    const revision = this.mutationRevision + 1;

    this.mutationRevision = revision;
    this.itemOverrides.set(itemId, {
      revision,
      pendingPeriodKeys,
      range: previousLocation?.range,
    });

    this.removeIndexedItem(itemId);
    this.onData(this.data);
  }

  /** Load the initial runway before publishing its bounds as initialized. */
  private async runInitialization(renderedPeriods: readonly CalendarPeriod[]): Promise<void> {
    const renderedStart = renderedPeriods[0];
    const renderedEnd = renderedPeriods[renderedPeriods.length - 1];

    const loadedStart = this.adapter.shift(renderedStart, -this.targetSize);
    const loadedEnd = this.adapter.shift(renderedEnd, this.targetSize);
    const initialSize = this.adapter.distance(loadedStart, loadedEnd) + 1;

    if (this.maxRetainedPeriods < initialSize) {
      throw new RangeError(`maxRetainedPeriods must be at least ${initialSize} for the initial buffer`);
    }

    try {
      await this.loadAndMerge({ start: loadedStart, end: loadedEnd, direction: 'initial' });

      this.renderedStart ??= renderedStart;
      this.renderedEnd ??= renderedEnd;
      this.loadedStart = loadedStart;
      this.loadedEnd = loadedEnd;
      this.initialized = true;
      this.pruneToLoadedRange();
    } catch (error) {
      this.initialized = false;
      throw error;
    } finally {
      this.initializing = null;
    }
  }

  /** Extends or replaces the loaded runway when a rendered edge reaches its threshold. */
  private async replenishIfNeeded(direction: 'left' | 'right'): Promise<void> {
    if (!this.loadedStart || !this.loadedEnd || !this.renderedStart || !this.renderedEnd) return;

    if (direction === 'left') {
      const remaining = this.adapter.distance(this.loadedStart, this.renderedStart);

      if (remaining > this.threshold) return;

      if (remaining < 0) {
        const nextStart = this.adapter.shift(this.renderedStart, -this.targetSize);
        const nextEnd = this.adapter.shift(this.renderedStart, this.targetSize);

        await this.loadAndMerge({ start: nextStart, end: nextEnd, direction });

        this.loadedStart = nextStart;
        this.loadedEnd = nextEnd;
        this.pruneToLoadedRange();

        return;
      }

      const previousStart = this.loadedStart;
      const nextStart = this.adapter.shift(previousStart, -this.replenishSize);

      await this.loadAndMerge({
        start: nextStart,
        end: this.adapter.shift(previousStart, -1),
        direction,
      });

      this.loadedStart = nextStart;
      this.trimRetainedData('left');

      return;
    }

    const remaining = this.adapter.distance(this.renderedEnd, this.loadedEnd);

    if (remaining > this.threshold) return;

    if (remaining < 0) {
      const nextStart = this.adapter.shift(this.renderedEnd, -this.targetSize);
      const nextEnd = this.adapter.shift(this.renderedEnd, this.targetSize);

      await this.loadAndMerge({ start: nextStart, end: nextEnd, direction });

      this.loadedStart = nextStart;
      this.loadedEnd = nextEnd;
      this.pruneToLoadedRange();

      return;
    }

    const previousEnd = this.loadedEnd;
    const nextEnd = this.adapter.shift(previousEnd, this.replenishSize);

    await this.loadAndMerge({
      start: this.adapter.shift(previousEnd, 1),
      end: nextEnd,
      direction,
    });

    this.loadedEnd = nextEnd;
    this.trimRetainedData('right');
  }

  /** Loads one range and acknowledges only mutation overrides covered by that request. */
  private async loadAndMerge(range: PeriodRange): Promise<void> {
    const requestRevision = this.mutationRevision;
    const incoming = await this.load(range);

    // A response acknowledges only overrides it covered and that existed when its request began.
    this.itemOverrides.forEach((override, itemId) => {
      if (override.revision > requestRevision) return;

      if (this.getItemRange && override.range) {
        if (this.adapter.getRangeAnchor(override.range, range.start, range.end) !== undefined) {
          this.itemOverrides.delete(itemId);
        }

        return;
      }

      override.pendingPeriodKeys.forEach(periodKey => {
        if (this.adapter.includes(range.start, range.end, periodKey)) {
          override.pendingPeriodKeys.delete(periodKey);
        }
      });

      if (!override.pendingPeriodKeys.size) this.itemOverrides.delete(itemId);
    });

    this.mergeData(incoming);
  }

  /** Merges server records, replacing old indexed locations and preserving current overrides. */
  private mergeData(incoming: RowPeriodData<TItemData>): void {
    const getItemId = this.getItemId;

    Object.entries(incoming).forEach(([rowId, periods]) => {
      Object.entries(periods).forEach(([periodKey, items]) => {
        // An incoming item may already be indexed under another row or anchor period.
        if (getItemId) {
          items.forEach(item => this.removeIndexedItem(getItemId(item)));
        }

        const row = this.data[rowId] ?? {};

        if (getItemId) {
          const replacedItems = row[periodKey] ?? [];

          replacedItems.forEach(item => {
            const itemId = getItemId(item);
            const location = this.itemLocations.get(itemId);

            if (location?.rowId === rowId && location.periodKey === periodKey) {
              this.itemLocations.delete(itemId);
            }
          });
        }

        this.data = {
          ...this.data,
          [rowId]: { ...row, [periodKey]: items },
        };

        if (getItemId) {
          items.forEach(item => {
            this.itemLocations.set(getItemId(item), {
              rowId,
              periodKey,
              range: this.getItemRange?.(item),
            });
          });
        }
      });
    });

    // Overrides not acknowledged by this response must win the merge.
    this.applyItemOverrides();
    this.onData(this.data);
  }

  /** Reapplies pending local updates and deletes after server data is merged. */
  private applyItemOverrides(): void {
    if (!this.getItemId) return;

    this.itemOverrides.forEach((override, itemId) => {
      if (override.item && override.rowId && override.periodKey) {
        this.placeIndexedItem(override.rowId, override.periodKey, override.item);
      } else {
        this.removeIndexedItem(itemId);
      }
    });
  }

  /** Places an item once under its current retained row and period. */
  private placeIndexedItem(rowId: string, periodKey: string, item: TItemData): void {
    const getItemId = this.getItemId;

    if (!getItemId) return;

    const itemId = getItemId(item);

    this.removeIndexedItem(itemId);

    const row = this.data[rowId] ?? {};

    this.data = {
      ...this.data,
      [rowId]: {
        ...row,
        [periodKey]: [...(row[periodKey] ?? []), item],
      },
    };

    this.itemLocations.set(itemId, { rowId, periodKey, range: this.getItemRange?.(item) });
  }

  /** Removes an item from its indexed location without scanning every row. */
  private removeIndexedItem(itemId: string): void {
    const getItemId = this.getItemId;

    if (!getItemId) return;

    const location = this.itemLocations.get(itemId);

    if (!location) return;

    const row = this.data[location.rowId] ?? {};

    this.data = {
      ...this.data,
      [location.rowId]: {
        ...row,
        [location.periodKey]: (row[location.periodKey] ?? []).filter(item => getItemId(item) !== itemId),
      },
    };

    this.itemLocations.delete(itemId);
  }

  /** Rebuilds item lookup locations after the retained buffer changes. */
  private rebuildItemIndex(): void {
    this.itemLocations.clear();

    const getItemId = this.getItemId;

    if (!getItemId) return;

    Object.entries(this.data).forEach(([rowId, periods]) => {
      Object.entries(periods).forEach(([periodKey, items]) => {
        items.forEach(item => this.itemLocations.set(getItemId(item), {
          rowId,
          periodKey,
          range: this.getItemRange?.(item),
        }));
      });
    });
  }

  /** Chooses an in-range anchor for ranged records, retaining the fallback when unavailable. */
  private getRangeAnchor(range: { start: string; end: string } | undefined, fallback: string) {
    if (!range || !this.loadedStart || !this.loadedEnd) return fallback;

    return this.adapter.getRangeAnchor(range, this.loadedStart, this.loadedEnd) ?? fallback;
  }

  /** Limits the retained runway after loading a new edge. */
  private trimRetainedData(direction: 'left' | 'right'): void {
    if (!this.loadedStart || !this.loadedEnd) return;

    const retainedCount = this.adapter.distance(this.loadedStart, this.loadedEnd) + 1;

    if (retainedCount <= this.maxRetainedPeriods) return;

    if (direction === 'right') {
      this.loadedStart = this.adapter.shift(this.loadedEnd, -(this.maxRetainedPeriods - 1));
    } else {
      this.loadedEnd = this.adapter.shift(this.loadedStart, this.maxRetainedPeriods - 1);
    }

    const retainedKeys = new Set<string>();
    for (let index = 0; index < this.maxRetainedPeriods; index += 1) {
      retainedKeys.add(this.adapter.shift(this.loadedStart, index).key);
    }

    this.retainOverrides(this.loadedStart, this.loadedEnd, retainedKeys);
    this.retainData(this.loadedStart, this.loadedEnd, retainedKeys);
    this.rebuildItemIndex();
    this.applyItemOverrides();
    this.onData(this.data);
  }

  /** Drops data outside loaded bounds and reapplies pending item overrides. */
  private pruneToLoadedRange(): void {
    if (!this.loadedStart || !this.loadedEnd) return;

    const loadedStart = this.loadedStart;
    const loadedEnd = this.loadedEnd;

    this.retainOverrides(loadedStart, loadedEnd);
    this.retainData(loadedStart, loadedEnd);
    this.rebuildItemIndex();
    this.applyItemOverrides();
    this.onData(this.data);
  }

  /** Keeps only mutation overrides still covered by the retained window. */
  private retainOverrides(start: CalendarPeriod, end: CalendarPeriod, retainedKeys?: ReadonlySet<string>) {
    this.itemOverrides.forEach((override, itemId) => {
      if (this.getItemRange && override.range) {
        const anchor = this.adapter.getRangeAnchor(override.range, start, end);

        if (anchor === undefined) {
          this.itemOverrides.delete(itemId);
          return;
        }

        if (override.item && override.periodKey) {
          override.periodKey = anchor;
        }

        return;
      }

      const includes = (periodKey: string) => retainedKeys?.has(periodKey)
        ?? this.adapter.includes(start, end, periodKey);

      if (override.periodKey && !includes(override.periodKey)) {
        this.itemOverrides.delete(itemId);
        return;
      }

      override.pendingPeriodKeys = new Set(
        [...override.pendingPeriodKeys].filter(includes),
      );

      if (!override.pendingPeriodKeys.size) this.itemOverrides.delete(itemId);
    });
  }

  /** Keeps each retained record once, re-anchoring ranged records inside the window. */
  private retainData(start: CalendarPeriod, end: CalendarPeriod, retainedKeys?: ReadonlySet<string>) {
    const getItemRange = this.getItemRange;
    const getItemId = this.getItemId;

    if (!getItemRange || !getItemId) {
      const includes = (periodKey: string) => retainedKeys?.has(periodKey)
        ?? this.adapter.includes(start, end, periodKey);

      this.data = Object.fromEntries(Object.entries(this.data).map(([rowId, periods]) => [
        rowId,
        Object.fromEntries(Object.entries(periods).filter(([periodKey]) => includes(periodKey))),
      ]));
      return;
    }

    // Keep each ranged item once, anchored inside the portion that remains retained.
    this.data = Object.fromEntries(Object.entries(this.data).map(([rowId, periods]) => {
      const anchoredItems = new Map<string, TItemData[]>();
      const seen = new Set<string>();

      Object.values(periods).flat().forEach(item => {
        const range = getItemRange(item);
        const periodKey = this.adapter.getRangeAnchor(range, start, end);

        if (periodKey === undefined) return;

        const itemId = getItemId(item);

        if (seen.has(itemId)) return;

        seen.add(itemId);

        const items = anchoredItems.get(periodKey) ?? [];
        items.push(item);
        anchoredItems.set(periodKey, items);
      });

      return [rowId, Object.fromEntries(anchoredItems)];
    }));
  }

}
