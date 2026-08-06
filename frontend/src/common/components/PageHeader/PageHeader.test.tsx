import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PageHeader from './PageHeader';

describe('PageHeader', () => {
  it('renders a page title with optional actions', () => {
    render(<PageHeader title="Outreach" actions={<button type="button">Create Lead</button>} />);

    expect(screen.getByRole('heading', { name: 'Outreach' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Lead' })).toBeInTheDocument();
  });

  it('renders filter, search, and view controls inside the same header', () => {
    const { container } = render(
      <PageHeader
        title="Accounts"
        filters={<button type="button">Filters</button>}
        search={<input aria-label="Search accounts" />}
        view={<button type="button">View: Cards</button>}
      />,
    );

    const header = container.querySelector('header');
    expect(header).toContainElement(screen.getByRole('button', { name: 'Filters' }));
    expect(header).toContainElement(screen.getByRole('textbox', { name: 'Search accounts' }));
    expect(header).toContainElement(screen.getByRole('button', { name: 'View: Cards' }));
  });
});
