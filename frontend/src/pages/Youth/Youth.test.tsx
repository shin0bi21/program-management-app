import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Youth from './Youth';
import { makeYouthProfile } from '../../tests/factories/youth';

const mockUseYouth = vi.fn();

vi.mock('./hooks/useYouth', () => ({
  useYouth: (...args: unknown[]) => mockUseYouth(...args),
}));

vi.mock('../../common/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Soft Skills' }], loading: false, error: '' }),
}));

vi.mock('../../common/context/AuthContext', () => ({
  useAuth: () => ({ permissions: ['read:youth_profiles', 'write:youth_profiles'] }),
}));

vi.mock('../../common/components/Header/Header', () => ({ default: () => null }));
vi.mock('./components/YouthModal/YouthModal', () => ({ default: () => null }));
vi.mock('../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: { id: string; label: string }[] }) => (
    <div>{items.map(item => <span key={item.id}>{item.label}</span>)}</div>
  ),
}));

describe('Youth', () => {
  beforeEach(() => {
    mockUseYouth.mockReturnValue({
      youth: [makeYouthProfile({ account: null })],
      setYouth: vi.fn(),
      loading: false,
      error: null,
    });
  });

  it('keeps account invitation controls out of the Youth page', () => {
    render(<Youth />);

    expect(screen.getByRole('button', { name: '+ Add Youth' })).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.queryByText('Invite')).not.toBeInTheDocument();
  });

  it('requests youth filtered by program', async () => {
    render(<Youth />);

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Program/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Soft Skills' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(mockUseYouth).toHaveBeenLastCalledWith({
      search: '',
      statuses: [],
      programIds: ['program-1'],
    }));
  });

  it('shows the selected profile contact and notes', () => {
    mockUseYouth.mockReturnValue({
      youth: [makeYouthProfile({
        notes: 'Youth profile note',
        contacts: [{ id: 'contact-1', firstName: 'Parent', lastName: 'One', phoneNumber: '416-555-0101', type: 'parent' }],
      })],
      setYouth: vi.fn(), loading: false, error: null,
    });
    render(<Youth />);

    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    expect(screen.getByText('Parent One')).toBeInTheDocument();
    expect(screen.getByText('Youth profile note')).toBeInTheDocument();
  });
});
