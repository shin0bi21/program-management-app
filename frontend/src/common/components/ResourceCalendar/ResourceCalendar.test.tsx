import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResourceCalendar from './ResourceCalendar';
import { dayKey } from './periods';
import { calculateCalendarAnchorScrollLeft } from './utils/calendarPosition';

const PERIOD_WIDTH = 145;
const RESOURCE_WIDTH = 125;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly observed = new Set<Element>();
  constructor(private readonly callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
  }
  observe = (element: Element) => { this.observed.add(element); };
  disconnect = () => undefined;
  unobserve = (element: Element) => { this.observed.delete(element); };
  takeRecords = () => [];
  root = null;
  rootMargin = '';
  thresholds = [0.05];
  emit(element: Element, isIntersecting: boolean) {
    this.callback([{ target: element, isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

describe('ResourceCalendar', () => {
  beforeEach(() => {
    localStorage.clear();
    MockIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('PointerEvent', MouseEvent);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sizes the initial day window in full weeks with one group on each side', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(RESOURCE_WIDTH + 10 * PERIOD_WIDTH);
    const onInitialPeriods = vi.fn();
    const { container } = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{}}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={() => 'Staff'}
        buildItem={() => null}
        onInitialPeriods={onInitialPeriods}
      />,
    );

    const viewport = container.querySelector<HTMLElement>('.resource-calendar')!;
    expect(container.querySelectorAll('.resource-calendar__period')).toHaveLength(28);
    expect(viewport.scrollLeft).toBe(14 * PERIOD_WIDTH);
    expect(onInitialPeriods).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ key: '2026-08-09' }),
    ]));
    expect(onInitialPeriods.mock.calls[0][0]).toHaveLength(28);
  });

  it('debounces scroll persistence and restores the leftmost day at its exact offset', async () => {
    const storageKey = 'resource-calendar:test-position';
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const first = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{}}
        initialDate={new Date(2026, 7, 9)}
        positionStorageKey={storageKey}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={() => 'Staff'}
        buildItem={() => null}
      />,
    );
    const viewport = first.container.querySelector<HTMLElement>('.resource-calendar')!;
    const periods = [...first.container.querySelectorAll<HTMLElement>('.resource-calendar__period')];
    const initialScrollLeft = viewport.scrollLeft;
    const leftAnchorIndex = Math.floor(initialScrollLeft / PERIOD_WIDTH);
    const anchorDate = periods[leftAnchorIndex]!.dataset.periodKey!;

    viewport.scrollLeft = initialScrollLeft + 37;
    fireEvent.scroll(viewport);
    expect(setItem).not.toHaveBeenCalled();
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 110));
    });

    expect(localStorage.getItem(storageKey)).toBe(JSON.stringify({ date: anchorDate, offset: 37 }));
    expect(setItem).toHaveBeenCalledTimes(1);
    first.unmount();

    const restored = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{}}
        initialDate={new Date(2025, 0, 1)}
        positionStorageKey={storageKey}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={() => 'Staff'}
        buildItem={() => null}
      />,
    );
    const restoredPeriods = [...restored.container.querySelectorAll<HTMLElement>('.resource-calendar__period')];
    const periodIndex = restoredPeriods.findIndex(period => period.dataset.periodKey === anchorDate);
    const restoredViewport = restored.container.querySelector<HTMLElement>('.resource-calendar')!;

    expect(periodIndex).toBeGreaterThanOrEqual(0);
    expect(restoredViewport.scrollLeft).toBe(calculateCalendarAnchorScrollLeft({
      periodIndex,
      offset: 37,
      periodWidth: PERIOD_WIDTH,
    }));
  });

  it('waits for a non-zero measurement and fills a 4K viewport in complete weeks', () => {
    let width = 0;
    let resize!: ResizeObserverCallback;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe() {}
      disconnect() {}
    });
    const { container } = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{}}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={() => 'Staff'}
        buildItem={() => null}
      />,
    );

    width = 3840;
    act(() => resize([], {} as ResizeObserver));

    expect(container.querySelectorAll('.resource-calendar__period')).toHaveLength(42);
  });

  it('resets the rendered window to today from the calendar toolbar', () => {
    const onPeriodsReset = vi.fn();
    const { container } = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{}}
        initialDate={new Date(2025, 0, 1)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={() => 'Staff'}
        buildItem={() => null}
        onPeriodsReset={onPeriodsReset}
      />,
    );

    const viewport = container.querySelector<HTMLElement>('.resource-calendar')!;
    viewport.scrollLeft = 4000;

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    expect(onPeriodsReset).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ key: dayKey(new Date()) }),
    ]));
    expect(viewport.scrollLeft).toBeLessThan(4000);
    expect(container.querySelector('.resource-calendar__period--today')).toBeInTheDocument();
    expect(container.querySelector('.resource-calendar__cell--today')).toBeInTheDocument();
  });

  it('navigates the day view backward and forward by one week', () => {
    const onPeriodsReset = vi.fn();
    render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{}}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={() => 'Staff'}
        buildItem={() => null}
        onPeriodsReset={onPeriodsReset}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPeriodsReset).toHaveBeenLastCalledWith(expect.arrayContaining([
      expect.objectContaining({ key: '2026-08-16' }),
    ]));

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPeriodsReset).toHaveBeenLastCalledWith(expect.arrayContaining([
      expect.objectContaining({ key: '2026-08-09' }),
    ]));
  });

  it('can hide Today without hiding programmable navigation', () => {
    render(
      <ResourceCalendar
        resources={[]}
        data={{}}
        getResourceId={() => ''}
        getItemId={() => ''}
        renderResource={() => null}
        buildItem={() => null}
        showTodayButton={false}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('supports controlled keyboard-accessible resource selection', () => {
    const onResourceSelect = vi.fn();
    const { container } = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1', name: 'Zoe Wilson' }, { id: 'staff-2', name: 'Alex Morgan' }]}
        data={{}}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={({ resource }) => resource.name}
        buildItem={() => null}
        selectedResourceId="staff-2"
        onResourceSelect={onResourceSelect}
      />,
    );

    expect(screen.getByRole('button', { name: 'Alex Morgan' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Zoe Wilson' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Alex Morgan' }).closest('.resource-calendar__row')).toHaveClass(
      'resource-calendar__row--selected',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zoe Wilson' }));
    expect(onResourceSelect).toHaveBeenCalledWith({ id: 'staff-1', name: 'Zoe Wilson' });
    onResourceSelect.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Alex Morgan' }));
    expect(onResourceSelect).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.resource-calendar__resource-select')).toHaveLength(2);
  });

  it('selects an item owning resource without interrupting the item action', () => {
    const onResourceSelect = vi.fn();
    const onItemClick = vi.fn();
    render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }, { id: 'staff-2' }]}
        data={{
          'staff-1': { '2026-08-09': [{ id: 'entry-1' }] },
          'staff-2': { '2026-08-09': [{ id: 'entry-2' }] },
        }}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={({ resource }) => resource.id}
        buildItem={({ data: item }) => (
          <button type="button" onClick={onItemClick}>{item.id}</button>
        )}
        selectedResourceId="staff-1"
        onResourceSelect={onResourceSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'entry-2' }));
    expect(onResourceSelect).toHaveBeenCalledWith({ id: 'staff-2' });
    expect(onItemClick).toHaveBeenCalledTimes(1);

    onResourceSelect.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'entry-1' }));
    expect(onResourceSelect).not.toHaveBeenCalled();
    expect(onItemClick).toHaveBeenCalledTimes(2);
  });

  it('lets a consumer provide a keyboard-menu of cell actions', () => {
    const onGeneral = vi.fn();
    const onTask = vi.fn();
    render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{}}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={({ resource }) => resource.id}
        buildItem={() => null}
        getCellActions={() => [
          { id: 'general', label: 'General time', onSelect: onGeneral },
          { id: 'task', label: 'Task time', onSelect: onTask },
        ]}
      />,
    );

    fireEvent.click(screen.getAllByRole('gridcell')[0], { clientX: 320, clientY: 240 });
    expect(screen.getByRole('menu')).toHaveStyle({ left: '320px', top: '244px' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Task time' }));

    expect(onTask).toHaveBeenCalledOnce();
    expect(onGeneral).not.toHaveBeenCalled();
    expect(screen.queryByRole('menuitem', { name: 'General time' })).not.toBeInTheDocument();
  });

  it('does not enqueue the opposite edge until it exits and re-enters', async () => {
    const onPeriodsBuilt = vi.fn();
    const { container } = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{}}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={() => 'Staff'}
        buildItem={() => null}
        onPeriodsBuilt={onPeriodsBuilt}
      />,
    );
    const firstObserver = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1];
    const rightEdge = container.querySelector('[data-edge="right"]')!;

    await act(async () => firstObserver.emit(rightEdge, true));
    expect(onPeriodsBuilt).toHaveBeenCalledTimes(1);
    expect(onPeriodsBuilt).toHaveBeenLastCalledWith(expect.any(Array), 'right');

    const currentObserver = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1];
    const leftEdge = container.querySelector('[data-edge="left"]')!;
    await act(async () => currentObserver.emit(leftEdge, true));
    expect(onPeriodsBuilt).toHaveBeenCalledTimes(1);

    await act(async () => currentObserver.emit(leftEdge, false));
    await act(async () => currentObserver.emit(leftEdge, true));
    expect(onPeriodsBuilt).toHaveBeenCalledTimes(2);
    expect(onPeriodsBuilt).toHaveBeenLastCalledWith(expect.any(Array), 'left');
  });

  it('reports the source and destination when an item is dragged to another cell', async () => {
    const onItemDrop = vi.fn();
    const anchor = new Date(2026, 7, 9);
    const { container } = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }, { id: 'staff-2' }]}
        data={{ 'staff-1': { '2026-08-09': [{ id: 'entry-1' }] } }}
        initialDate={anchor}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={({ resource }) => resource.id}
        buildItem={({ data }) => data.id}
        onItemDrop={onItemDrop}
      />,
    );
    const item = container.querySelector('.resource-calendar__item')!;
    const target = container.querySelector<HTMLElement>('[data-resource-id="staff-2"][data-period="2026-08-10"]')!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => target) });
    vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({ width: 120 } as DOMRect);

    fireEvent.pointerDown(item, { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 50, clientY: 50 });

    expect(onItemDrop).toHaveBeenCalledWith(expect.objectContaining({
      item: { id: 'entry-1' },
      source: expect.objectContaining({ resource: { id: 'staff-1' }, period: expect.objectContaining({ key: '2026-08-09' }) }),
      destination: expect.objectContaining({ resource: { id: 'staff-2' }, period: expect.objectContaining({ key: '2026-08-10' }) }),
    }));
  });

  it('renders items in the resource row layer instead of inside period cells', () => {
    const { container } = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{ 'staff-1': { '2026-08-09': [{ id: 'entry-1' }] } }}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={() => 'Staff'}
        buildItem={({ data }) => <button type="button">{data.id}</button>}
      />,
    );

    const item = screen.getByRole('button', { name: 'entry-1' });
    const slot = item.closest('.resource-calendar__item-slot');
    expect(slot).toHaveAttribute('data-item-resource-id', 'staff-1');
    expect(slot).toHaveAttribute('data-item-period', '2026-08-09');
    expect(item.closest('.resource-calendar__cell')).toBeNull();
    expect(container.querySelector('.resource-calendar__item-layer')).toContainElement(item);
  });

  it('uses an occupied item slot as a drag destination', () => {
    const onItemDrop = vi.fn();
    const { container } = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{
          'staff-1': {
            '2026-08-09': [{ id: 'entry-1' }],
            '2026-08-10': [{ id: 'entry-2' }],
          },
        }}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={() => 'Staff'}
        buildItem={({ data }) => data.id}
        onItemDrop={onItemDrop}
      />,
    );
    const source = screen.getByText('entry-1').closest<HTMLElement>('.resource-calendar__item')!;
    const occupiedSlot = container.querySelector<HTMLElement>(
      '[data-item-resource-id="staff-1"][data-item-period="2026-08-10"]',
    )!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => occupiedSlot) });
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({ width: 120 } as DOMRect);

    fireEvent.pointerDown(source, { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 50, clientY: 50 });

    expect(onItemDrop).toHaveBeenCalledWith(expect.objectContaining({
      item: { id: 'entry-1' },
      destination: expect.objectContaining({ period: expect.objectContaining({ key: '2026-08-10' }) }),
    }));
  });

  it('does not drop onto the last hovered cell after leaving the calendar', () => {
    const onItemDrop = vi.fn();
    const { container } = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{ 'staff-1': { '2026-08-09': [{ id: 'entry-1' }] } }}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={() => 'Staff'}
        buildItem={({ data }) => data.id}
        onItemDrop={onItemDrop}
      />,
    );
    const item = container.querySelector<HTMLElement>('.resource-calendar__item')!;
    const target = container.querySelector<HTMLElement>('[data-resource-id="staff-1"][data-period="2026-08-10"]')!;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn().mockReturnValueOnce(target).mockReturnValueOnce(null),
    });
    vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({ width: 120 } as DOMRect);

    fireEvent.pointerDown(item, { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 5000, clientY: 5000 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 5000, clientY: 5000 });

    expect(onItemDrop).not.toHaveBeenCalled();
  });

  it('auto-scrolls horizontally while an item is dragged near an edge', () => {
    let animationFrame: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      animationFrame = callback;
      return 1;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const { container } = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{ 'staff-1': { '2026-08-09': [{ id: 'entry-1' }] } }}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={() => 'Staff'}
        buildItem={({ data }) => data.id}
        onItemDrop={vi.fn()}
      />,
    );
    const viewport = container.querySelector<HTMLElement>('.resource-calendar')!;
    const item = container.querySelector<HTMLElement>('.resource-calendar__item')!;
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 1000 } as DOMRect);
    vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({ width: 120 } as DOMRect);
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => null) });

    fireEvent.pointerDown(item, { pointerId: 1, button: 0, clientX: 900, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 950, clientY: 100 });
    act(() => animationFrame?.(0));

    expect(viewport.scrollLeft).toBeGreaterThan(0);
    fireEvent.pointerCancel(window, { pointerId: 1 });
  });

  it('does not rerender the grid during pointer movement or drag cleanup', () => {
    const buildItem = vi.fn(({ data }: { data: { id: string } }) => data.id);
    const { container } = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{ 'staff-1': { '2026-08-09': [{ id: 'entry-1' }] } }}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={() => 'Staff'}
        buildItem={buildItem}
        onItemDrop={vi.fn()}
      />,
    );
    const item = container.querySelector<HTMLElement>('.resource-calendar__item')!;
    vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({ width: 120 } as DOMRect);
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => null) });
    const initialRenderCount = buildItem.mock.calls.length;

    fireEvent.pointerDown(item, { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 40, clientY: 40 });
    const countAfterDragStarted = buildItem.mock.calls.length;
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 60, clientY: 60 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 80, clientY: 80 });

    expect(countAfterDragStarted).toBe(initialRenderCount + 1);
    expect(buildItem).toHaveBeenCalledTimes(countAfterDragStarted);
    fireEvent.pointerCancel(window, { pointerId: 1 });
    expect(container.querySelector('.resource-calendar__drag-overlay')).not.toBeInTheDocument();
    expect(buildItem).toHaveBeenCalledTimes(countAfterDragStarted);
  });

  it('does not rerender the grid while scrolling inside the same virtual row window', () => {
    const buildItem = vi.fn(() => null);
    const renderResource = vi.fn(({ resource }: { resource: { id: string } }) => resource.id);
    const resources = Array.from({ length: 20 }, (_, index) => ({ id: `staff-${index}` }));
    const { container } = render(
      <ResourceCalendar
        resources={resources}
        data={{}}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={renderResource}
        buildItem={buildItem}
      />,
    );
    const viewport = container.querySelector<HTMLElement>('.resource-calendar')!;
    const initialResourceRenders = renderResource.mock.calls.length;

    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 20 });
    fireEvent.scroll(viewport);

    expect(renderResource).toHaveBeenCalledTimes(initialResourceRenders);
    expect(buildItem).not.toHaveBeenCalled();
  });

  it('replaces an overflowing stack with one summary that opens all items', () => {
    const onCellClick = vi.fn();
    const onItemDrop = vi.fn();
    const { container } = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{
          'staff-1': {
            '2026-08-09': [{ id: 'entry-1' }, { id: 'entry-2' }, { id: 'entry-3' }],
          },
        }}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string }) => item.id}
        renderResource={() => 'Staff'}
        buildItem={({ data }) => <button type="button">{data.id}</button>}
        onCellActivate={onCellClick}
        maxVisibleItemsPerCell={2}
        onItemDrop={onItemDrop}
      />,
    );

    expect(screen.queryByRole('button', { name: 'entry-1' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all 3 items for 2026-08-09' }));

    expect(screen.getByRole('button', { name: 'entry-1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'entry-2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'entry-3' })).toBeInTheDocument();
    expect(document.querySelectorAll('.resource-calendar__overflow-item .resource-calendar__item.draggable')).toHaveLength(3);
    expect(onCellClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'entry-1' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    const overflowItem = document.querySelector<HTMLElement>('.resource-calendar__overflow-item .resource-calendar__item')!;
    const target = container.querySelector<HTMLElement>('[data-resource-id="staff-1"][data-period="2026-08-10"]')!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => target) });
    vi.spyOn(overflowItem, 'getBoundingClientRect').mockReturnValue({ width: 120 } as DOMRect);
    fireEvent.pointerDown(overflowItem, { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 50, clientY: 50 });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 50, clientY: 50 });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    expect(onItemDrop).toHaveBeenCalledWith(expect.objectContaining({
      item: { id: 'entry-1' },
      destination: expect.objectContaining({ period: expect.objectContaining({ key: '2026-08-10' }) }),
    }));
  });

  it('clips ranged items to the rendered window and preserves row selection on activation', () => {
    const onResourceSelect = vi.fn();
    const onActivate = vi.fn();
    render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{}}
        rangeData={{ 'staff-1': [{ id: 'task-1', start: '2026-01-01', end: '2027-01-01' }] }}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string; start: string; end: string }) => item.id}
        getItemRange={item => ({ start: item.start, end: item.end })}
        renderResource={() => 'Staff'}
        buildItem={() => null}
        buildRangeItem={({ data }) => <button type="button" onClick={onActivate}>{data.id}</button>}
        onResourceSelect={onResourceSelect}
      />,
    );

    const item = screen.getByRole('button', { name: 'task-1' });
    const positioned = item.closest<HTMLElement>('.resource-calendar__range-item')!;
    expect(positioned.style.gridColumn).toMatch(/^2 \/ \d+$/);
    fireEvent.click(item);
    expect(onResourceSelect).toHaveBeenCalledWith({ id: 'staff-1' });
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('rejects a ranged drop target owned by another calendar viewport', () => {
    const onRangeMove = vi.fn();
    const { container } = render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }, { id: 'staff-2' }]}
        data={{}}
        rangeData={{ 'staff-1': [{ id: 'task-1', start: '2026-08-09', end: '2026-08-11' }] }}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string; start: string; end: string }) => item.id}
        getItemRange={item => ({ start: item.start, end: item.end })}
        getItemCapabilities={() => ({ draggable: true })}
        renderResource={({ resource }) => resource.id}
        buildItem={() => null}
        buildRangeItem={({ data }) => <span>{data.id}</span>}
        onRangeMove={onRangeMove}
      />,
    );
    const viewport = container.querySelector<HTMLElement>('.resource-calendar')!;
    const item = screen.getByText('task-1').closest<HTMLElement>('.resource-calendar__range-item')!;
    const foreignRow = document.createElement('div');
    foreignRow.className = 'resource-calendar__row';
    foreignRow.dataset.resourceId = 'staff-2';
    document.body.appendChild(foreignRow);
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600 } as DOMRect);
    vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({ left: 200, top: 100, width: 456, height: 31 } as DOMRect);
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => foreignRow) });

    fireEvent.pointerDown(item, { pointerId: 1, button: 0, clientX: 300, clientY: 115 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 452, clientY: 115 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 452, clientY: 115 });

    expect(onRangeMove).not.toHaveBeenCalled();
    expect(document.querySelector('.resource-calendar__preview-host')).not.toBeInTheDocument();
    foreignRow.remove();
  });

  it('emits keyboard range resize through the calendar API without activating the item', () => {
    const onRangeResize = vi.fn();
    const onItemActivate = vi.fn();
    render(
      <ResourceCalendar
        resources={[{ id: 'staff-1' }]}
        data={{}}
        rangeData={{ 'staff-1': [{ id: 'task-1', start: '2026-08-09', end: '2026-08-11' }] }}
        initialDate={new Date(2026, 7, 9)}
        getResourceId={resource => resource.id}
        getItemId={(item: { id: string; start: string; end: string }) => item.id}
        getItemRange={item => ({ start: item.start, end: item.end })}
        getItemCapabilities={() => ({ resizable: true })}
        renderResource={() => 'Staff'}
        buildItem={() => null}
        buildRangeItem={({ data }) => <span>{data.id}</span>}
        onItemActivate={onItemActivate}
        onRangeResize={onRangeResize}
      />,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Resize end of task-1' }), { key: 'ArrowRight' });

    const wrapper = screen.getByText('task-1').closest('.resource-calendar__item');
    expect(wrapper).toHaveClass('resource-calendar__range-item', 'resizable');

    expect(onRangeResize).toHaveBeenCalledWith({
      resource: { id: 'staff-1' },
      item: { id: 'task-1', start: '2026-08-09', end: '2026-08-11' },
      originalRange: { start: '2026-08-09', end: '2026-08-11' },
      nextRange: { start: '2026-08-09', end: '2026-08-12' },
      edge: 'end',
    });
    expect(onItemActivate).not.toHaveBeenCalled();
  });
});
