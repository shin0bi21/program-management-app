import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PageBody from './PageBody';

describe('PageBody', () => {
  it('composes dashboard and table regions with stable page-level names', () => {
    const { container } = render(
      <PageBody
        ariaLabel="Profiles and overview"
        dashboard={<div>Overview</div>}
        table={<div>Profiles table</div>}
      />,
    );

    expect(screen.getByRole('region', { name: 'Profiles and overview' })).toHaveClass('page-body');
    expect(container.querySelector('.page-dashboard')).toHaveTextContent('Overview');
    expect(container.querySelector('.page-table')).toHaveTextContent('Profiles table');
    expect(container.querySelector('.page-calendar')).not.toBeInTheDocument();
  });

  it('uses the calendar region for calendar pages', () => {
    const { container } = render(
      <PageBody
        ariaLabel="Schedule and overview"
        dashboard={<div>Overview</div>}
        calendar={<div>Schedule</div>}
      />,
    );

    expect(container.querySelector('.page-calendar')).toHaveTextContent('Schedule');
    expect(container.querySelector('.page-table')).not.toBeInTheDocument();
  });
});
