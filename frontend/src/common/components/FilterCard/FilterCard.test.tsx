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
