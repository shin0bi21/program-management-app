import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import ProgramTable from './ProgramTable';

it('renders programs', () => {
  const program = { id: 'program-1', name: 'Skills', description: '', rosterMode: 'open' as const, minAge: null, maxAge: null, defaultDayOfWeek: 'tuesday' as const, defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto' as const };

  render(<ProgramTable
    columns={[{ id: 'name', header: 'Program', accessorFn: item => item.name }]}
    programs={[program]}
    loading={false}
  />);

  expect(screen.getByText('Skills')).toBeInTheDocument();
});
