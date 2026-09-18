import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PublicHomepage from './PublicHomepage';

const homepageState = vi.hoisted(() => ({
  imagesLoading: false,
  imagesError: null as string | null,
  programsLoading: false,
  programsError: null as string | null,
}));
const mockUseSectionRouting = vi.hoisted(() => vi.fn());

vi.mock('../../../auth/authContext', () => ({
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

vi.mock('./hooks/useHomepagePrograms', () => ({
  useHomepagePrograms: () => ({
    programs: [],
    loading: homepageState.programsLoading,
    error: homepageState.programsError,
    refresh: vi.fn(),
  }),
}));

vi.mock('./hooks/useSectionRouting', () => ({
  useSectionRouting: mockUseSectionRouting,
}));

describe('PublicHomepage', () => {
  beforeEach(() => {
    homepageState.imagesLoading = false;
    homepageState.imagesError = null;
    homepageState.programsLoading = false;
    homepageState.programsError = null;
    mockUseSectionRouting.mockClear();
  });

  it('composes public navigation with loaded homepage content', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PublicHomepage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('navigation', { name: 'Page sections' })).toBeInTheDocument();
    expect(screen.getByAltText('Youth trip')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /programming/i })).toBeInTheDocument();
  });

  it('defers direct section routing until managed content has loaded', () => {
    homepageState.imagesLoading = true;
    const view = render(
      <MemoryRouter initialEntries={['/sign-up']}>
        <PublicHomepage />
      </MemoryRouter>,
    );

    expect(mockUseSectionRouting).toHaveBeenLastCalledWith({ disabled: true });
    expect(screen.getByRole('status')).toHaveTextContent('Loading photos…');
    expect(document.querySelector('.hero-photo-frame')).toBeInTheDocument();

    homepageState.imagesLoading = false;
    view.rerender(
      <MemoryRouter initialEntries={['/sign-up']}>
        <PublicHomepage />
      </MemoryRouter>,
    );

    expect(mockUseSectionRouting).toHaveBeenLastCalledWith({ disabled: false });
    expect(screen.getByAltText('Youth trip')).toBeInTheDocument();
  });

  it('renders hero images independently while programming loads', () => {
    homepageState.programsLoading = true;
    render(
      <MemoryRouter>
        <PublicHomepage />
      </MemoryRouter>,
    );

    expect(screen.getByAltText('Youth trip')).toBeInTheDocument();
    expect(screen.getByText('Loading programs…')).toBeInTheDocument();
  });
});
