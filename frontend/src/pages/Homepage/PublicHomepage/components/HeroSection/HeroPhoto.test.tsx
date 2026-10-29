import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HeroPhoto from './HeroPhoto';

describe('HeroPhoto', () => {
  it('falls back from the mobile source before reporting an unavailable image', () => {
    render(<HeroPhoto photo={{
      src: '/desktop.webp',
      mobileSrc: '/mobile.webp',
      alt: 'Youth event',
      caption: 'Youth event.',
    }} />);

    const image = screen.getByAltText('Youth event');
    expect(document.querySelector('source')).toHaveAttribute('srcset', '/mobile.webp');
    fireEvent.error(image);
    expect(document.querySelector('source')).not.toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/desktop.webp');
    fireEvent.error(image);
    expect(screen.getByRole('status')).toHaveTextContent('Photo unavailable');
  });
});
