import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SchoolModalState } from './hooks/useSchoolModal';
import SchoolModal from './SchoolModal';

function makeWorkflow(overrides: Partial<SchoolModalState> = {}): SchoolModalState {
  return {
    action: { type: 'add' },
    open: vi.fn(),
    close: vi.fn(),
    name: 'Central High',
    setName: vi.fn(),
    submitting: false,
    error: '',
    deleting: false,
    editing: false,
    school: undefined,
    submit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('SchoolModal', () => {
  it('forwards form edits, submission, and cancellation to its external owner', () => {
    const workflow = makeWorkflow();
    render(<SchoolModal workflow={workflow} />);

    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(workflow.setName).toHaveBeenCalledWith('New name');
    expect(workflow.submit).toHaveBeenCalledOnce();
    expect(workflow.close).toHaveBeenCalledOnce();
  });

  it('forwards deletion without a form submission', () => {
    const school = { id: 'school-1', name: 'Central High' };
    const workflow = makeWorkflow({ action: { type: 'delete', school }, deleting: true, school });
    render(<SchoolModal workflow={workflow} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(workflow.submit).toHaveBeenCalledOnce();
  });

  it('locks controls while its owner submits and exposes a recoverable error', () => {
    const workflow = makeWorkflow({ submitting: true });
    const { rerender } = render(<SchoolModal workflow={workflow} />);

    expect(screen.getByLabelText('School Name *')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();

    rerender(<SchoolModal workflow={{ ...workflow, submitting: false, error: 'network failed' }} />);

    expect(screen.getByRole('alert')).toHaveTextContent('network failed');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
