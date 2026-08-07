import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSchool, deleteSchool, setSchool } from '../schools/api/schools.api';
import SchoolActionModal from './SchoolActionModal';

vi.mock('../schools/api/schools.api', () => ({ createSchool: vi.fn(), deleteSchool: vi.fn(), setSchool: vi.fn() }));

const school = { id: 'school-1', name: 'Central High' };

describe('SchoolActionModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds a school by name', async () => {
    const onUpsert = vi.fn();
    vi.mocked(createSchool).mockResolvedValue(school);
    render(<SchoolActionModal action={{ type: 'add' }} onClose={vi.fn()} onUpsert={onUpsert} onDelete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: 'Central High' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(createSchool).toHaveBeenCalledWith('Central High'));
    expect(onUpsert).toHaveBeenCalledWith(school);
  });

  it('renames a school', async () => {
    const onUpsert = vi.fn();
    vi.mocked(setSchool).mockResolvedValue({ ...school, name: 'Central Academy' });
    render(<SchoolActionModal action={{ type: 'edit', school }} onClose={vi.fn()} onUpsert={onUpsert} onDelete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: 'Central Academy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(setSchool).toHaveBeenCalledWith({ id: school.id, name: 'Central Academy' }));
  });

  it('confirms school deletion', async () => {
    const onDelete = vi.fn();
    vi.mocked(deleteSchool).mockResolvedValue();
    render(<SchoolActionModal action={{ type: 'delete', school }} onClose={vi.fn()} onUpsert={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteSchool).toHaveBeenCalledWith(school.id));
    expect(onDelete).toHaveBeenCalledWith(school);
  });
});
