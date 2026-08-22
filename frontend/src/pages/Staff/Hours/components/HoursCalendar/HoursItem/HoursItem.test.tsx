// Scope: verifies hours-item summaries, domain details, and emitted entry actions.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HoursItem from './HoursItem';

const item = {
  id: 'entry-1',
  programId: 'program-1',
  programName: 'Soft Skills',
  cycleId: 'cycle-1',
  cycleName: 'Summer 2026',
  category: 'program_delivery' as const,
  categoryLabel: 'Program Delivery',
  taskId: null,
  taskTitle: null, sessionId: null, sessionLabel: null,
  hours: 2,
  note: 'Workshop delivery',
};

describe('HoursItem', () => {
  it.each([
    ['Task', { taskId: 'task-1', taskTitle: 'Prepare workshop', sessionId: null, sessionLabel: null }],
    ['Session', { taskId: null, taskTitle: null, sessionId: 'session-1', sessionLabel: 'Healthy Relationships' }],
    ['Regular', { taskId: null, taskTitle: null, sessionId: null, sessionLabel: null }],
  ])('shows hours and the %s entry type', (type, source) => {
    render(<HoursItem item={{ ...item, ...source }} />);

    const entry = screen.getByRole('button');
    expect(entry).toHaveTextContent('2h');
    expect(entry).toHaveTextContent(type);
    expect(entry.querySelector('.hours-item__type')).toHaveClass(type.toLowerCase());
  });

  it('shows complete entry details on hover', async () => {
    render(<HoursItem item={{ ...item, cycleName: 'Summer 2026' }} onEdit={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.mouseEnter(screen.getByRole('button', { name: /program delivery, 2 hours/i }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Program Delivery');
    expect(tooltip).toHaveTextContent('Soft Skills');
    expect(tooltip).toHaveTextContent('Summer 2026');
    expect(tooltip).toHaveTextContent('Workshop delivery');

    expect([...tooltip.querySelectorAll('dt')].map(label => label.textContent)).toEqual([
      'Cycle', 'Program', 'Category', 'Hours', 'Notes',
    ]);
    expect(screen.getByText('Hours').closest('div')).toHaveClass('calendar-item-details__section-start');
  });

  it('omits the program detail instead of labeling an unspecified program as General', async () => {
    render(<HoursItem item={{ ...item, programId: null, programName: null }} />);

    const timeItem = screen.getByRole('button', { name: /program delivery, 2 hours/i });
    expect(timeItem).not.toHaveTextContent('General');
    fireEvent.mouseEnter(timeItem);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).not.toHaveTextContent('General');
    expect([...tooltip.querySelectorAll('dt')].map(label => label.textContent)).toEqual([
      'Cycle', 'Program', 'Category', 'Hours', 'Notes',
    ]);
    expect(tooltip.querySelectorAll('dd')[1]).toHaveTextContent('—');
  });

  it('keeps cycle, program, and category details for session time', async () => {
    render(<HoursItem item={{
      ...item,
      sessionId: 'session-1',
      sessionLabel: 'Healthy Relationships',
    }} />);
    fireEvent.mouseEnter(screen.getByRole('button'));

    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getAllByText('Healthy Relationships')).toHaveLength(1);
    expect([...tooltip.querySelectorAll('dt')].map(label => label.textContent)).toEqual([
      'Cycle', 'Program', 'Category', 'Hours', 'Notes',
    ]);
    expect(tooltip).toHaveTextContent('Program Delivery');
  });

  it('opens entry actions without invoking either action immediately', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<HoursItem item={item} onEdit={onEdit} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: /program delivery, 2 hours/i }));

    expect(screen.getByRole('button', { name: /program delivery, 2 hours/i })).toHaveClass('calendar-item--menu-open');
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
    render(<HoursItem item={item} onEdit={onEdit} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /program delivery, 2 hours/i }));

    fireEvent.click(screen.getByRole('menuitem', { name: label }));

    expect(action === 'edit' ? onEdit : onDelete).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
