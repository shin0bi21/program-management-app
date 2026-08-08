import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Homepage from './Homepage';

const homepageState = vi.hoisted(() => ({
  imagesLoading: false,
  imagesError: null as string | null,
  sessionsLoading: false,
  sessionsError: null as string | null,
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

vi.mock('./hooks/useHomepageImages', () => ({
  useHomepageImages: () => ({
    images: [{
      id: 'image-1',
      imageUrl: '/programming/adventure_bay.png',
      mobileUrl: '/programming/adventure_bay-mobile.webp',
      thumbnailUrl: '/programming/adventure_bay.png',
      altText: 'Youth trip',
      caption: 'Youth trip.',
      displayOrder: 0,
      createdAt: '2026-07-27T12:00:00.000Z',
      updatedAt: '2026-07-27T12:00:00.000Z',
    }],
    loading: homepageState.imagesLoading,
    error: homepageState.imagesError,
    refresh: vi.fn(),
  }),
}));

vi.mock('./hooks/useHomepageSessions', () => ({
  useHomepageSessions: () => ({
    sessions: [],
    loading: homepageState.sessionsLoading,
    error: homepageState.sessionsError,
    refresh: vi.fn(),
  }),
}));

vi.mock('./hooks/useSectionRouting', () => ({
  useSectionRouting: mockUseSectionRouting,
}));

describe('Homepage', () => {
  beforeEach(() => {
    homepageState.imagesLoading = false;
    homepageState.imagesError = null;
    homepageState.sessionsLoading = false;
    homepageState.sessionsError = null;
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
    expect(teamCards[1].querySelector('img')).toHaveAttribute('src', '/team/amanat-display.webp');
    expect(teamCards[2]).toHaveTextContent("Hi, I'm Bilal! I've been a part of Be Original since 2022.");
    expect(teamCards[2].querySelector('source')).toHaveAttribute('srcset', '/team/bilal-mobile.webp');
    expect(teamCards[2].querySelector('img')).toHaveAttribute('src', '/team/bilal-display.webp');
    expect(teamCards[4]).toHaveTextContent('I serve my community willingly with the utmost humility.');
    expect(teamCards[4].querySelector('img')).toHaveAttribute('src', '/team/elijah-display.webp');
  });

  it('defers direct section routing until managed content has loaded', () => {
    homepageState.imagesLoading = true;
    const view = render(
      <MemoryRouter initialEntries={['/sign-up']}>
        <Homepage />
      </MemoryRouter>,
    );

    expect(mockUseSectionRouting).toHaveBeenLastCalledWith({ disabled: true });
    expect(screen.getByRole('status')).toHaveTextContent('Loading photos…');
    expect(document.querySelector('.hero-photo-frame')).toBeInTheDocument();

    homepageState.imagesLoading = false;
    view.rerender(
      <MemoryRouter initialEntries={['/sign-up']}>
        <Homepage />
      </MemoryRouter>,
    );

    expect(mockUseSectionRouting).toHaveBeenLastCalledWith({ disabled: false });
    expect(screen.getByAltText('Youth trip')).toBeInTheDocument();
  });

  it('renders hero images independently while programming sessions load', () => {
    homepageState.sessionsLoading = true;
    render(
      <MemoryRouter>
        <Homepage />
      </MemoryRouter>,
    );

    expect(screen.getByAltText('Youth trip')).toBeInTheDocument();
    expect(screen.getAllByText('Loading schedule…')).toHaveLength(3);
  });
});
