// Responsive calendar behavior is covered through the ProgrammingCalendar consumer suite.
import { describe, expect, it } from 'vitest';
import { useProgrammingCalendar } from './useProgrammingCalendar';

describe('useProgrammingCalendar', () => {
  it('exports the responsive calendar lifecycle owner', () => {
    expect(useProgrammingCalendar).toBeTypeOf('function');
  });
});
