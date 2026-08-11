import { describe, expect, it } from 'vitest';
import { normalizePeriodWindowOptions } from './usePeriodWindow';

describe('normalizePeriodWindowOptions', () => {
  it('keeps normal window settings unchanged', () => {
    expect(normalizePeriodWindowOptions(15, 7)).toEqual({ windowSize: 15, buildSize: 7 });
  });

  it('keeps a retained period when the requested build is too large', () => {
    expect(normalizePeriodWindowOptions(5, 20)).toEqual({ windowSize: 5, buildSize: 4 });
  });

  it('normalizes invalid counts to a usable window', () => {
    expect(normalizePeriodWindowOptions(0, 0)).toEqual({ windowSize: 2, buildSize: 1 });
  });
});
