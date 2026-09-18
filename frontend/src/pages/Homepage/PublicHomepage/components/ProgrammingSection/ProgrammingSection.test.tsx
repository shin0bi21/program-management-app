import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { HomepageProgram } from '../../types';
import ProgrammingSection from './ProgrammingSection';

const programs = [
  {
    id: 'program-1',
    name: 'Future Ready',
    description: 'Build communication skills.',
    rosterMode: 'enrolled',
    minAge: 12,
    maxAge: 15,
    sessions: [{
      id: 'session-1',
      theme: 'Communication',
      startsAt: '2026-08-04T21:00:00.000Z',
    }],
  },
] satisfies HomepageProgram[];

describe('ProgrammingSection', () => {
  it('renders the grouped programs returned by the public API', () => {
    const { container } = render(<ProgrammingSection programs={programs} />);

    expect(screen.getByRole('heading', { name: /programming/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.program-card')).toHaveLength(1);
    expect(screen.getByText('Future Ready')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
  });

  it('shows the empty state when the API has no programs', () => {
    render(<ProgrammingSection programs={[]} />);
    expect(screen.getByText('No programs available.')).toBeInTheDocument();
  });

  it('shows one loading state while programs load', () => {
    render(<ProgrammingSection programs={[]} loading />);

    expect(screen.getByText('Loading programs…')).toBeInTheDocument();
    expect(document.querySelector('.program-grid')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows one retry action when schedules fail', () => {
    const onRetry = vi.fn();
    render(<ProgrammingSection programs={[]} error="Network error" onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Programming couldn’t load.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
