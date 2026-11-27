import { useEffect, useState, type ReactElement } from 'react';

import Button from '../../../../../../common/components/Button/Button';
import Modal from '../../../../../../common/components/Modal/Modal';
import './HoursBreakdown.css';

interface HoursBreakdownData {
  total: number;
  title: string;
  subtitle: string;
  breakdown: Array<{ label: string; hours: number }>;
}

type HoursBreakdownProps = {
  data: HoursBreakdownData | null;
  scopeKey: string;
  disabled?: boolean;
};

/**
 * Opens a staff summary's category breakdown and closes it when its selection or availability changes.
 * @param props.data - The current summary's decimal hours and breakdown; null disables the action.
 * @param props.scopeKey - Staff and period/cycle identity, used to discard a departing breakdown.
 * @param props.disabled - Prevents opening or retaining a breakdown while its summary is unavailable.
 * @example <HoursBreakdown data={summary} scopeKey="staff-1:cycle-1" disabled={false} />
 */
export default function HoursBreakdown({ data, scopeKey, disabled = false }: HoursBreakdownProps): ReactElement {
  const [openScope, setOpenScope] = useState<string | null>(null);
  const hasData = data !== null;

  useEffect(() => setOpenScope(null), [scopeKey, disabled, hasData]);

  return <>
    <Button
      size="sm"
      variant="secondary"
      aria-haspopup="dialog"
      disabled={!hasData || disabled}
      onClick={() => setOpenScope(scopeKey)}
    >
      See Breakdown
    </Button>
    <Modal
      isOpen={openScope === scopeKey && hasData && !disabled}
      onClose={() => setOpenScope(null)}
      title={data?.title ?? ''}
      maxWidth="440px"
    >
      {data && <>
        <p className="hours-breakdown__modal-subtitle">{data.subtitle}</p>
        {data.breakdown.length ? <>
          <div className="hours-breakdown__segments" role="img" aria-label={`Breakdown of ${data.total.toFixed(2)} hours`}>
            {data.breakdown.map(({ label, hours }, index) => <span
              key={label}
              className={`hours-breakdown__tone-${index % 5}`}
              style={{ width: `${data.total > 0 ? (hours / data.total) * 100 : 0}%` }}
              aria-hidden="true"
            />)}
          </div>
          <dl className="hours-breakdown__breakdown">
            {data.breakdown.map(({ label, hours }, index) => <div
              key={label}
              className={`hours-breakdown__breakdown-row hours-breakdown__tone-${index % 5}`}
            >
              <dt>{label}</dt>
              <dd>{hours.toFixed(2)}</dd>
            </div>)}
          </dl>
        </> : <p className="hours-breakdown__no-breakdown">No hours recorded.</p>}
        <div className="hours-breakdown__total"><span className="hours-breakdown__total-label">Total</span><span>{data.total.toFixed(2)}</span></div>
      </>}
    </Modal>
  </>;
}
