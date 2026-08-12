import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CalendarItem from './CalendarItem';

describe('CalendarItem', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aligns an upward action menu above the full item rectangle', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('calendar-item')) {
        return new DOMRect(200, 700, 240, 28);
      }
      if (this.classList.contains('floating-menu-panel')) {
        return new DOMRect(0, 0, 150, 100);
      }
      return new DOMRect();
    });

    render(<CalendarItem
      id="task-1"
      ariaLabel="Prepare workshop"
      summary="Prepare workshop"
      detailTitle="Prepare workshop"
      details={[]}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: /Prepare workshop.*Open actions/ }));

    expect(screen.getByRole('menu')).toHaveStyle({ top: '596px', left: '200px' });
  });
});
