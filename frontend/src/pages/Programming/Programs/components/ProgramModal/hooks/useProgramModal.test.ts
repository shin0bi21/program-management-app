import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createProgram,
  updateProgram,
} from '../../../api/programs.api';
import type { Program } from '../../../../../../common/features/programs/types';
import useProgramModal from './useProgramModal';

vi.mock('../../../api/programs.api', () => ({
  createProgram: vi.fn(),
  updateProgram: vi.fn(),
}));

const program: Program = {
  id: 'program-1',
  name: 'Soft Skills',
  description: 'Life skills',
  enrollmentRequired: true,
  minAge: 12,
  maxAge: 15,
  defaultDayOfWeek: 'tuesday',
  defaultStartTime: '17:00',
  defaultEndTime: '19:30',
  timezone: 'America/Toronto',
};

describe('useProgramModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createProgram).mockResolvedValue({ program: { ...program, id: 'program-2' }, updatedCohorts: [], removedCohortIds: [], createdCohortIds: [] });
    vi.mocked(updateProgram).mockResolvedValue({ program, updatedCohorts: [], removedCohortIds: [], createdCohortIds: [] });
  });

  it('creates a normalized program and returns the saved record', async () => {
    const saved = { ...program, id: 'program-2', name: 'Job Readiness' };
    vi.mocked(createProgram).mockResolvedValue({ program: saved, updatedCohorts: [], removedCohortIds: [], createdCohortIds: [] });
    const onSaved = vi.fn();
    const { result } = renderHook(() => useProgramModal({
      isOpen: true,
      program: null,
      onSaved,
    }));
    act(() => {
      result.current.updateDraft('name', '  Job Readiness  ');
      result.current.updateDraft('description', '   ');
      result.current.updateDraft('minAge', '16');
      result.current.updateDraft('maxAge', '19');
    });

    await act(async () => result.current.submit());

    expect(createProgram).toHaveBeenCalledWith({
      name: 'Job Readiness',
      description: null,
      enrollmentRequired: true,
      minAge: 16,
      maxAge: 19,
      defaultDayOfWeek: 'tuesday',
      defaultStartTime: '17:00',
      defaultEndTime: '19:30',
      timezone: 'America/Toronto',
    });
    expect(onSaved).toHaveBeenCalledWith({ program: saved, updatedCohorts: [], removedCohortIds: [], createdCohortIds: [] }, 'create');
    expect(result.current.submitStatus).toBe('success');
  });

  it('initializes and updates an existing program', async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useProgramModal({
      isOpen: true,
      program,
      onSaved,
    }));
    expect(result.current.draft).toEqual({
      name: 'Soft Skills',
      description: 'Life skills',
      enrollmentRequired: true,
      minAge: '12',
      maxAge: '15',
      defaultDayOfWeek: 'tuesday',
      defaultStartTime: '17:00',
      defaultEndTime: '19:30',
      timezone: 'America/Toronto',
    });
    act(() => result.current.updateDraft('enrollmentRequired', false));

    await act(async () => result.current.submit());

    expect(updateProgram).toHaveBeenCalledWith(program.id, {
      name: 'Soft Skills',
      description: 'Life skills',
      enrollmentRequired: false,
      minAge: 12,
      maxAge: 15,
      defaultDayOfWeek: 'tuesday',
      defaultStartTime: '17:00',
      defaultEndTime: '19:30',
      timezone: 'America/Toronto',
    });
    expect(onSaved).toHaveBeenCalledWith({ program, updatedCohorts: [], removedCohortIds: [], createdCohortIds: [] }, 'update');
  });

  it.each([
    ['12', '', 'Minimum and maximum age must both be provided.'],
    ['12.5', '15', 'Ages must be whole numbers from 0 to 30.'],
    ['12', '31', 'Ages must be whole numbers from 0 to 30.'],
    ['16', '15', 'Minimum age cannot be greater than maximum age.'],
  ])('rejects invalid age values %s and %s', async (minAge, maxAge, message) => {
    const { result } = renderHook(() => useProgramModal({
      isOpen: true,
      program: null,
      onSaved: vi.fn(),
    }));
    act(() => {
      result.current.updateDraft('name', 'Job Readiness');
      result.current.updateDraft('minAge', minAge);
      result.current.updateDraft('maxAge', maxAge);
    });

    await act(async () => result.current.submit());

    expect(createProgram).not.toHaveBeenCalled();
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe(message);
  });

  it('saves program-specific session defaults', async () => {
    const { result } = renderHook(() => useProgramModal({ isOpen: true, program, onSaved: vi.fn() }));
    act(() => {
      result.current.updateDraft('defaultDayOfWeek', 'friday');
      result.current.updateDraft('defaultStartTime', '17:30');
      result.current.updateDraft('defaultEndTime', '19:30');
      result.current.updateDraft('timezone', 'America/Toronto');
    });

    await act(async () => result.current.submit());

    expect(updateProgram).toHaveBeenCalledWith(program.id, expect.objectContaining({
      defaultDayOfWeek: 'friday', defaultStartTime: '17:30', defaultEndTime: '19:30', timezone: 'America/Toronto',
    }));
  });

  it.each([
    ['defaultEndTime', '16:00', 'Default end time must be after the start time.'],
  ] as const)('rejects invalid session default %s', async (field, value, message) => {
    const { result } = renderHook(() => useProgramModal({ isOpen: true, program, onSaved: vi.fn() }));
    act(() => result.current.updateDraft(field, value));

    await act(async () => result.current.submit());

    expect(updateProgram).not.toHaveBeenCalled();
    expect(result.current.statusMessage).toBe(message);
  });

  it('preserves the draft for the same record and resets it for a different target', () => {
    const options = { isOpen: true, program, onSaved: vi.fn() };
    const { result, rerender } = renderHook(
      (props: typeof options) => useProgramModal(props),
      { initialProps: options },
    );
    act(() => result.current.updateDraft('name', 'Keep this draft'));

    rerender({ ...options, program: { ...program } });
    expect(result.current.draft.name).toBe('Keep this draft');

    rerender({
      ...options,
      program: { ...program, id: 'program-2', name: 'Job Readiness' },
    });
    expect(result.current.draft.name).toBe('Job Readiness');
  });

  it('reports a save failure and allows retry', async () => {
    vi.mocked(createProgram).mockRejectedValueOnce(new Error('Program name already exists'));
    const onSaved = vi.fn();
    const { result } = renderHook(() => useProgramModal({
      isOpen: true,
      program: null,
      onSaved,
    }));
    act(() => result.current.updateDraft('name', 'Soft Skills'));

    await act(async () => result.current.submit());
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Program name already exists');
    expect(onSaved).not.toHaveBeenCalled();

    await act(async () => result.current.submit());
    expect(createProgram).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
  });
});
