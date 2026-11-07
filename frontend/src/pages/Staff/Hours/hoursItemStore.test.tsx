import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HoursItem, HoursSortKey } from './types';
import { createQueryClientWrapper, createTestQueryClient } from '../../../tests/queryClientTestUtils';
import { makeHoursItem } from '../../../tests/factories/hours';
import { getInfiniteListViewState, registerInfiniteListQuery } from '../../../query/infiniteListCache';
import {
  beginHoursRead,
  finishHoursRead,
  getHoursItem,
  getHoursSortValue,
  getHoursScope,
  isHoursScope,
  removeHoursItem,
  setHoursItemPending,
  useHoursItems,
  writeHoursItem,
  type HoursListIndex,
} from './hoursItemStore';

const tableKey = ['hours', 'table'];
const signal = new AbortController().signal;

it('keeps one record for multiple consumers while list caches retain only membership and sort values', async () => {
  const client = createTestQueryClient();
  const wrapper = createQueryClientWrapper(client);
  const first = renderHook(useHoursItems, { wrapper });
  const second = renderHook(useHoursItems, { wrapper });
  const entry = makeHoursItem();
  const untouched = makeHoursItem({ id: 'untouched', date: '2026-08-20' });
  act(() => finishHoursRead(client, beginHoursRead(client), [entry, untouched], signal));
  await waitFor(() => expect(first.result.current[entry.id]).toEqual(entry));
  const originalUntouched = first.result.current[untouched.id];
  const key = [...tableKey, {}, { key: 'date', direction: 'asc' }];
  client.setQueryData(key, {
    pages: [{ rows: [{ id: entry.id, sortValue: entry.date }, { id: untouched.id, sortValue: untouched.date }], nextCursor: null }],
    pageParams: [null],
  });
  registerInfiniteListQuery<HoursListIndex>(client, key, {
    ordering: { direction: 'asc', getValue: index => index.sortValue },
  });

  act(() => writeHoursItem(client, { ...entry, date: '2026-08-21' }, tableKey));

  await waitFor(() => expect(first.result.current[entry.id].date).toBe('2026-08-21'));
  expect(second.result.current[entry.id]).toBe(first.result.current[entry.id]);
  expect(first.result.current[untouched.id]).toBe(originalUntouched);
  expect(client.getQueryData(key)).toEqual({
    pages: [{ rows: [{ id: entry.id, sortValue: '2026-08-21' }, { id: untouched.id, sortValue: untouched.date }], nextCursor: null }],
    pageParams: [null],
  });
  expect(getInfiniteListViewState(client, key)).toBe('retained');
});

describe('overlapping reads and changes', () => {
  it('keeps newer reads when a previous table or calendar request finishes later', () => {
    const client = createTestQueryClient();
    const entry = makeHoursItem();
    const older = beginHoursRead(client);
    const newer = beginHoursRead(client);
    finishHoursRead(client, newer, [{ ...entry, hours: 4 }], signal);

    const rows = finishHoursRead(client, older, [entry], signal);

    expect(rows[0]).toBe(getHoursItem(client, entry.id));
    expect(rows[0].hours).toBe(4);
  });

  it('keeps a saved edit and confirmed deletion when an earlier response arrives', () => {
    const client = createTestQueryClient();
    const entry = makeHoursItem();
    const deleted = makeHoursItem({ id: 'deleted' });
    const pending = beginHoursRead(client);
    writeHoursItem(client, { ...entry, hours: 5 }, tableKey);
    removeHoursItem(client, deleted.id, tableKey);

    const rows = finishHoursRead(client, pending, [entry, deleted], signal);

    expect(rows).toEqual([{ ...entry, hours: 5 }]);
    expect(getHoursItem(client, deleted.id)).toBeUndefined();
  });

  it('keeps an optimistic move through reads during the mutation and after rollback', () => {
    const client = createTestQueryClient();
    const entry = makeHoursItem();
    writeHoursItem(client, entry, tableKey);
    const scope = getHoursScope(client);
    setHoursItemPending(client, entry.id, true, scope);
    writeHoursItem(client, { ...entry, date: '2026-08-20' }, tableKey);
    const duringMove = beginHoursRead(client);

    expect(finishHoursRead(client, duringMove, [entry], signal)[0].date).toBe('2026-08-20');
    const beforeRollback = beginHoursRead(client);
    writeHoursItem(client, entry, tableKey);
    setHoursItemPending(client, entry.id, false, scope);
    finishHoursRead(client, beforeRollback, [{ ...entry, date: '2026-08-20' }], signal);

    expect(getHoursItem(client, entry.id)).toEqual(entry);
    const fresh = { ...entry, hours: 6 };
    finishHoursRead(client, beginHoursRead(client), [fresh], signal);
    expect(getHoursItem(client, entry.id)).toEqual(fresh);
  });

  it('rejects cancelled responses and ignores reads and change completion after clearing the cache', () => {
    const client = createTestQueryClient();
    const entry = makeHoursItem();
    const cancelled = beginHoursRead(client);
    const controller = new AbortController();
    controller.abort();
    expect(() => finishHoursRead(client, cancelled, [entry], controller.signal)).toThrow();
    expect(getHoursItem(client, entry.id)).toBeUndefined();

    const oldRead = beginHoursRead(client);
    const oldScope = getHoursScope(client);
    client.clear();
    expect(isHoursScope(client, oldScope)).toBe(false);
    const newRead = beginHoursRead(client);
    finishHoursRead(client, newRead, [{ ...entry, hours: 7 }], signal);
    setHoursItemPending(client, entry.id, false, oldScope);
    expect(finishHoursRead(client, oldRead, [entry], signal)).toEqual([]);
    expect(getHoursItem(client, entry.id)?.hours).toBe(7);
  });
});

const row = makeHoursItem({ date: '2026-10-01', firstName: 'Avery', lastName: 'Youth', name: 'Avery Youth' });

const sortValues: Array<[HoursSortKey, Partial<HoursItem>, string | number]> = [
  ['firstName', { firstName: 'Other' }, 'other'],
  ['lastName', { lastName: 'Other' }, 'other'],
  ['date', { date: '2026-10-02' }, '2026-10-02'],
  ['program', { program: 'Other' }, 'other'],
  ['cycle', { cycle: 'Other' }, 'other'],
  ['category', { category: 'other' }, 'other'],
  ['hours', { hours: 10.5 }, 10.5],
  ['note', { note: 'Other' }, 'other'],
  ['type', { type: 'task' }, 'task'],
];

it.each(sortValues)('maps %s to its canonical sort value', (key, changes, expected) => {
  expect(getHoursSortValue({ ...row, ...changes }, key)).toEqual(expected);
});

it('sorts general time using the server’s empty program value', () => {
  expect(getHoursSortValue(makeHoursItem({ program: null }), 'program')).toBe('');
});
