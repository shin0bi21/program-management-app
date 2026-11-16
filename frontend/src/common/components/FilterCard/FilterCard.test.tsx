import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FilterCard, { type FilterCardValues } from './FilterCard';

const categories = [{
  id: 'status',
  label: 'Status',
  options: [{ id: 'active', label: 'Active' }, { id: 'inactive', label: 'Inactive' }],
}];

/**
 * Applies emitted filter values so interactions exercise the controlled component contract.
 * @example render(<Harness />) // Apply updates the selected status and Clear all empties it
 */
function Harness() {
  const [values, setValues] = useState<FilterCardValues>({ status: [] });
  return <FilterCard categories={categories} values={values} onApply={(id, selected) => setValues(current => ({ ...current, [id]: selected }))} onClearAll={() => setValues({ status: [] })} />;
}

/**
 * Opens the Status group from a closed filter popup.
 * @example openStatus() // exposes the Active and Inactive choices
 */
function openStatus() {
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.click(screen.getByRole('menuitem', { name: /Status/ }));
}

describe('FilterCard', () => {
  it('displays reference names and applies only selected IDs', () => {
    const onApply = vi.fn();
    const options = [{ id: 'cycle-1', label: 'Fall', startsOn: '2026-09-01', endsOn: '2026-12-31' }];
    render(<FilterCard categories={[{ id: 'cycleIds', label: 'Cycle', options }]} values={{ cycleIds: [] }} onApply={onApply} />);

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cycle' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Fall' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledExactlyOnceWith('cycleIds', ['cycle-1']);
  });

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

  it('discards unapplied drafts when closed and restores the applied IDs on reopening', () => {
    const onApply = vi.fn();
    render(<FilterCard categories={categories} values={{ status: ['active'] }} onApply={onApply} />);
    openStatus();

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Inactive' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    openStatus();

    expect(screen.getByRole('menuitemcheckbox', { name: 'Active' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Inactive' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeDisabled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('preserves drafts across equivalent inputs and resets them when applied IDs change', () => {
    const onApply = vi.fn();
    const { rerender } = render(<FilterCard categories={categories} values={{ status: [] }} onApply={onApply} />);
    openStatus();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Active' }));

    rerender(<FilterCard categories={categories} values={{ status: [] }} onApply={onApply} />);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Active' })).toHaveAttribute('aria-checked', 'true');

    rerender(<FilterCard categories={categories} values={{ status: ['inactive'] }} onApply={onApply} />);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Active' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Inactive' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeDisabled();
    expect(onApply).not.toHaveBeenCalled();
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

  it('keeps the category open when updated results scroll after applying a filter', () => {
    render(<><Harness /><div data-testid="results" /></>);
    openStatus();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Active' }));

    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));
    fireEvent.scroll(screen.getByTestId('results'));

    expect(screen.getByRole('button', { name: 'Filters' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Active' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeDisabled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
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
