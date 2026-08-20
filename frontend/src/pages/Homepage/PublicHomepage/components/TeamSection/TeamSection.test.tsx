import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import TeamSection from './TeamSection';

describe('TeamSection', () => {
  it('renders every team member and their responsive profile image', () => {
    render(<TeamSection />);

    const section = screen.getByRole('heading', { name: 'Meet our team' }).closest('section');
    expect(section).not.toBeNull();
    const cards = within(section!).getAllByRole('listitem');
    expect(cards).toHaveLength(5);
    expect(cards[0]).toHaveTextContent('Quinton Macnevin');
    expect(cards[2]).toHaveTextContent("Hi, I'm Bilal!");
    expect(cards[3].querySelector('source')).toHaveAttribute('srcset', '/team/jomariel-mobile.webp');
    expect(cards[4]).toHaveTextContent('I serve my community willingly');
  });
});
