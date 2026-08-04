import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Homepage from './Homepage';

const homepageState = vi.hoisted(() => ({
  loading: false,
  error: null as string | null,
}));
const mockUseSectionRouting = vi.hoisted(() => vi.fn());

vi.mock('../../common/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    loading: false,
    permissions: [],
    role: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('./hooks/useHomepageContent', () => ({
  useHomepageContent: () => ({
    content: {
      images: [{
        id: 'image-1',
        imageUrl: '/programming/adventure_bay.png',
        altText: 'Youth trip',
        caption: 'Youth trip.',
        displayOrder: 0,
        createdAt: '2026-07-27T12:00:00.000Z',
        updatedAt: '2026-07-27T12:00:00.000Z',
      }],
      sessions: [],
    },
    loading: homepageState.loading,
    error: homepageState.error,
    refresh: vi.fn(),
  }),
}));

vi.mock('./hooks/useSectionRouting', () => ({
  useSectionRouting: mockUseSectionRouting,
}));

describe('Homepage', () => {
  beforeEach(() => {
    homepageState.loading = false;
    homepageState.error = null;
    mockUseSectionRouting.mockClear();
  });

  it('renders the public homepage sections', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Homepage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /programming/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /organizational history/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /interested/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /meet our team/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /partners/i })).toBeInTheDocument();

    const teamSection = screen.getByRole('heading', { name: /meet our team/i }).closest('section');
    expect(teamSection).not.toBeNull();
    const teamCards = within(teamSection!).getAllByRole('listitem');
    expect(teamCards[0]).toHaveTextContent('Quinton Macnevin');
    expect(teamCards[0]).toHaveTextContent(
      'Drawing from both his professional experience and his lived experience as a former Crown ward',
    );
    expect(teamCards[1]).toHaveTextContent('Hi, my name is Amanat!');
    expect(teamCards[1].querySelector('img')).toHaveAttribute('src', '/team/amanat.png');
  });

  it('defers direct section routing until managed content has loaded', () => {
    homepageState.loading = true;
    const view = render(
      <MemoryRouter initialEntries={['/sign-up']}>
        <Homepage />
      </MemoryRouter>,
    );

    expect(mockUseSectionRouting).toHaveBeenLastCalledWith({ disabled: true });

    homepageState.loading = false;
    view.rerender(
      <MemoryRouter initialEntries={['/sign-up']}>
        <Homepage />
      </MemoryRouter>,
    );

    expect(mockUseSectionRouting).toHaveBeenLastCalledWith({ disabled: false });
  });
});
