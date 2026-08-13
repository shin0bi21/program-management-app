import type { CalendarPeriod, ResourcePeriodData } from '../types';

export type BufferDirection = 'initial' | 'left' | 'right';

export interface PeriodRange {
  start: CalendarPeriod;
  end: CalendarPeriod;
  direction: BufferDirection;
}

export interface PeriodBufferAdapter {
  shift: (period: CalendarPeriod, amount: number) => CalendarPeriod;
  distance: (start: CalendarPeriod, end: CalendarPeriod) => number;
  includes: (start: CalendarPeriod, end: CalendarPeriod, periodKey: string) => boolean;
  targetSize?: number;
  threshold?: number;
  replenishSize?: number;
}

export interface PeriodDataBufferOptions<TItemData> {
  adapter: PeriodBufferAdapter;
  load: (range: PeriodRange) => Promise<ResourcePeriodData<TItemData>>;
  onData: (data: ResourcePeriodData<TItemData>) => void;
  initialData?: ResourcePeriodData<TItemData>;
  targetSize?: number;
  threshold?: number;
  replenishSize?: number;
  maxRetainedPeriods?: number;
  getItemId?: (item: TItemData) => string;
}

interface ItemOverride<TItemData> {
  revision: number;
  pendingPeriodKeys: Set<string>;
  resourceId?: string;
  periodKey?: string;
  item?: TItemData;
}

interface ItemLocation {
  resourceId: string;
  periodKey: string;
}

export function mergeResourcePeriodData<TItemData>(
  current: ResourcePeriodData<TItemData>,
  incoming: ResourcePeriodData<TItemData>,
): ResourcePeriodData<TItemData> {
  const merged = { ...current };
  Object.entries(incoming).forEach(([resourceId, periods]) => {
    merged[resourceId] = { ...(merged[resourceId] ?? {}), ...periods };
  });
  return merged;
}

export class PeriodDataBuffer<TItemData> {
  private readonly adapter: PeriodBufferAdapter;
  private readonly load: PeriodDataBufferOptions<TItemData>['load'];
  private readonly onData: PeriodDataBufferOptions<TItemData>['onData'];
  private readonly targetSize: number;
  private readonly threshold: number;
  private readonly replenishSize: number;
  private readonly maxRetainedPeriods: number;
  private readonly getItemId?: (item: TItemData) => string;
  private readonly itemOverrides = new Map<string, ItemOverride<TItemData>>();
  private readonly itemLocations = new Map<string, ItemLocation>();
  private mutationRevision = 0;
  private data: ResourcePeriodData<TItemData>;
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

  constructor(options: PeriodDataBufferOptions<TItemData>) {
    this.adapter = options.adapter;
    this.load = options.load;
    this.onData = options.onData;
    this.data = options.initialData ?? {};
    this.targetSize = options.targetSize ?? options.adapter.targetSize ?? 16;
    this.threshold = options.threshold ?? options.adapter.threshold ?? 8;
    this.replenishSize = options.replenishSize ?? options.adapter.replenishSize ?? 8;
    this.maxRetainedPeriods = options.maxRetainedPeriods ?? 250;
    this.getItemId = options.getItemId;
    this.rebuildItemIndex();
  }

