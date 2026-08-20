// Scope: verifies shared calendar-item actions, detail discovery, hover dismissal, and positioning.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CalendarItem from './CalendarItem';

const itemProps = {
  id: 'item-1',
  ariaLabel: 'Prepare workshop',
  summary: 'Prepare workshop',
  detailTitle: 'Prepare workshop details',
  details: [{ label: 'Program', value: 'After School' }],
};

describe('CalendarItem', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('aligns an upward action menu to the clicked visible period', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('calendar-item')) {
        return new DOMRect(200, 700, 240, 28);
      }
      if (this.dataset.itemPeriod === '2026-08-11') {
        return new DOMRect(320, 680, 120, 80);
      }
      if (this.classList.contains('resource-calendar__item-slot')) {
        return new DOMRect(200, 680, 120, 80);
      }
      if (this.classList.contains('floating-menu-panel')) {
        return new DOMRect(0, 0, 150, 100);
      }
      return new DOMRect();
    });

    render(<div className="resource-calendar__row">
      <div className="resource-calendar__item-slot" data-item-period="2026-08-10" />
      <div className="resource-calendar__item-slot" data-item-period="2026-08-11" />
      <CalendarItem
        id="task-1"
        ariaLabel="Prepare workshop"
        summary="Prepare workshop"
        detailTitle="Prepare workshop"
        details={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    </div>);

    fireEvent.click(screen.getByRole('button', { name: /Prepare workshop.*Open actions/ }), { clientX: 350 });

    expect(screen.getByRole('menu')).toHaveStyle({ top: '596px', left: '320px' });
  });

  it('opens item details from the action menu for touch-accessible discovery', () => {
    render(<CalendarItem
      id="task-1"
      ariaLabel="Prepare workshop"
      summary="Prepare workshop"
      detailTitle="Prepare workshop details"
      details={[{ label: 'Program', value: 'After School' }]}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: /Prepare workshop.*Open actions/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'View details' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('tooltip', { name: /Prepare workshop details/ })).toHaveTextContent('After School');
  });

  it('omits the touch details action when precise hover is available', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<CalendarItem
      id="task-1"
      ariaLabel="Prepare workshop"
      summary="Prepare workshop"
      detailTitle="Prepare workshop details"
      details={[]}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: /Prepare workshop.*Open actions/ }));

    expect(screen.queryByRole('menuitem', { name: 'View details' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
  });

  it('dismisses hover details when a scroll container moves', async () => {
    const { container } = render(<CalendarItem {...itemProps} />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Prepare workshop' }));
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    fireEvent.scroll(container);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('dismisses hover details immediately on pointer down', async () => {
    render(<CalendarItem {...itemProps} />);
    const trigger = screen.getByRole('button', { name: 'Prepare workshop' });
    fireEvent.mouseEnter(trigger);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    fireEvent.pointerDown(trigger);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('does not open hover details when the pointer leaves during the delay', () => {
    vi.useFakeTimers();
    try {
      render(<CalendarItem {...itemProps} />);
      const trigger = screen.getByRole('button', { name: 'Prepare workshop' });
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseLeave(trigger);
      act(() => vi.advanceTimersByTime(120));

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
