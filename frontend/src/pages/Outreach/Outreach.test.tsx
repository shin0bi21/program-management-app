import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Outreach from './Outreach';

describe('Outreach', () => {
  it('renders the selected route without duplicating sidebar navigation', () => {
    render(
      <MemoryRouter initialEntries={['/outreach/expressions-of-interest']}>
        <Routes>
          <Route path="/outreach" element={<Outreach />}>
            <Route path="expressions-of-interest" element={<div>Expression of Interest view</div>} />
            <Route path="leads" element={<div>Lead view</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('navigation', { name: 'Outreach views' })).not.toBeInTheDocument();
    expect(screen.getByText('Expression of Interest view')).toBeInTheDocument();
  });
});