  initialize(renderedPeriods: readonly CalendarPeriod[]): Promise<void> {
    if (this.initialized || !renderedPeriods.length) return Promise.resolve();
    if (this.initializing) return this.initializing;
    this.initializing = this.runInitialization(renderedPeriods);
    return this.initializing;
  }

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
    this.pruneToLoadedRange();
  }

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
      this.renderedStart = renderedStart;
      this.renderedEnd = renderedEnd;
      this.loadedStart = loadedStart;
      this.loadedEnd = loadedEnd;
      this.initialized = true;
    } catch (error) {
      this.initialized = false;
      throw error;
    } finally {
      this.initializing = null;
    }
  }

  periodsBuilt(periods: readonly CalendarPeriod[], direction: 'left' | 'right'): Promise<void> {
    if (!periods.length) return Promise.resolve();

    if (direction === 'left') this.renderedStart = periods[0];
    else this.renderedEnd = periods[periods.length - 1];

    this.queues[direction] = this.queues[direction]
      .catch(() => undefined)
      .then(() => this.replenishIfNeeded(direction));
    return this.queues[direction];
  }

  private mergeData(incoming: ResourcePeriodData<TItemData>): void {
    Object.entries(incoming).forEach(([resourceId, periods]) => {
      Object.entries(periods).forEach(([periodKey, items]) => {
        items.forEach(item => {
          if (this.getItemId) this.removeIndexedItem(this.getItemId(item));
        });
        const resource = this.data[resourceId] ?? {};
        (resource[periodKey] ?? []).forEach(item => {
          if (!this.getItemId) return;
          const itemId = this.getItemId(item);
          const location = this.itemLocations.get(itemId);
          if (location?.resourceId === resourceId && location.periodKey === periodKey) {
            this.itemLocations.delete(itemId);
          }
        });
        this.data = {
          ...this.data,
          [resourceId]: { ...resource, [periodKey]: items },
        };
        items.forEach(item => {
          if (this.getItemId) this.itemLocations.set(this.getItemId(item), { resourceId, periodKey });
        });
      });
    });
    this.applyItemOverrides();
    this.onData(this.data);
  }

  upsertItem(resourceId: string, periodKey: string, item: TItemData): void {
    if (!this.getItemId) throw new Error('getItemId is required for item mutations');
    const itemId = this.getItemId(item);
    const previousOverride = this.itemOverrides.get(itemId);
    const previousLocation = this.itemLocations.get(itemId);
    const pendingPeriodKeys = new Set(previousOverride?.pendingPeriodKeys);
    if (previousLocation) pendingPeriodKeys.add(previousLocation.periodKey);
    pendingPeriodKeys.add(periodKey);
    this.mutationRevision += 1;
    this.itemOverrides.set(itemId, {
      revision: this.mutationRevision,
      pendingPeriodKeys,
      resourceId,
      periodKey,
      item,
    });
    this.placeIndexedItem(resourceId, periodKey, item);
    this.onData(this.data);
  }

  removeItem(itemId: string): void {
    if (!this.getItemId) throw new Error('getItemId is required for item mutations');
    const previousOverride = this.itemOverrides.get(itemId);
    const previousLocation = this.itemLocations.get(itemId);
    const pendingPeriodKeys = new Set(previousOverride?.pendingPeriodKeys);
    if (previousLocation) pendingPeriodKeys.add(previousLocation.periodKey);
    this.mutationRevision += 1;
    this.itemOverrides.set(itemId, { revision: this.mutationRevision, pendingPeriodKeys });
    this.removeIndexedItem(itemId);
    this.onData(this.data);
  }

  private applyItemOverrides(): void {
    if (!this.getItemId) return;
    this.itemOverrides.forEach((override, itemId) => {
      if (override.item && override.resourceId && override.periodKey) {
        this.placeIndexedItem(override.resourceId, override.periodKey, override.item);
      } else {
        this.removeIndexedItem(itemId);
      }
    });
  }

  private placeIndexedItem(resourceId: string, periodKey: string, item: TItemData): void {
    if (!this.getItemId) return;
    const itemId = this.getItemId(item);
    this.removeIndexedItem(itemId);
    const resource = this.data[resourceId] ?? {};
    this.data = {
      ...this.data,
      [resourceId]: {
        ...resource,
        [periodKey]: [...(resource[periodKey] ?? []), item],
      },
    };
    this.itemLocations.set(itemId, { resourceId, periodKey });
  }

  private removeIndexedItem(itemId: string): void {
    if (!this.getItemId) return;
    const location = this.itemLocations.get(itemId);
    if (!location) return;
    const resource = this.data[location.resourceId] ?? {};
    this.data = {
      ...this.data,
      [location.resourceId]: {
        ...resource,
        [location.periodKey]: (resource[location.periodKey] ?? []).filter(item => this.getItemId!(item) !== itemId),
      },
    };
    this.itemLocations.delete(itemId);
  }

  private rebuildItemIndex(): void {
    this.itemLocations.clear();
    if (!this.getItemId) return;
    Object.entries(this.data).forEach(([resourceId, periods]) => {
      Object.entries(periods).forEach(([periodKey, items]) => {
        items.forEach(item => this.itemLocations.set(this.getItemId!(item), { resourceId, periodKey }));
      });
    });
  }

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
    this.itemOverrides.forEach((override, itemId) => {
      if (override.periodKey && !retainedKeys.has(override.periodKey)) {
        this.itemOverrides.delete(itemId);
        return;
      }
      override.pendingPeriodKeys = new Set(
        [...override.pendingPeriodKeys].filter(periodKey => retainedKeys.has(periodKey)),
      );
      if (!override.pendingPeriodKeys.size) this.itemOverrides.delete(itemId);
    });
    this.data = Object.fromEntries(Object.entries(this.data).map(([resourceId, periods]) => [
      resourceId,
      Object.fromEntries(Object.entries(periods).filter(([periodKey]) => retainedKeys.has(periodKey))),
    ]));
    this.rebuildItemIndex();
    this.applyItemOverrides();
    this.onData(this.data);
  }

  private pruneToLoadedRange(): void {
    if (!this.loadedStart || !this.loadedEnd) return;
    const loadedStart = this.loadedStart;
    const loadedEnd = this.loadedEnd;
    this.itemOverrides.forEach((override, itemId) => {
      if (override.periodKey
        && !this.adapter.includes(loadedStart, loadedEnd, override.periodKey)) {
        this.itemOverrides.delete(itemId);
        return;
      }
      override.pendingPeriodKeys = new Set([...override.pendingPeriodKeys].filter(periodKey => (
        this.adapter.includes(loadedStart, loadedEnd, periodKey)
      )));
      if (!override.pendingPeriodKeys.size) this.itemOverrides.delete(itemId);
    });
    this.data = Object.fromEntries(Object.entries(this.data).map(([resourceId, periods]) => [
      resourceId,
      Object.fromEntries(Object.entries(periods).filter(([periodKey]) => (
        this.adapter.includes(loadedStart, loadedEnd, periodKey)
      ))),
    ]));
    this.rebuildItemIndex();
    this.applyItemOverrides();
    this.onData(this.data);
  }

  private async loadAndMerge(range: PeriodRange): Promise<void> {
    const requestRevision = this.mutationRevision;
    const incoming = await this.load(range);
    this.itemOverrides.forEach((override, itemId) => {
      if (override.revision > requestRevision) return;
      override.pendingPeriodKeys.forEach(periodKey => {
        if (this.adapter.includes(range.start, range.end, periodKey)) {
          override.pendingPeriodKeys.delete(periodKey);
        }
      });
      if (!override.pendingPeriodKeys.size) this.itemOverrides.delete(itemId);
    });
    this.mergeData(incoming);
  }
}
