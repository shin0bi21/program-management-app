import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../tests/queryClientTestUtils';
import { createRecordStore, type RecordListIndex } from './createRecordStore';
import type { InfiniteData } from '@tanstack/react-query';
import type { CursorPage } from './types';
import { registerInfiniteListQuery, getInfiniteListViewState } from './infiniteListCache';

interface ExampleRecord { id: string; title: string }
const owner = createRecordStore<ExampleRecord>({
  queryKey: ['examples', 'records'], listKey: ['examples', 'table'], getSortValue: record => record.title,
});
const original = { id: 'one', title: 'Amy' };
const signal = new AbortController().signal;

/**
 * Creates an isolated record owner and seeds it through the same read boundary used by views.
 * @example setup().client // contains the original example record
 */
function setup() {
  const client = createTestQueryClient();
  owner.finishRead(client, owner.beginRead(client), [original], signal);
  return { client, scope: owner.getScope(client) };
}

describe('shared record ownership', () => {
  it('publishes one current record to multiple subscribers and preserves unaffected references', async () => {
    const { client } = setup();
    const unrelated = { id: 'two', title: 'Bob' };
    owner.write(client, unrelated);
    const { result } = renderHook(() => ({ table: owner.useRecords(), calendar: owner.useRecords() }), {
      wrapper: createQueryClientWrapper(client),
    });
    const saved = { ...original, title: 'Zoe' };
    act(() => owner.write(client, saved));

    await waitFor(() => expect(result.current.table.one.title).toBe('Zoe'));
    expect(result.current.table.one).toBe(result.current.calendar.one);
    expect(result.current.calendar.one).toBe(owner.get(client, 'one'));
    expect(result.current.table.two).toBe(unrelated);
  });

  it('lets a newer range read win over an older page response', () => {
    const { client } = setup();
    const page = owner.beginRead(client);
    const range = owner.beginRead(client);
    const latest = { ...original, title: 'Latest range' };
    owner.finishRead(client, range, [latest], signal);
    const resolved = owner.finishRead(client, page, [original], signal);
    expect(resolved[0]).toBe(owner.get(client, 'one'));
    expect(resolved[0]).toEqual(latest);
  });

  it('protects a saved record from reads started before or during its pending mutation', () => {
    const { client, scope } = setup();
    const beforeSave = owner.beginRead(client);
    owner.setPending(client, 'one', true, scope);
    const duringSave = owner.beginRead(client);
    owner.finishRead(client, duringSave, [{ ...original, title: 'Stale' }], signal);
    expect(owner.get(client, 'one')).toEqual(original);

    const saved = { ...original, title: 'Saved' };
    owner.write(client, saved);
    owner.setPending(client, 'one', false, scope);
    owner.finishRead(client, beforeSave, [original], signal);
    owner.finishRead(client, duringSave, [original], signal);
    expect(owner.get(client, 'one')).toEqual(saved);
  });

  it('releases failed mutations without allowing their outstanding reads to replace current data', () => {
    const { client, scope } = setup();
    owner.setPending(client, 'one', true, scope);
    const duringSave = owner.beginRead(client);
    owner.setPending(client, 'one', false, scope);
    owner.finishRead(client, duringSave, [{ ...original, title: 'Stale' }], signal);
    expect(owner.get(client, 'one')).toEqual(original);
    owner.finishRead(client, owner.beginRead(client), [{ ...original, title: 'Fresh' }], signal);
    expect(owner.get(client, 'one')?.title).toBe('Fresh');
  });

  it('keeps only IDs and sort values in loaded table variants, preserving cursors and order notices', () => {
    const { client } = setup();
    const key = ['examples', 'table', { key: 'title', direction: 'asc' }];
    registerInfiniteListQuery<RecordListIndex>(client, key, { ordering: { direction: 'asc', getValue: row => row.sortValue } });
    const other = { id: 'two', sortValue: 'Bob' };
    client.setQueryData(key, { pages: [{ rows: [{ id: 'one', sortValue: 'Amy' }, other], nextCursor: 'next' }], pageParams: [null] });

    owner.write(client, { ...original, title: 'Zoe' });

    const data = client.getQueryData<InfiniteData<CursorPage<RecordListIndex>>>(key)!;
    expect(data.pages[0].rows).toEqual([{ id: 'one', sortValue: 'Zoe' }, other]);
    expect(data.pages[0].rows[1]).toBe(other);
    expect(data.pages[0].nextCursor).toBe('next');
    expect(getInfiniteListViewState(client, key)).toBe('retained');
  });

  it('does not resurrect a deletion when a pending page or range returns the record', () => {
    const { client } = setup();
    const page = owner.beginRead(client);
    const range = owner.beginRead(client);
    owner.remove(client, 'one');
    expect(owner.finishRead(client, page, [original], signal)).toEqual([]);
    expect(owner.finishRead(client, range, [original], signal)).toEqual([]);
    expect(owner.get(client, 'one')).toBeUndefined();
  });

  it('rejects cancelled reads and ignores responses or pending cleanup from a cleared account', () => {
    const { client, scope } = setup();
    const read = owner.beginRead(client);
    const controller = new AbortController();
    controller.abort();
    expect(() => owner.finishRead(client, read, [original], controller.signal)).toThrow();
    client.clear();
    const nextScope = owner.getScope(client);
    expect(nextScope).not.toBe(scope);
    expect(owner.isScope(client, scope)).toBe(false);
    owner.setPending(client, 'one', false, scope);
    expect(owner.finishRead(client, read, [original], signal)).toEqual([]);
    expect(owner.get(client, 'one')).toBeUndefined();
  });
});
