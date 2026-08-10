import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResourceCalendar from './ResourceCalendar';
import { dayKey } from './periods';

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
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(190 + 10 * 152);
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
    expect(viewport.scrollLeft).toBe(7 * 152);
    expect(onInitialPeriods).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ key: '2026-08-09' }),
    ]));
    expect(onInitialPeriods.mock.calls[0][0]).toHaveLength(28);
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
    render(
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

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    expect(onPeriodsReset).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ key: dayKey(new Date()) }),
    ]));
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
        onCellClick={onCellClick}
        maxVisibleItemsPerCell={2}
        onItemDrop={onItemDrop}
      />,
    );

    expect(screen.queryByRole('button', { name: 'entry-1' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all 3 items for 2026-08-09' }));

    expect(screen.getByRole('button', { name: 'entry-1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'entry-2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'entry-3' })).toBeInTheDocument();
    expect(document.querySelectorAll('.resource-calendar__overflow-item .resource-calendar__item--draggable')).toHaveLength(3);
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
});
