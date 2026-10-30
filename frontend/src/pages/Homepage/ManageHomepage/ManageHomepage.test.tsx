import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ManageHomepage from './ManageHomepage';

const homepage = vi.hoisted(() => ({
  images: [{
    id: 'image-1',
    imageUrl: '/programming/adventure_bay.png',
    mobileUrl: '/programming/adventure_bay-mobile.webp',
    thumbnailUrl: '/programming/adventure_bay.png',
    altText: 'Youth group trip',
    caption: 'Adventure Bay trip.',
    displayOrder: 0,
    createdAt: '2026-07-27T12:00:00.000Z',
    updatedAt: '2026-07-27T12:00:00.000Z',
  }],
  loading: false,
  error: null as string | null,
  refresh: vi.fn(),
  deleteImage: vi.fn(),
  reorderImages: vi.fn(),
}));

vi.mock('./hooks/useManagedHomepage', () => ({
  useManagedHomepage: () => homepage,
}));

vi.mock('./components/HomepageSignupSetting/HomepageSignupSetting', () => ({
  default: () => <section aria-label="Homepage signup setting" />,
}));

const renderPage = () => render(
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <ManageHomepage />
  </MemoryRouter>,
);

describe('ManageHomepage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    homepage.loading = false;
    homepage.error = null;
  });

  // Rendered states.

  it('reports page-owned errors through the shared overlay with a retry action', async () => {
    const user = userEvent.setup();
    homepage.error = 'Could not load homepage images';
    renderPage();

    const errorOverlay = screen.getByRole('alert');
    expect(errorOverlay).toHaveTextContent('Could not load homepage images');
    await user.click(within(errorOverlay).getByRole('button', { name: 'Retry' }));

    expect(homepage.refresh).toHaveBeenCalledOnce();
  });

  // Commands and dialogs.
  it('opens the page-owned image editor from the Images card', async () => {
    const user = userEvent.setup();
    renderPage();

    const images = screen.getByRole('region', { name: 'Images' });
    await user.click(within(images).getByRole('button', { name: '+ Add' }));

    expect(screen.getByRole('dialog', { name: 'Manage Images' })).toBeInTheDocument();
    expect(screen.getByLabelText('Image')).toBeInTheDocument();
  });

  it('connects confirmed deletion to the managed homepage hook', async () => {
    const user = userEvent.setup();
    homepage.deleteImage.mockResolvedValue(undefined);
    renderPage();

    await user.click(screen.getByRole('button', { name: 'More actions for Adventure Bay trip.' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete Image' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(homepage.deleteImage).toHaveBeenCalledWith('image-1');
  });
});
