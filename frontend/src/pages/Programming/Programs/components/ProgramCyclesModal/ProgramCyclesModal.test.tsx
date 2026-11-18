import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import type { Program } from '../../types';
import ProgramCyclesModal from './ProgramCyclesModal';

const workflow = vi.hoisted(() => ({
  selectedCycleIds: ['cycle-1'],
  locked: false, ready: true,
  submitStatus: 'idle' as const, statusMessage: undefined,
  toggleCycle: vi.fn(), submit: vi.fn(),
}));
vi.mock('./hooks/useProgramCyclesModal', () => ({ default: () => workflow }));
const props = {
  program: { id: 'program-1', title: 'Skills' } as Program,
  cycles: [{ id: 'cycle-1', title: 'Fall', startsOn: '2026-09-01', endsOn: '2026-12-01', state: 'upcoming' as const }],
  assignments: [], assignmentsReady: true, assignmentsError: '', onRetryAssignments: vi.fn(),
  cyclesLoading: false, cyclesError: null, onRetryCycles: vi.fn(), onClose: vi.fn(),
};

beforeEach(() => Object.assign(workflow, { selectedCycleIds: ['cycle-1'], ready: true }));

it('shows failed assignment loading without presenting unchecked cycles as saved data', () => {
  render(<ProgramCyclesModal {...props} assignmentsReady={false} assignmentsError="Assignments unavailable" />);
  expect(screen.getByRole('alert')).toHaveTextContent('Assignments unavailable');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
});
