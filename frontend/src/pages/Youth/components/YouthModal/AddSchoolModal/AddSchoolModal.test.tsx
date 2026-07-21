import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSchool } from '../../../../../common/api/schools.api';
import AddSchoolModal from './AddSchoolModal';

vi.mock('../../../../../common/api/schools.api', () => ({
  createSchool: vi.fn(),
}));

describe('AddSchoolModal', () => {
  beforeEach(() => {
    vi.mocked(createSchool).mockReset();
  });

  it('requires a school name', async () => {
    render(<AddSchoolModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.submit(document.getElementById('add-school-form')!);
    expect(await screen.findByText('School name is required')).toBeInTheDocument();
  });

  it('creates a name-only school and returns it', async () => {
    const school = { id: 'school-1', name: 'Central High', board: null, address: null, postalCode: null };
    const onSuccess = vi.fn();
    vi.mocked(createSchool).mockResolvedValue(school);
    render(<AddSchoolModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: '  Central High  ' } });
    fireEvent.submit(document.getElementById('add-school-form')!);

    await waitFor(() => expect(createSchool).toHaveBeenCalledWith('Central High'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(school), { timeout: 1000 });
  });
});
