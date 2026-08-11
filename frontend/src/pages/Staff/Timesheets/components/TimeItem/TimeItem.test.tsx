import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TimeItem from './TimeItem';

const item = {
  id: 'entry-1',
  programId: 'program-1',
  programName: 'Soft Skills',
  cycleId: 'cycle-1',
  cycleName: 'Summer 2026',
  category: 'program_delivery' as const,
  categoryLabel: 'Program Delivery',
  taskId: null,
  taskTitle: null,
  hours: 2,
  note: 'Workshop delivery',
};

describe('TimeItem', () => {
  it('shows complete entry details on hover', () => {
    render(<TimeItem item={{ ...item, cycleName: 'Summer 2026' }} onEdit={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.mouseEnter(screen.getByRole('button', { name: /program delivery, 2 hours/i }));

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Program Delivery');
    expect(tooltip).toHaveTextContent('Soft Skills');
    expect(tooltip).toHaveTextContent('Summer 2026');
    expect(tooltip).toHaveTextContent('Workshop delivery');

    expect([...tooltip.querySelectorAll('dt')].map(label => label.textContent)).toEqual([
      'Program', 'Cycle', 'Category', 'Hours', 'Notes',
    ]);
  });

  it('omits the program detail instead of labeling an unspecified program as General', () => {
    render(<TimeItem item={{ ...item, programId: null, programName: null }} />);

    fireEvent.mouseEnter(screen.getByRole('button', { name: /program delivery, 2 hours/i }));

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).not.toHaveTextContent('General');
    expect([...tooltip.querySelectorAll('dt')].map(label => label.textContent)).toEqual([
      'Cycle', 'Category', 'Hours', 'Notes',
    ]);
  });

  it('dismisses hover details when a scroll container moves', () => {
    const { container } = render(<TimeItem item={item} onEdit={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: /program delivery, 2 hours/i }));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.scroll(container);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('dismisses hover details immediately on pointer down', () => {
    render(<TimeItem item={item} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /program delivery, 2 hours/i });
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.pointerDown(trigger);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens entry actions without invoking either action immediately', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<TimeItem item={item} onEdit={onEdit} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: /program delivery, 2 hours/i }));

    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it.each([
    ['Edit', 'edit'],
    ['Delete', 'delete'],
  ] as const)('runs the %s action and closes the menu', (label, action) => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<TimeItem item={item} onEdit={onEdit} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /program delivery, 2 hours/i }));

    fireEvent.click(screen.getByRole('menuitem', { name: label }));

    expect(action === 'edit' ? onEdit : onDelete).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
