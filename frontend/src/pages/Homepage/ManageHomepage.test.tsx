import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ManageHomepage from './ManageHomepage';

const api = vi.hoisted(() => ({
  getManagedHomepage: vi.fn(),
  getPublicHomepage: vi.fn(),
  createHomepageImage: vi.fn(),
  updateHomepageImage: vi.fn(),
  deleteHomepageImage: vi.fn(),
  reorderHomepageImages: vi.fn(),
}));

vi.mock('./api/homepage.api', () => ({
  getManagedHomepage: api.getManagedHomepage,
  getPublicHomepage: api.getPublicHomepage,
  createHomepageImage: api.createHomepageImage,
  updateHomepageImage: api.updateHomepageImage,
  deleteHomepageImage: api.deleteHomepageImage,
  reorderHomepageImages: api.reorderHomepageImages,
}));

vi.mock('../../common/components/Header/Header', () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock('./components/SignupSection/SignupSection', () => ({
  default: () => (
    <section>
      <h2>Interested?</h2>
    </section>
  ),
}));

const content = {
  images: [
    {
      id: 'image-1',
      imageUrl: '/programming/adventure_bay.png',
      altText: 'Youth group trip',
      caption: 'Adventure Bay trip.',
      displayOrder: 0,
      createdAt: '2026-07-27T12:00:00.000Z',
      updatedAt: '2026-07-27T12:00:00.000Z',
    },
  ],
  sessions: [
    {
      id: 'session-1',
      cohortId: 'cohort-1',
      theme: 'Communication',
      description: null,
      startsAt: '2026-08-04T21:00:00.000Z',
      endsAt: '2026-08-04T23:00:00.000Z',
      cohortName: 'Summer 2026',
      programId: 'program-1',
      programName: 'Soft Skills',
      programDescription: 'Build communication skills.',
      rosterMode: 'enrolled' as const,
      minAge: 12,
      maxAge: 15,
      addedAt: '2026-07-27T12:00:00.000Z',
    },
  ],
};

describe('ManageHomepage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getManagedHomepage.mockResolvedValue({ images: content.images });
    api.getPublicHomepage.mockResolvedValue(content);
    api.createHomepageImage.mockResolvedValue({ id: 'image-2' });
    api.reorderHomepageImages.mockResolvedValue({ imageIds: [] });
  });

  it('shows managed images and the homepage preview', async () => {
    render(
      <MemoryRouter>
        <ManageHomepage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Adventure Bay trip.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Manage Sessions' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByRole('heading', { name: 'Homepage Preview' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Programming' }).length).toBeGreaterThan(0);
  });

  it('uploads a new hero image', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ManageHomepage />
      </MemoryRouter>,
    );

    await screen.findByText('Adventure Bay trip.');
    const imagesSection = screen.getByRole('heading', { name: 'Manage Images' }).closest('section')!;
    fireEvent.click(within(imagesSection).getByRole('button', { name: '+ Add' }));
    await user.upload(screen.getByLabelText('Image'), new File(['image'], 'new-image.png', { type: 'image/png' }));
    await user.type(screen.getByLabelText('Caption'), 'Community event.');
    fireEvent.submit(document.getElementById('homepage-image-form')!);

    await waitFor(() =>
      expect(api.createHomepageImage).toHaveBeenCalledWith(
        expect.objectContaining({
          caption: 'Community event.',
        }),
      ),
    );
  });

  it('persists hero image order after a drag and drop', async () => {
    api.getManagedHomepage.mockResolvedValue({
      ...content,
      images: [
        content.images[0],
        {
          ...content.images[0],
          id: 'image-2',
          caption: 'Second image.',
          displayOrder: 1,
        },
      ],
    });
    render(
      <MemoryRouter>
        <ManageHomepage />
      </MemoryRouter>,
    );

    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(() => 'image-2'),
    };
    const cards = await screen.findAllByRole('listitem');
    fireEvent.dragStart(cards[1], { dataTransfer });
    fireEvent.dragEnter(cards[0]);
    fireEvent.dragOver(cards[0], { dataTransfer });
    fireEvent.drop(cards[0], { dataTransfer });

    await waitFor(() => expect(api.reorderHomepageImages).toHaveBeenCalledWith(['image-2', 'image-1']));
  });
});
