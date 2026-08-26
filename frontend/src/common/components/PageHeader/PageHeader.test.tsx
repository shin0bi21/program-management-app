import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PageHeader from './PageHeader';

describe('PageHeader', () => {
  it('renders a page title with optional actions', () => {
    render(<PageHeader title="Outreach" actions={<button type="button">Create Lead</button>} />);

    expect(screen.getByRole('heading', { name: 'Outreach' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Lead' })).toBeInTheDocument();
  });

  it('groups view and data controls inside one control region', () => {
    const { container } = render(
      <PageHeader
        title="Accounts"
        columns={<button type="button">Columns</button>}
        filters={<button type="button">Filters</button>}
        search={<input aria-label="Search accounts" />}
        view={<button type="button">View: Cards</button>}
      />,
    );

    const header = container.querySelector('header');
    const controls = header?.querySelector('.page-header-controls');
    const viewControls = controls?.querySelector('.page-header-view-controls');
    const dataControls = controls?.querySelector('.page-header-data-controls');

    expect(header).not.toBeNull();
    expect(Array.from(header!.children).map(child => child.className)).toEqual([
      'page-title-row',
      'page-header-controls',
    ]);
    expect(Array.from(controls!.children).map(child => child.className)).toEqual([
      'page-header-view-controls',
      'page-header-data-controls',
    ]);
    expect(Array.from(viewControls!.children).map(child => child.className)).toEqual([
      'page-header-columns',
      'page-header-view',
    ]);
    expect(Array.from(dataControls!.children).map(child => child.className)).toEqual([
      'page-header-search',
      'page-header-filters',
    ]);
  });
});
