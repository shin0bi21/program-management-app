import { describe, expect, it } from 'vitest';
import { formatCompactPersonName } from './name';

describe('formatCompactPersonName', () => {
  it('formats a first name and last initial', () => {
    expect(formatCompactPersonName('Zoe', 'Wilson')).toBe('Zoe W.');
  });

  it('does not add punctuation when the last name is empty', () => {
    expect(formatCompactPersonName('Zoe', '  ')).toBe('Zoe');
  });
});
