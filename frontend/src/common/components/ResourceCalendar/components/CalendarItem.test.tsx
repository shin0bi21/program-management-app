import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CalendarItem from './CalendarItem';

describe('CalendarItem', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
});
