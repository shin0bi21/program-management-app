import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ResourceCard from './ResourceCard';

describe('ResourceCard', () => {
  it('combines education and school in the staff details', () => {
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

    expect(screen.getByText('Social Work, University of Windsor')).toBeInTheDocument();
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
