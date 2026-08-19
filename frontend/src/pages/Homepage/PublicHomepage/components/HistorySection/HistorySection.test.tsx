import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HistorySection from './HistorySection';

describe('HistorySection', () => {
  it('renders the organization timeline in chronological order', () => {
    render(<HistorySection />);

    const years = screen.getAllByText(/^20\d{2}$/).map((element) => element.textContent);
    expect(years).toEqual(['2022', '2024', '2026']);
    expect(screen.getByRole('heading', { name: 'Organizational History' })).toBeInTheDocument();
  });
});
