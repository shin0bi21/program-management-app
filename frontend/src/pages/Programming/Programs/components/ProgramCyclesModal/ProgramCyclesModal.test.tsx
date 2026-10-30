import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import type { Program } from '../../../../../common/features/programs/types';
import ProgramCyclesModal from './ProgramCyclesModal';

const workflow = vi.hoisted(() => ({
  selectedCycleIds: ['cycle-1'] as string[] | null,
  locked: false, ready: true, loading: false, error: null as string | null,
  retry: vi.fn(), submitStatus: 'idle' as const, statusMessage: undefined,
  toggleCycle: vi.fn(), submit: vi.fn(),
}));
vi.mock('./hooks/useProgramCyclesModal', () => ({ default: () => workflow }));
const props = {
  program: { id: 'program-1', name: 'Skills' } as Program,
  cycles: [{ id: 'cycle-1', name: 'Fall', startsOn: '2026-09-01', endsOn: '2026-12-01', state: 'upcoming' as const }],
  cyclesLoading: false, cyclesError: null, onRetryCycles: vi.fn(), onClose: vi.fn(),
};

beforeEach(() => Object.assign(workflow, { selectedCycleIds: ['cycle-1'], ready: true, loading: false, error: null }));

it('shows failed assignment loading without presenting unchecked cycles as saved data', () => {
  Object.assign(workflow, { selectedCycleIds: null, ready: false, error: 'Assignments unavailable' });
  render(<ProgramCyclesModal {...props} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Assignments unavailable');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save Assigned Cycles' })).toBeDisabled();
});
