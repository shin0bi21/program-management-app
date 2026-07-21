import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Outreach from './Outreach';

vi.mock('../../common/components/Header/Header', () => ({
  default: () => <div data-testid="header" />,
}));

describe('Outreach', () => {
  it('renders the selected route without duplicating sidebar navigation', () => {
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
    expect(screen.queryByRole('navigation', { name: 'Outreach views' })).not.toBeInTheDocument();
    expect(screen.getByText('Submission view')).toBeInTheDocument();
  });
});
