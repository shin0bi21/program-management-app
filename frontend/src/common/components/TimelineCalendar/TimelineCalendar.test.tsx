import { addDays, dayKey } from './utils/periods';
// This suite owns TimelineCalendar composition, grid semantics, selection, and item construction.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TimelineCalendar from './TimelineCalendar';
import Item from './components/Item/Item';
import type { TimelineCalendarProps } from './types';

interface TestRow { id: string; name: string }
interface TestItem { id: string; start: string; end: string }
type CalendarProps = TimelineCalendarProps<TestRow, TestItem>;

const rows: TestRow[] = [
  { id: 'staff-1', name: 'Zoe Wilson' },
  { id: 'staff-2', name: 'Alex Morgan' },
];
const pointItem = (id: string, date: string): TestItem => ({ id, start: date, end: date });

function renderCalendar(overrides: Partial<CalendarProps> = {}) {
  const props: CalendarProps = {
    rows: [rows[0]],
    items: {},
    initialDate: new Date(2026, 7, 9),
    getRowId: row => row.id,
    getItemId: item => item.id,
    getItemRange: item => ({ start: item.start, end: item.end }),
    renderRow: ({ row }) => row.name,
    buildItem: ({ data, calendar }) => <Item calendar={calendar} id={data.id} ariaLabel={data.id} summary={data.id} detailTitle={data.id} details={[]} />,
    ...overrides,
  };
  return render(<TimelineCalendar {...props} />);
}

describe('TimelineCalendar', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('ResizeObserver', class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(element: Element) {
        const target = element as HTMLElement;
        this.callback([{
          target,
          contentRect: { width: target.clientWidth, height: target.clientHeight },
          borderBoxSize: [{ inlineSize: target.clientWidth, blockSize: target.clientHeight }],
        } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: function scrollTo(options: ScrollToOptions | number) {
        if (typeof options === 'number') this.scrollLeft = options;
        else {
          if (options?.left !== undefined) this.scrollLeft = options.left;
          if (options?.top !== undefined) this.scrollTop = options.top;
        }
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
  });

  it('contains body cells inside the required grid and row roles', () => {
    renderCalendar();

    const grid = screen.getByRole('grid', { name: 'Timeline calendar' });
    const cell = screen.getAllByRole('gridcell')[0];
    const row = cell.closest<HTMLElement>('[role="row"]');

    expect(row).not.toBeNull();
    expect(cell.parentElement).toBe(row);
    expect(grid).toContainElement(row);
    expect(screen.getByRole('columnheader', { name: 'Row' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Zoe Wilson' })).toBeInTheDocument();
  });

  it('supports controlled row selection and selects an item owning row', () => {
    const onRowSelect = vi.fn();
    const onItemClick = vi.fn();
    renderCalendar({
      rows,
      items: { 'staff-1': [pointItem('entry-1', '2026-08-09')] },
      selectedRowId: 'staff-2',
      onRowSelect,
      onItemActivate: onItemClick,
    });

    expect(screen.getByRole('button', { name: 'Alex Morgan' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Zoe Wilson' }));
    expect(onRowSelect).toHaveBeenCalledWith(rows[0], 'row');
    onRowSelect.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'entry-1' }));
    expect(onRowSelect).toHaveBeenCalledWith(rows[0], 'item');
    expect(onItemClick).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Alex Morgan' }));
    expect(onRowSelect).toHaveBeenLastCalledWith(rows[1], 'row');
  });

  it('positions one-period and multi-period items through one item layer and build contract', () => {
    const buildItem = vi.fn<CalendarProps['buildItem']>(({ data, calendar }) => (
      <Item calendar={calendar} id={data.id} ariaLabel={data.id} summary={data.id} detailTitle={data.id} details={[]} />
    ));
    const { container } = renderCalendar({
      items: {
        'staff-1': [
          pointItem('hours-1', '2026-08-09'),
          { id: 'task-1', start: '2026-08-10', end: '2026-08-12' },
        ],
      },
      buildItem,
    });

    const point = screen.getByText('hours-1').closest<HTMLElement>('.positioned-item');
    const range = screen.getByText('task-1').closest<HTMLElement>('.positioned-item');
    expect(point).toHaveAttribute('data-item-start', '2026-08-09');
    expect(point).toHaveAttribute('data-item-end', '2026-08-09');
    expect(range).toHaveAttribute('data-item-start', '2026-08-10');
    expect(range).toHaveAttribute('data-item-end', '2026-08-12');
    expect(container.querySelector('.item-layer')).toContainElement(point);
    expect(buildItem).toHaveBeenCalledWith(expect.objectContaining({
      range: { start: '2026-08-09', end: '2026-08-09' },
    }));
  });
  it.each([
    [0, 7, false], [-7, 0, false], [-7, -1, true], [1, 7, true],
  ])('disables Today only outside the inclusive range (%s, %s)', (startOffset, endOffset, disabled) => {
    const today = new Date();
    renderCalendar({ dateRange: { start: dayKey(addDays(today, startOffset)), end: dayKey(addDays(today, endOffset)) } });
    const button = screen.getByRole('button', { name: 'Today' });
    if (disabled) expect(button).toBeDisabled();
    else expect(button).toBeEnabled();
  });

  it.each([
    ['2026-08-10', '2026-08-11', true, false],
    ['2026-08-09', '2026-08-09', false, true],
    ['2026-08-01', '2026-08-31', false, false],
  ] as const)('updates Today at midnight across range %s–%s', (start, end, initiallyDisabled, finallyDisabled) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 9, 23, 59, 59));
    const onPeriodsReset = vi.fn();
    const { container } = renderCalendar({
      dateRange: { start, end }, onPeriodsReset, positionStorageKey: 'calendar-today-test',
    });
    const button = screen.getByRole('button', { name: 'Today' });
    expect(button).toHaveProperty('disabled', initiallyDisabled);
    const grid = screen.getByRole('grid');
    const initialScroll = grid.scrollLeft;
    if (!initiallyDisabled) expect(container.querySelector('.period.today')).toHaveAttribute('data-period-key', '2026-08-09');

    act(() => vi.advanceTimersByTime(1000));

    expect(button).toHaveProperty('disabled', finallyDisabled);
    if (finallyDisabled) expect(container.querySelector('.period.today')).toBeNull();
    else expect(container.querySelector('.period.today')).toHaveAttribute('data-period-key', '2026-08-10');
    expect(grid.scrollLeft).toBe(initialScroll);
    expect(onPeriodsReset).not.toHaveBeenCalled();

    if (!finallyDisabled) {
      fireEvent.click(button);
      expect(JSON.parse(localStorage.getItem('calendar-today-test')!)).toMatchObject({ date: '2026-08-10' });
    }
  });

  it('rechecks the clock and current bounds if Today is clicked before a delayed midnight timer runs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 9, 23, 59, 59));
    const { container } = renderCalendar({ dateRange: { start: '2026-08-09', end: '2026-08-09' } });
    const grid = screen.getByRole('grid');
    const scrollTo = vi.spyOn(grid, 'scrollTo');
    vi.setSystemTime(new Date(2026, 7, 10, 8));

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    expect(screen.getByRole('button', { name: 'Today' })).toBeDisabled();
    expect(container.querySelector('.period.today')).toBeNull();
    expect(scrollTo).not.toHaveBeenCalled();
  });

});
