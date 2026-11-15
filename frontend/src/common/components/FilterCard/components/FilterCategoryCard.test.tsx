import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FilterCategoryCard from './FilterCategoryCard';

const category = {
  id: 'status', label: 'Status', selectionMode: 'single' as const,
  options: [{ id: 'active', name: 'Active' }, { id: 'inactive', name: 'Inactive' }],
};
const shared = { active: true, resetVersion: 0, onBack: vi.fn(), onDraftCountChange: vi.fn() };

describe('FilterCategoryCard', () => {
  it('owns single-choice drafts and applies only changed selections', () => {
    const onApply = vi.fn();
    render(<FilterCategoryCard {...shared} category={category} value={['active']} onApply={onApply} />);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Active' }));
    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeDisabled();

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Inactive' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Active' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Inactive' })).toHaveAttribute('aria-checked', 'true');
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(['inactive']);
  });

  it('resets unapplied checklist drafts when Clear all is requested', () => {
    const onApply = vi.fn();
    const { rerender } = render(<FilterCategoryCard {...shared} category={category} value={[]} onApply={onApply} />);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Active' }));
    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeEnabled();

    rerender(<FilterCategoryCard {...shared} resetVersion={1} category={category} value={[]} onApply={onApply} />);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Active' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeDisabled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('supports multiple choices and toggles a selected draft off', () => {
    const onApply = vi.fn();
    render(<FilterCategoryCard {...shared} category={{ ...category, selectionMode: 'multiple' }} value={[]} onApply={onApply} />);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Active' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Inactive' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));
    expect(onApply).toHaveBeenLastCalledWith(['active', 'inactive']);

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Active' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));
    expect(onApply).toHaveBeenLastCalledWith(['inactive']);
  });
});
