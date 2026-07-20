import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Outreach from './Outreach';

vi.mock('../../common/components/Header/Header', () => ({
  default: () => <div data-testid="header" />,
}));

describe('Outreach', () => {
  it('provides route-backed tabs and renders the selected view', () => {
    render(
      <MemoryRouter initialEntries={['/outreach/submissions']}>
        <Routes>
          <Route path="/outreach" element={<Outreach />}>
            <Route path="submissions" element={<div>Submission view</div>} />
            <Route path="leads" element={<div>Lead view</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Outreach' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Public Interest' })).toHaveAttribute('href', '/outreach/submissions');
    expect(screen.getByRole('link', { name: 'Public Interest' })).toHaveClass('active');
    expect(screen.getByRole('link', { name: 'Leads' })).toHaveAttribute('href', '/outreach/leads');
    expect(screen.getByText('Submission view')).toBeInTheDocument();
  });
});
