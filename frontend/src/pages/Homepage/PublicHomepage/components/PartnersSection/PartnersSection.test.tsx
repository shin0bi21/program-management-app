import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PartnersSection from './PartnersSection';

describe('PartnersSection', () => {
  it('renders each partner with meaningful image text', () => {
    render(<PartnersSection />);

    expect(screen.getByRole('img', { name: 'Ontario Trillium Foundation' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'STAG' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Workforce WindsorEssex' })).toBeInTheDocument();
  });
});
