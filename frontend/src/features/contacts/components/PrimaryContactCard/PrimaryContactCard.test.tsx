import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrimaryContactCard from './PrimaryContactCard';

describe('PrimaryContactCard', () => {
  it('distinguishes no row selection from a selected row with no contact', () => {
    const { rerender } = render(<PrimaryContactCard contact={null} selected={false} />);
    expect(screen.getByText('Select a row to view the primary contact.')).toBeInTheDocument();

    rerender(<PrimaryContactCard contact={null} selected />);
    expect(screen.getByText('No primary contact recorded.')).toBeInTheDocument();
  });

  it('shows primary contact details in one compact summary', () => {
    render(<PrimaryContactCard contact={{ phoneNumber: '2262604073', relationship: 'parent' }} selected />);

    const summary = screen.getByText('2262604073').closest('p');
    expect(summary).toHaveClass('primary-contact-card__summary');
    expect(summary).toContainElement(screen.getByText('Parent'));
  });
});
