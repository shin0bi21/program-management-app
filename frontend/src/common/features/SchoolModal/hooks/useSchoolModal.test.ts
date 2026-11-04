import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSchool, deleteSchool, setSchool } from '../schoolModal.api';
import useSchoolModal from './useSchoolModal';

const schools = vi.hoisted(() => ({ upsertSchool: vi.fn(), removeSchool: vi.fn() }));
vi.mock('./useSchools', () => ({ useSchools: () => schools }));
vi.mock('../schoolModal.api', () => ({
  createSchool: vi.fn(),
  deleteSchool: vi.fn(),
  setSchool: vi.fn(),
}));

const school = { id: 'school-1', name: 'Central High' };

describe('useSchoolModal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createSchool).mockResolvedValue(school);
    vi.mocked(setSchool).mockResolvedValue(school);
    vi.mocked(deleteSchool).mockResolvedValue();
  });

  it('creates a school, reconciles the returned record, selects it, and closes', async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useSchoolModal());
    act(() => result.current.open({ type: 'add' }, { schoolId: '', onChange }));
    act(() => result.current.setName('  Entered name  '));

    await act(async () => result.current.submit());

    expect(createSchool).toHaveBeenCalledWith('Entered name');
    expect(schools.upsertSchool).toHaveBeenCalledWith(school);
    expect(onChange).toHaveBeenCalledWith(school.id);
    expect(result.current.action).toBeNull();
    expect(result.current.submitting).toBe(false);
  });

  it('initializes editing and updates the school without changing the selection', async () => {
    const onChange = vi.fn();
    const saved = { ...school, name: 'Central Academy' };
    vi.mocked(setSchool).mockResolvedValue(saved);
    const { result } = renderHook(() => useSchoolModal());
    act(() => result.current.open({ type: 'edit', school }, { schoolId: 'other', onChange }));
    expect(result.current.name).toBe(school.name);
    act(() => result.current.setName('Central Academy'));

    await act(async () => result.current.submit());

    expect(setSchool).toHaveBeenCalledWith({ id: school.id, name: 'Central Academy' });
    expect(schools.upsertSchool).toHaveBeenCalledWith(saved);
    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.action).toBeNull();
  });

  it.each([school.id, 'other'])('clears a deleted school only when selected (%s)', async schoolId => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useSchoolModal());
    act(() => result.current.open({ type: 'delete', school }, { schoolId, onChange }));

    await act(async () => result.current.submit());

    expect(deleteSchool).toHaveBeenCalledWith(school.id);
    expect(schools.removeSchool).toHaveBeenCalledWith(school.id);
    expect(onChange.mock.calls).toEqual(schoolId === school.id ? [['']] : []);
    expect(result.current.action).toBeNull();
  });

  it('rejects a blank name without submitting', async () => {
    const { result } = renderHook(() => useSchoolModal());
    act(() => result.current.open({ type: 'add' }, { schoolId: '', onChange: vi.fn() }));
    act(() => result.current.setName('  '));

    await act(async () => result.current.submit());

    expect(createSchool).not.toHaveBeenCalled();
    expect(result.current.submitting).toBe(false);
  });

  it('preserves the draft after failure and allows retry', async () => {
    vi.mocked(createSchool).mockRejectedValueOnce(new Error('network failed'));
    const onChange = vi.fn();
    const { result } = renderHook(() => useSchoolModal());
    act(() => result.current.open({ type: 'add' }, { schoolId: '', onChange }));
    act(() => result.current.setName('Central High'));

    await act(async () => result.current.submit());

    expect(result.current.error).toBe('network failed');
    expect(result.current.name).toBe('Central High');
    expect(result.current.action).toEqual({ type: 'add' });
    expect(schools.upsertSchool).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => result.current.submit());

    expect(onChange).toHaveBeenCalledWith(school.id);
    expect(result.current.action).toBeNull();
    expect(result.current.error).toBe('');
  });

  it('discards the cancelled draft and callback before another form opens it', async () => {
    const previousChange = vi.fn();
    const nextChange = vi.fn();
    const { result } = renderHook(() => useSchoolModal());
    act(() => result.current.open({ type: 'edit', school }, { schoolId: school.id, onChange: previousChange }));
    act(() => result.current.setName('Unsaved name'));

    act(() => result.current.close());
    expect(result.current.action).toBeNull();
    expect(setSchool).not.toHaveBeenCalled();

    act(() => result.current.open({ type: 'add' }, { schoolId: '', onChange: nextChange }));
    expect(result.current.name).toBe('');
    act(() => result.current.setName('New school'));
    await act(async () => result.current.submit());

    expect(previousChange).not.toHaveBeenCalled();
    expect(nextChange).toHaveBeenCalledWith(school.id);
  });

  it('blocks duplicate submission, dismissal, and target changes while pending', async () => {
    let resolveCreate!: (value: typeof school) => void;
    vi.mocked(createSchool).mockReturnValue(new Promise(resolve => { resolveCreate = resolve; }));
    const onChange = vi.fn();
    const { result } = renderHook(() => useSchoolModal());
    act(() => result.current.open({ type: 'add' }, { schoolId: '', onChange }));
    act(() => result.current.setName('Central High'));

    let first!: Promise<void>;
    act(() => {
      first = result.current.submit();
      void result.current.submit();
    });
    act(() => {
      result.current.close();
      result.current.open({ type: 'delete', school }, { schoolId: school.id, onChange });
    });

    expect(createSchool).toHaveBeenCalledTimes(1);
    expect(result.current.action).toEqual({ type: 'add' });
    expect(result.current.submitting).toBe(true);

    await act(async () => {
      resolveCreate(school);
      await first;
    });

    expect(result.current.action).toBeNull();
    expect(onChange).toHaveBeenCalledOnce();
  });
});
