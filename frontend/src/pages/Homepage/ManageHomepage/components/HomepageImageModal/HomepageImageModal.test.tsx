import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateHomepageImage } from '../../manageHomepage.api';
import type { ManagedHomepageImage } from '../../types';
import HomepageImageModal from './HomepageImageModal';

vi.mock('../../manageHomepage.api', () => ({
  createHomepageImage: vi.fn(),
  updateHomepageImage: vi.fn(),
}));

const image: ManagedHomepageImage = {
  id: 'image-1',
  imageUrl: '/image.webp',
  mobileUrl: '/image-mobile.webp',
  thumbnailUrl: '/image-thumbnail.webp',
  altText: 'Youth event',
  caption: 'Original caption.',
  displayOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('HomepageImageModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates an existing image and refreshes its management owner', async () => {
    const onSaved = vi.fn().mockResolvedValue(undefined);
    vi.mocked(updateHomepageImage).mockResolvedValue({ id: image.id });
    render(<HomepageImageModal image={image} isOpen onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Caption'), { target: { value: ' Updated caption. ' } });
    fireEvent.submit(document.getElementById('homepage-image-form')!);

    await waitFor(() => expect(updateHomepageImage).toHaveBeenCalledWith(
      image.id,
      { caption: 'Updated caption.' },
    ));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('Homepage image updated.');
  });
});
