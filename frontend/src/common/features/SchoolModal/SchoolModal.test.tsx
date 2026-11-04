import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSchool, deleteSchool, setSchool } from './schoolModal.api';
import SchoolModal from './SchoolModal';

vi.mock('./schoolModal.api', () => ({ createSchool: vi.fn(), deleteSchool: vi.fn(), setSchool: vi.fn() }));

const school = { id: 'school-1', name: 'Central High' };

describe('SchoolModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a school by name', async () => {
    const onUpsert = vi.fn();
    vi.mocked(createSchool).mockResolvedValue(school);
    render(<SchoolModal action={{ type: 'add' }} onClose={vi.fn()} onUpsert={onUpsert} onDelete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: 'Central High' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(createSchool).toHaveBeenCalledWith('Central High'));
    expect(onUpsert).toHaveBeenCalledWith(school);
  });

  it('does not submit a blank name through the form', () => {
    render(<SchoolModal action={{ type: 'add' }} onClose={vi.fn()} onUpsert={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.submit(screen.getByLabelText('School Name *').closest('form') as HTMLFormElement);

    expect(createSchool).not.toHaveBeenCalled();
    expect(screen.queryByText('Saving school...')).not.toBeInTheDocument();
  });

  it('renames a school', async () => {
    const onUpsert = vi.fn();
    vi.mocked(setSchool).mockResolvedValue({ ...school, name: 'Central Academy' });
    render(<SchoolModal action={{ type: 'edit', school }} onClose={vi.fn()} onUpsert={onUpsert} onDelete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: 'Central Academy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(setSchool).toHaveBeenCalledWith({ id: school.id, name: 'Central Academy' }));
  });

  it('confirms school deletion', async () => {
    const onDelete = vi.fn();
    vi.mocked(deleteSchool).mockResolvedValue();
    render(<SchoolModal action={{ type: 'delete', school }} onClose={vi.fn()} onUpsert={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(deleteSchool).toHaveBeenCalledWith(school.id));
    expect(onDelete).toHaveBeenCalledWith(school);
  });

  it('keeps the modal open with an accessible error after a failed save', async () => {
    vi.mocked(createSchool).mockRejectedValue(new Error('network failed'));
    render(<SchoolModal action={{ type: 'add' }} onClose={vi.fn()} onUpsert={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: 'Central High' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('network failed');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
