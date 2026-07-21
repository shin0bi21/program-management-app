import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Youth from './Youth';
import { makeYouthProfile } from '../../tests/factories/youth';

const mockUseYouth = vi.fn();

vi.mock('./hooks/useYouth', () => ({
  useYouth: () => mockUseYouth(),
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
});
