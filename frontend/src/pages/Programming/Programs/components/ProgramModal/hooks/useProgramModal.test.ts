import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createProgram,
  updateProgram,
} from '../../../api/programs.api';
import type { Program } from '../../../types';
import useProgramModal from './useProgramModal';

vi.mock('../../../api/programs.api', () => ({
  createProgram: vi.fn(),
  updateProgram: vi.fn(),
}));

const program: Program = {
  id: 'program-1',
  title: 'Soft Skills',
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
    vi.mocked(createProgram).mockResolvedValue({ program: { ...program, id: 'program-2' }, updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] });
    vi.mocked(updateProgram).mockResolvedValue({ program, updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] });
  });

  it('creates a normalized program and returns the saved record', async () => {
    const saved = { ...program, id: 'program-2', title: 'Job Readiness' };
    vi.mocked(createProgram).mockResolvedValue({ program: saved, updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] });
    const onSaved = vi.fn();
    const { result } = renderHook(() => useProgramModal({
      program: null,
      onSaved,
    }));
    act(() => {
      result.current.setValue('title', '  Job Readiness  ');
      result.current.setValue('defaultDayOfWeek', 'tuesday');
      result.current.setValue('defaultStartTime', '17:00');
      result.current.setValue('defaultEndTime', '19:30');
      result.current.setValue('enrollmentRequired', true);
      result.current.setValue('description', '   ');
      result.current.setValue('minAge', '16');
      result.current.setValue('maxAge', '19');
    });

    await act(async () => result.current.submit());

    expect(createProgram).toHaveBeenCalledWith({
      title: 'Job Readiness',
      description: null,
      enrollmentRequired: true,
      minAge: 16,
      maxAge: 19,
      defaultDayOfWeek: 'tuesday',
      defaultStartTime: '17:00',
      defaultEndTime: '19:30',
      timezone: 'America/Toronto',
    });
    expect(onSaved).toHaveBeenCalledWith({ program: saved, updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] }, 'create');
    expect(result.current.submitStatus).toBe('success');
  });

  it('initializes and updates an existing program', async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useProgramModal({
      program,
      onSaved,
    }));
    expect(result.current.draft).toEqual({
      title: 'Soft Skills',
      description: 'Life skills',
      enrollmentRequired: true,
      minAge: '12',
      maxAge: '15',
      defaultDayOfWeek: 'tuesday',
      defaultStartTime: '17:00',
      defaultEndTime: '19:30',
      timezone: 'America/Toronto',
    });
    act(() => result.current.setValue('enrollmentRequired', false));

    await act(async () => result.current.submit());

    expect(updateProgram).toHaveBeenCalledWith(program.id, {
      title: 'Soft Skills',
      description: 'Life skills',
      enrollmentRequired: false,
      minAge: 12,
      maxAge: 15,
      defaultDayOfWeek: 'tuesday',
      defaultStartTime: '17:00',
      defaultEndTime: '19:30',
      timezone: 'America/Toronto',
    });
    expect(onSaved).toHaveBeenCalledWith({ program, updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] }, 'update');
  });

  it.each([
    ['12', '', 'Minimum and maximum age must both be provided.'],
    ['12.5', '15', 'Ages must be whole numbers from 0 to 30.'],
    ['12', '31', 'Ages must be whole numbers from 0 to 30.'],
    ['16', '15', 'Minimum age cannot be greater than maximum age.'],
  ])('rejects invalid age values %s and %s', async (minAge, maxAge, message) => {
    const { result } = renderHook(() => useProgramModal({
      program: null,
      onSaved: vi.fn(),
    }));
    act(() => {
      result.current.setValue('title', 'Job Readiness');
      result.current.setValue('minAge', minAge);
      result.current.setValue('maxAge', maxAge);
    });

    await act(async () => result.current.submit());

    expect(createProgram).not.toHaveBeenCalled();
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe(message);
  });

  it('saves program-specific session defaults', async () => {
    const { result } = renderHook(() => useProgramModal({ program, onSaved: vi.fn() }));
    act(() => {
      result.current.setValue('defaultDayOfWeek', 'friday');
      result.current.setValue('defaultStartTime', '17:30');
      result.current.setValue('defaultEndTime', '19:30');
      result.current.setValue('timezone', 'America/Toronto');
    });

    await act(async () => result.current.submit());

    expect(updateProgram).toHaveBeenCalledWith(program.id, expect.objectContaining({
      defaultDayOfWeek: 'friday', defaultStartTime: '17:30', defaultEndTime: '19:30', timezone: 'America/Toronto',
    }));
  });

  it.each([
    ['defaultEndTime', '16:00', 'Default end time must be after the start time.'],
  ] as const)('rejects invalid session default %s', async (field, value, message) => {
    const { result } = renderHook(() => useProgramModal({ program, onSaved: vi.fn() }));
    act(() => result.current.setValue(field, value));

    await act(async () => result.current.submit());

    expect(updateProgram).not.toHaveBeenCalled();
    expect(result.current.statusMessage).toBe(message);
  });

  it('reports a save failure and allows retry', async () => {
    vi.mocked(createProgram).mockRejectedValueOnce(new Error('Program title already exists'));
    const onSaved = vi.fn();
    const { result } = renderHook(() => useProgramModal({
      program: null,
      onSaved,
    }));
    act(() => {
      result.current.setValue('title', 'Soft Skills');
      result.current.setValue('defaultDayOfWeek', 'tuesday');
      result.current.setValue('defaultStartTime', '17:00');
      result.current.setValue('defaultEndTime', '19:30');
    });

    await act(async () => result.current.submit());
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Program title already exists');
    expect(onSaved).not.toHaveBeenCalled();

    await act(async () => result.current.submit());
    expect(createProgram).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
  });
});
