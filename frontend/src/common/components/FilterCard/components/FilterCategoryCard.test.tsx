import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FilterCategoryCard from './FilterCategoryCard';

const category = {
  id: 'status', label: 'Status', selectionMode: 'single' as const,
  options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }],
};
const shared = { active: true, resetVersion: 0, onBack: vi.fn(), onDraftCountChange: vi.fn() };

describe('FilterCategoryCard', () => {
  it('owns single-choice drafts and applies only changed selections', () => {
    const onApply = vi.fn();
    render(<FilterCategoryCard {...shared} kind="list" category={category} value={['active']} onApply={onApply} />);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Active' }));
    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeDisabled();

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Inactive' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Active' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Inactive' })).toHaveAttribute('aria-checked', 'true');
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(['inactive']);
  });

  it('owns date validation and resets an unapplied draft when Clear all is requested', () => {
    const onApply = vi.fn();
    const value = { start: '2026-01-01', end: '2026-12-31' };
    const { rerender } = render(<FilterCategoryCard {...shared} kind="date-range" value={value} onApply={onApply} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2027-01-01' } });
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('end on or after the start');

    rerender(<FilterCategoryCard {...shared} resetVersion={1} kind="date-range" value={value} onApply={onApply} />);
    expect(screen.getByLabelText('From')).toHaveValue(value.start);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });
  it('prevents applying a range longer than 366 days without changing the applied value', () => {
    const onApply = vi.fn();
    render(<FilterCategoryCard {...shared} kind="date-range"
      value={{ start: '2028-01-01', end: '2028-12-31' }} onApply={onApply} />);
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2029-01-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('maximum 366 days');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('checks the clicked preset when multiple presets have identical dates', () => {
    const range = { start: '2026-01-01', end: '2026-12-31' };
    render(<FilterCategoryCard {...shared} kind="date-range" value={range} onApply={vi.fn()}
      presets={[
        { id: 'this-year', label: 'This Year', range },
        { id: 'current-cycle', label: 'Current Cycle', range },
      ]} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Current Cycle' }));

    expect(screen.getByRole('checkbox', { name: 'Current Cycle' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'This Year' })).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Custom' }));
    expect(screen.getByRole('checkbox', { name: 'Custom' })).toHaveAttribute('aria-checked', 'true');
  });

});
