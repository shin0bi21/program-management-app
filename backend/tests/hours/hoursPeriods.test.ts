import { getBiweeklyPayPeriod } from '../../src/services/staff/hours/payPeriodUtils';

describe('Hours pay periods', () => {
  it.each([
    ['2026-02-01', '2026-02-01', '2026-02-01', '2026-02-14'],
    ['2026-02-01', '2026-02-14', '2026-02-01', '2026-02-14'],
    ['2026-02-01', '2026-02-15', '2026-02-15', '2026-02-28'],
    ['2026-02-01', '2026-08-11', '2026-08-02', '2026-08-15'],
  ])(
    'anchors %s through %s to %s–%s',
    (cycleStartsOn, currentDate, periodStart, periodEnd) => {
      expect(getBiweeklyPayPeriod(cycleStartsOn, currentDate)).toEqual({ periodStart, periodEnd });
    },
  );
});
