import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Images from './Images';
import type HomepageImageList from './components/HomepageImageList/HomepageImageList';
import type HomepageImageModal from './components/HomepageImageModal/HomepageImageModal';

const children = vi.hoisted(() => ({
  list: null as ComponentProps<typeof HomepageImageList> | null,
  editor: null as ComponentProps<typeof HomepageImageModal> | null,
}));

vi.mock('./components/HomepageImageList/HomepageImageList', () => ({
  default: (props: ComponentProps<typeof HomepageImageList>) => {
    children.list = props;
    return <div data-testid="image-list" />;
  },
}));
vi.mock('./components/HomepageImageModal/HomepageImageModal', () => ({
  default: (props: ComponentProps<typeof HomepageImageModal>) => {
    children.editor = props;
    return props.isOpen ? <div role="dialog" aria-label="Image editor" /> : null;
  },
}));

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
  saveImage: vi.fn(),
  deleteImage: vi.fn(),
  reorderImages: vi.fn(),
  reordering: false,
}));

const auth = vi.hoisted(() => ({ permissions: ['read:homepage', 'write:homepage'] as string[] }));
vi.mock('../../../auth/authContext', () => ({ useAuth: () => auth }));

vi.mock('./hooks/useManagedHomepage', () => ({
  useManagedHomepage: () => homepage,
}));

describe('Images', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    children.list = null;
    children.editor = null;
    homepage.loading = false;
    homepage.error = null;
    homepage.reordering = false;
    auth.permissions = ['read:homepage', 'write:homepage'];
  });

  // Entry and readiness.
  it('keeps homepage content readable and removes write entry points for read-only users', () => {
    auth.permissions = ['read:homepage'];
    renderPage();

    expect(screen.getByTestId('image-list')).toBeInTheDocument();
    expect(children.list?.canWrite).toBe(false);
    expect(screen.queryByRole('button', { name: '+ Add' })).not.toBeInTheDocument();
  });

  it('does not expose write controls while an image reorder is saving', () => {
    homepage.reordering = true;
    renderPage();

    expect(screen.getByRole('button', { name: '+ Add' })).toBeDisabled();
    expect(children.list?.mutationsPending).toBe(true);
  });

  // Commands and dialogs.
  it('opens the page-owned image editor from the page header', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));

    expect(screen.getByRole('dialog', { name: 'Image editor' })).toBeInTheDocument();
    expect(children.editor?.image).toBeNull();
  });

  it('connects confirmed deletion to the managed homepage hook', async () => {
    homepage.deleteImage.mockResolvedValue(undefined);
    renderPage();

    act(() => children.list!.onDelete(homepage.images[0]));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Confirm' })));

    expect(homepage.deleteImage).toHaveBeenCalledWith('image-1');
  });
});

/**
 * Renders image management with the page's router context.
 * @example renderPage() // image management with the mocked permission and saved-record owners
 */
function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Images />
    </MemoryRouter>,
  );
}
