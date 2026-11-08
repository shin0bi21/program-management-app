import { useEffect, useState } from 'react';

import type { StaffResource } from '../../types';
import type { ProgramCycle } from '../../../../../common/features/programming/cycles/types';
import type { PageMessageItem } from '../../../../../common/components/PageMessageOverlay/PageMessageOverlay';
import type { PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import HoursPayPeriodDashboardCard from './HoursPayPeriodDashboardCard/HoursPayPeriodDashboardCard';
import HoursCycleSummaryDashboardCard from './HoursCycleSummaryDashboardCard/HoursCycleSummaryDashboardCard';

interface HoursDashboardProps {
  queryKey: readonly unknown[];
  staff: StaffResource | null;
  cycle: ProgramCycle | null;
  onMessageChange?: PageMessageChangeHandler;
}

/**
 * Displays independent pay-period and cycle summaries for the selected staff member.
 * @param props - Query namespace, selected staff/cycle context, and page error reporter.
 * @example <HoursDashboard queryKey={['hours']} staff={staff} cycle={cycle} />
 */
export default function HoursDashboard({ queryKey, staff, cycle, onMessageChange }: HoursDashboardProps) {
  const [payPeriodError, setPayPeriodError] = useState<PageMessageItem | null>(null);
  const [cycleError, setCycleError] = useState<PageMessageItem | null>(null);

  useEffect(() => {
    if (!onMessageChange) return undefined;

    const messages = [payPeriodError, cycleError].filter(message => message !== null);
    onMessageChange(messages.length ? messages : null);
    return () => onMessageChange(null);
  }, [payPeriodError, cycleError, onMessageChange]);

  return <>
    <HoursPayPeriodDashboardCard queryKey={queryKey} staff={staff} onErrorChange={setPayPeriodError} />
    <HoursCycleSummaryDashboardCard queryKey={queryKey} staff={staff} cycle={cycle} onErrorChange={setCycleError} />
  </>;
}
