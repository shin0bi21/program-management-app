import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';
import AddSessionModal from './AddSessionModal';

vi.mock('./hooks/useAddSessionModal', () => ({ default: () => ({
  programId: 'p1',
  program: { name: 'Art', timezone: 'America/Toronto' }, sessionTypes: [{ id: 'type-1', name: 'Regular' }],
  draft: { sessionTypeId: 'type-1', theme: '', date: '2026-10-27', startTime: '17:30', endTime: '19:30' },
  status: 'idle', message: '', locked: false, updateDraft: vi.fn(), selectProgram: vi.fn(), submit: vi.fn(),
}) }));
describe('AddSessionModal', () => {
  it('shows one editable date and separate times', () => {
    renderWithQueryClient(<AddSessionModal programs={[{
      id: 'p1', name: 'Art', rosterMode: 'open', minAge: null, maxAge: null,
      defaultDayOfWeek: 'tuesday', defaultStartTime: '17:30', defaultEndTime: '19:30', timezone: 'America/Toronto',
    }]} initialProgramId="p1" onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByLabelText('Session date')).toHaveValue('2026-10-27');
    expect(screen.getByLabelText('Start time')).toHaveValue('17:30');
    expect(screen.getByLabelText('End time')).toHaveValue('19:30');
    expect(screen.queryByLabelText('Cohort')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Program')).toHaveTextContent('Art');
    expect(screen.getByLabelText('Program')).toBeEnabled();
    expect(screen.getByLabelText('Program')).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByLabelText('Frequency')).not.toBeInTheDocument();
  });
});
