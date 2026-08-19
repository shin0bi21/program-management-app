import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SiteFooter from './SiteFooter';

describe('SiteFooter', () => {
  it('renders the organization contact and external social links', () => {
    render(<SiteFooter />);

    expect(screen.getByRole('contentinfo', { name: 'Footer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'beoriginalyouthgroup@gmail.com' }))
      .toHaveAttribute('href', 'mailto:beoriginalyouthgroup@gmail.com');
    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute('rel', 'noreferrer');
  });
});
