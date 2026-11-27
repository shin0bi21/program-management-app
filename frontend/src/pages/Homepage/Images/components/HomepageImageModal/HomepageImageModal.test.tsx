import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHomepageImage, updateHomepageImage } from '../../manageHomepage.api';
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
  beforeEach(() => vi.resetAllMocks());

  it('submits the edited caption and locks the form on success', async () => {
    const user = userEvent.setup();
    const saved = { ...image, caption: 'Updated caption.' };
    vi.mocked(updateHomepageImage).mockResolvedValue(saved);
    const onSaved = vi.fn();
    render(<HomepageImageModal image={image} isOpen onClose={vi.fn()} onSaved={onSaved} />);

    const caption = screen.getByLabelText('Caption');
    expect(caption).toHaveValue('Original caption.');
    await user.clear(caption);
    await user.type(caption, ' Updated caption. ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledExactlyOnceWith(saved));
    expect(updateHomepageImage).toHaveBeenCalledWith(image.id, { caption: 'Updated caption.' });
    expect(caption).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('submits the file selected in the upload field', async () => {
    const user = userEvent.setup();
    vi.mocked(createHomepageImage).mockResolvedValue(image);
    const onSaved = vi.fn();
    render(<HomepageImageModal image={null} isOpen onClose={vi.fn()} onSaved={onSaved} />);

    const file = new File(['image'], 'homepage.webp', { type: 'image/webp' });
    await user.upload(screen.getByLabelText('Image'), file);
    const caption = screen.getByLabelText('Caption');
    await user.type(caption, image.caption);
    fireEvent.submit(caption.closest('form')!);

    await waitFor(() => expect(onSaved).toHaveBeenCalledExactlyOnceWith(image));
    expect(createHomepageImage).toHaveBeenCalledWith({ image: file, caption: image.caption });
  });
});
