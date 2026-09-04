import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import YouthDashboardTabs from './YouthDashboardTabs';

const options = [
  { value: 'overview', label: 'Overview' },
  { value: 'sessions', label: 'Sessions' },
] as const;

describe('YouthDashboardTabs', () => {
  it('renders an accessible single active selection and emits the selected value', () => {
    const onChange = vi.fn();
    render(
      <YouthDashboardTabs
        activeTab="overview"
        ariaLabel="Attendance views"
        onChange={onChange}
        options={options}
      />,
    );

    expect(screen.getByRole('group', { name: 'Attendance views' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Sessions' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    expect(onChange).toHaveBeenCalledWith('sessions');
  });
});
