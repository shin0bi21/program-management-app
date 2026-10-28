import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FilterCard, { type FilterCardValues } from './FilterCard';

const categories = [{
  id: 'status',
  label: 'Status',
  options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
}];

function Harness() {
  const [values, setValues] = useState<FilterCardValues>({ status: [] });
  return <FilterCard categories={categories} values={values} onApply={(id, selected) => setValues(current => ({ ...current, [id]: selected }))} onClearAll={() => setValues({ status: [] })} />;
}

function openStatus() {
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.click(screen.getByRole('menuitem', { name: /Status/ }));
}

describe('FilterCard', () => {
  it('preserves draft selections while navigating and applies them explicitly', () => {
    render(<Harness />);
    openStatus();

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Active' }));
    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeEnabled();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Back to filter categories' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Status/ }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Active' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));
    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeDisabled();
    expect(screen.getByLabelText('1 active filters')).toBeInTheDocument();
  });

  it('enables category Clear only for applied values and clears immediately', () => {
    render(<Harness />);
    openStatus();

    expect(screen.getByRole('menuitem', { name: 'Clear' })).toBeDisabled();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Active' }));
    expect(screen.getByRole('menuitem', { name: 'Clear' })).toBeDisabled();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));
    expect(screen.getByRole('menuitem', { name: 'Clear' })).toBeEnabled();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Active' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitem', { name: 'Clear' })).toBeDisabled();
    expect(screen.queryByLabelText('1 active filters')).not.toBeInTheDocument();
  });

  it('calls Clear All from the root view when values are applied', () => {
    const onClearAll = vi.fn();
    render(<FilterCard categories={categories} values={{ status: ['active'] }} onApply={vi.fn()} onClearAll={onClearAll} />);

    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear all' }));

    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it('moves focus into the selected filter-category view', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Status' }));
    expect(screen.getByRole('menuitem', { name: 'Back to filter categories' })).toHaveFocus();
  });


});

describe('date range category', () => {
  it('fills preset drafts, permits custom edits, and disables oversized presets', () => {
    const onApply = vi.fn();
    const month = { start: '2026-03-01', end: '2026-03-31' };
    render(<FilterCard categories={categories} values={{}} onApply={vi.fn()}
      dateRange={{ value: { start: '2026-01-01', end: '2026-12-31' }, onApply,
        presets: [
          { id: 'month', label: 'This Month', range: month },
          { id: 'long', label: 'Long Cycle', range: { start: '2025-01-01', end: '2026-12-31' } },
        ] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Date Range' }));

    expect(screen.getByRole('checkbox', { name: 'Long Cycle' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'This Month' }));
    expect(screen.getByLabelText('From')).toHaveValue(month.start);
    expect(screen.getByLabelText('To')).toHaveValue(month.end);
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(month);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Custom' }));
    expect(screen.getByRole('checkbox', { name: 'Custom' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('From')).toHaveValue(month.start);
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-03-25' } });
    expect(screen.getByRole('checkbox', { name: 'Custom' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenLastCalledWith({ start: month.start, end: '2026-03-25' });
  });
  it('opens date inputs through Filters and applies them explicitly', () => {
    const apply = vi.fn();
    render(<FilterCard categories={categories} values={{}} onApply={vi.fn()}
      dateRange={{ value: { start: '2026-01-01', end: '2026-12-31' }, onApply: apply }} />);
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Date Range' }));
    expect(screen.getByRole('dialog', { name: 'Date Range filter' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-03-01' } });
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(apply).toHaveBeenCalledWith({ start: '2026-03-01', end: '2026-12-31' });
  });
  it('shares the category footer, preserves date drafts on Back, and clears to the default range', () => {
    const onApply = vi.fn();
    const initial = { start: '2030-01-01', end: '2030-12-31' };
    render(<FilterCard categories={categories} values={{}} onApply={vi.fn()}
      dateRange={{ value: initial, onApply }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Date Range' }));
    expect(screen.getAllByText('Date Range')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2031-01-01' } });
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('end on or after the start');

    fireEvent.click(screen.getByRole('button', { name: 'Back to filter categories' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Date Range' }));
    expect(screen.getByLabelText('From')).toHaveValue('2031-01-01');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    const year = new Date().getFullYear();
    expect(onApply).toHaveBeenCalledWith({ start: `${year}-01-01`, end: `${year}-12-31` });
  });

});
