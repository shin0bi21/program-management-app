import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ResourceCard from './ResourceCard';

describe('ResourceCard', () => {
  it('renders responsive staff details when a photo is available', () => {
    render(<ResourceCard
      name="Jamie Test"
      role="Facilitator"
      bio="Supports local youth."
      education="Social Work"
      school="University of Windsor"
      imageSrc="/jamie.webp"
      imageMobileSrc="/jamie-mobile.webp"
      imageAlt="Jamie at a youth event"
    />);

    expect(screen.getByRole('listitem')).toHaveTextContent('Jamie Test');
    expect(screen.getByText('Social Work, University of Windsor')).toBeInTheDocument();
    expect(screen.getByAltText('Jamie at a youth event')).toHaveAttribute('src', '/jamie.webp');
    expect(document.querySelector('source')).toHaveAttribute('srcset', '/jamie-mobile.webp');
  });

  it('uses an initial placeholder when no image is supplied', () => {
    const { container } = render(<ResourceCard
      name="Jamie Test"
      role="Facilitator"
      bio="Supports local youth."
    />);

    expect(container.querySelector('.resource-photo-placeholder')).toHaveTextContent('J');
  });
});
