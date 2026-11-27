import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SchoolModal from './SchoolModal';
import useSchoolModal from './hooks/useSchoolModal';
import { createSchool, deleteSchool, setSchool } from './schoolModal.api';
import { referenceDataKeys } from '../referenceData/hooks/useReferenceData';
import { renderWithQueryClient as render } from '../../../tests/queryClientTestUtils';

vi.mock('./schoolModal.api', () => ({ createSchool: vi.fn(), deleteSchool: vi.fn(), setSchool: vi.fn() }));

const school = { id: 'school-1', name: 'Central High' };

/**
 * Connects a selector's target owner to the mounted school form.
 * @param props - Current selector value and its saved-selection callback.
 * @example <SchoolWorkflow schoolId={school.id} onChange={selectSchool} />
 */
function SchoolWorkflow({ schoolId = '', onChange }: { schoolId?: string; onChange: (id: string) => void }) {
  const workflow = useSchoolModal();
  const selection = { schoolId, onChange };
  return <>
    <button onClick={() => workflow.open({ type: 'add' }, selection)}>Add</button>
    <button onClick={() => workflow.open({ type: 'edit', school }, selection)}>Edit</button>
    <button onClick={() => workflow.open({ type: 'delete', school }, selection)}>Delete</button>
    <SchoolModal workflow={workflow} />
  </>;
}

describe('SchoolModal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createSchool).mockResolvedValue(school);
    vi.mocked(setSchool).mockResolvedValue(school);
    vi.mocked(deleteSchool).mockResolvedValue();
  });

  it('creates a school, reconciles the returned record, selects it, and closes', async () => {
    const onChange = vi.fn();
    const { queryClient } = render(<SchoolWorkflow onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: '  Entered name  ' } });
    fireEvent.submit(document.getElementById('school-action-form')!);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(createSchool).toHaveBeenCalledWith('Entered name');
    expect(queryClient.getQueryData(referenceDataKeys.schools)).toEqual([school]);
    expect(onChange).toHaveBeenCalledWith(school.id);
  });

  it('initializes editing and updates the school without changing the selection', async () => {
    const onChange = vi.fn();
    const saved = { ...school, name: 'Central Academy' };
    vi.mocked(setSchool).mockResolvedValue(saved);
    const { queryClient } = render(<SchoolWorkflow schoolId="other" onChange={onChange} />);
    queryClient.setQueryData(referenceDataKeys.schools, [school]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('School Name *')).toHaveValue(school.name);
    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: 'Central Academy' } });
    fireEvent.submit(document.getElementById('school-action-form')!);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(setSchool).toHaveBeenCalledWith({ id: school.id, name: 'Central Academy' });
    expect(queryClient.getQueryData(referenceDataKeys.schools)).toEqual([saved]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([school.id, 'other'])('clears a deleted school only when selected (%s)', async schoolId => {
    const onChange = vi.fn();
    const { queryClient } = render(<SchoolWorkflow schoolId={schoolId} onChange={onChange} />);
    queryClient.setQueryData(referenceDataKeys.schools, [school]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(deleteSchool).toHaveBeenCalledWith(school.id);
    expect(queryClient.getQueryData(referenceDataKeys.schools)).toEqual([]);
    expect(onChange.mock.calls).toEqual(schoolId === school.id ? [['']] : []);
  });

  it('rejects a blank name without submitting', () => {
    render(<SchoolWorkflow onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: '  ' } });
    fireEvent.submit(document.getElementById('school-action-form')!);

    expect(createSchool).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('preserves the draft after failure and allows retry', async () => {
    vi.mocked(createSchool).mockRejectedValueOnce(new Error('network failed'));
    const onChange = vi.fn();
    const { queryClient } = render(<SchoolWorkflow onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: 'Central High' } });
    fireEvent.submit(document.getElementById('school-action-form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('network failed');
    expect(screen.getByLabelText('School Name *')).toHaveValue('Central High');
    expect(queryClient.getQueryData(referenceDataKeys.schools)).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.submit(document.getElementById('school-action-form')!);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onChange).toHaveBeenCalledWith(school.id);
  });

  it('discards the cancelled draft and callback before another form opens it', async () => {
    const previousChange = vi.fn();
    const nextChange = vi.fn();
    const view = render(<SchoolWorkflow schoolId={school.id} onChange={previousChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: 'Unsaved name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(setSchool).not.toHaveBeenCalled();

    view.rerender(<SchoolWorkflow onChange={nextChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByLabelText('School Name *')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: 'New school' } });
    fireEvent.submit(document.getElementById('school-action-form')!);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(previousChange).not.toHaveBeenCalled();
    expect(nextChange).toHaveBeenCalledWith(school.id);
  });

  it('blocks duplicate submission and dismissal while pending', async () => {
    let resolveCreate!: (value: typeof school) => void;
    vi.mocked(createSchool).mockReturnValue(new Promise(resolve => { resolveCreate = resolve; }));
    const onChange = vi.fn();
    render(<SchoolWorkflow onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: 'Central High' } });
    fireEvent.submit(document.getElementById('school-action-form')!);
    fireEvent.submit(document.getElementById('school-action-form')!);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(createSchool).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'Add School' })).toBeInTheDocument();
    expect(screen.getByLabelText('School Name *')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();

    await act(async () => resolveCreate(school));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onChange).toHaveBeenCalledOnce();
  });
});
