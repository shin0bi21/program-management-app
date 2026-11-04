import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagedHomepageImage } from '../../types';
import HomepageImageModal from './HomepageImageModal';
import useHomepageImageModal from './hooks/useHomepageImageModal';

const workflow = vi.hoisted<ReturnType<typeof useHomepageImageModal>>(() => ({
  status: 'idle',
  statusMessage: '',
  submissionComplete: false,
  setSelectedFile: vi.fn(),
  submit: vi.fn(),
}));

vi.mock('./hooks/useHomepageImageModal', () => ({ default: vi.fn(() => workflow) }));

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
  beforeEach(() => {
    workflow.status = 'idle';
    workflow.statusMessage = '';
    workflow.submissionComplete = false;
    vi.clearAllMocks();
  });

  it('renders the edit caption field and submits a trimmed caption through the workflow', () => {
    const onSaved = vi.fn();
    const view = render(<HomepageImageModal image={image} isOpen onClose={vi.fn()} onSaved={onSaved} />);

    expect(useHomepageImageModal).toHaveBeenCalledWith({ image, isOpen: true, onSaved });
    const caption = screen.getByLabelText('Caption');
    expect(caption).toHaveValue('Original caption.');
    expect(caption).toHaveAttribute('maxlength', '500');

    fireEvent.change(caption, { target: { value: ' Updated caption. ' } });
    fireEvent.submit(document.getElementById('homepage-image-form')!);
    expect(workflow.submit).toHaveBeenCalledWith('Updated caption.');

    workflow.status = 'success';
    workflow.statusMessage = 'Homepage image updated.';
    workflow.submissionComplete = true;
    view.rerender(<HomepageImageModal image={image} isOpen onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(caption).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Homepage image updated.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('renders the required upload field and wires selected files to the workflow', () => {
    render(<HomepageImageModal image={null} isOpen onClose={vi.fn()} onSaved={vi.fn()} />);

    const file = screen.getByLabelText('Image');
    expect(file).toHaveAttribute('type', 'file');
    expect(file).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    expect(file).toBeRequired();
    expect(screen.getByLabelText('Caption')).toBeRequired();

    const selectedFile = new File(['image'], 'homepage.webp', { type: 'image/webp' });
    fireEvent.change(file, { target: { files: [selectedFile] } });
    expect(workflow.setSelectedFile).toHaveBeenCalledWith(selectedFile);
  });
});
