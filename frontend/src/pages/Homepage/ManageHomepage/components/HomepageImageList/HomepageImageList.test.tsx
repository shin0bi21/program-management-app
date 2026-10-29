import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import HomepageImageList from './HomepageImageList';

const images = [
  {
    id: 'image-1',
    imageUrl: '/image-1.webp',
    mobileUrl: '/image-1-mobile.webp',
    thumbnailUrl: '/image-1-thumbnail.webp',
    altText: 'First image',
    caption: 'First image.',
    displayOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'image-2',
    imageUrl: '/image-2.webp',
    mobileUrl: '/image-2-mobile.webp',
    thumbnailUrl: '/image-2-thumbnail.webp',
    altText: 'Second image',
    caption: 'Second image.',
    displayOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const defaultProps = {
  images,
  loading: false,
  error: null,
  onRetry: vi.fn(),
  onAdd: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onReorder: vi.fn(),
};

describe('HomepageImageList', () => {
  it('renders loading, error, empty, and populated states', () => {
    const { rerender } = render(<HomepageImageList {...defaultProps} loading />);
    expect(screen.getByText('Loading images…')).toBeInTheDocument();

    rerender(<HomepageImageList {...defaultProps} images={[]} error="Could not load images" />);
    expect(screen.getByText('Homepage images unavailable')).toBeInTheDocument();

    rerender(<HomepageImageList {...defaultProps} images={[]} />);
    expect(screen.getByText('No homepage images')).toBeInTheDocument();

    rerender(<HomepageImageList {...defaultProps} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('emits edit and delete actions', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <HomepageImageList
        {...defaultProps}
        images={[images[0]]}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'More actions for First image.' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit Image' }));
    await user.click(screen.getByRole('button', { name: 'More actions for First image.' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete Image' }));

    expect(onEdit).toHaveBeenCalledWith(images[0]);
    expect(onDelete).toHaveBeenCalledWith(images[0]);
  });

  it('emits the source and target ids after a drop', async () => {
    const onReorder = vi.fn();
    render(<HomepageImageList {...defaultProps} onReorder={onReorder} />);
    const rows = screen.getAllByRole('listitem');
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(() => 'image-2'),
    };

    fireEvent.dragStart(rows[1], { dataTransfer });
    fireEvent.dragEnter(rows[0]);
    fireEvent.dragOver(rows[0], { dataTransfer });
    fireEvent.drop(rows[0], { dataTransfer });

    await waitFor(() => expect(onReorder).toHaveBeenCalledWith('image-2', 'image-1'));
  });
});
