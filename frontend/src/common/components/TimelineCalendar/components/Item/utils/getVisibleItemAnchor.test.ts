import { expect, it, vi } from 'vitest';
import { getVisibleItemAnchor } from './getVisibleItemAnchor';

it('anchors a ranged item to the hovered period while retaining its vertical bounds', () => {
  const row = document.createElement('div');
  row.className = 'row';
  const cell = document.createElement('div');
  cell.className = 'cell';
  const item = document.createElement('button');
  row.append(cell, item);
  vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(new DOMRect(145, 0, 145, 92));
  vi.spyOn(item, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 10, 300, 26));

  const anchor = getVisibleItemAnchor(item, 180);
  expect(anchor).toEqual(new DOMRect(145, 10, 145, 26));
  expect(getVisibleItemAnchor(item, 0)).toEqual(new DOMRect(100, 10, 300, 26));
  expect(getVisibleItemAnchor(null)).toBeNull();
});
