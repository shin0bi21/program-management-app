import { useMemo, type ReactNode } from 'react';
import Button from '../../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import type { ProgramSession, SessionRosterMember } from '../../../types';
import useSessionRoster from '../../../hooks/data/useSessionRoster';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../../common/components/PageMessageOverlay/usePageMessageReporter';

/**
 * Loads the selected session's attendance summary and provides its optional Manage action.
 * @example <SessionAttendanceDashboardCard session={session} canWrite onManage={openAttendance} />
 */
export default function SessionAttendanceDashboardCard({
  session, canWrite, onManage, onMessageChange,
}: {
  session: ProgramSession | null;
  canWrite: boolean;
  onManage: (session: ProgramSession) => void;
  onMessageChange?: PageMessageChangeHandler;
}) {
  const query = useSessionRoster(session?.id);
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: query.refetch }), [query.refetch]);
  usePageMessageReporter(onMessageChange, query.error ? 'Could not load session attendance.' : null, retryAction);
  const summary = session && query.data ? getAttendanceSummary(query.data, session.enrollmentRequired) : null;
  let content: ReactNode;
  if (session) {
    if (query.error) {
      content = <UnavailableState compact title="Session attendance unavailable" onRetry={query.refetch} />;
    } else if (query.data) {
      content = <p className={summary ? undefined : 'dashboard-card__empty'}>{summary ?? 'No attendance.'}</p>;
    }
  }

  return <DashboardCard
    title="Attendance"
    loading={session !== null && query.isLoading}
    loadingLabel="Loading attendance…"
    emptyMessage="No session selected."
    action={canWrite ? <Button
      size="sm"
      variant="secondary"
      disabled={!session}
      aria-label="Manage attendance"
      onClick={() => { if (session) onManage(session); }}
    >Manage</Button> : undefined}
  >
    {content}
  </DashboardCard>;
}

/**
 * Shows attended/marked counts for enrolled sessions and check-ins for open sessions.
 * Returns null when no roster member has a recorded status.
 * @example An enrolled session with 4 attendees and 5 marked records returns '4/5'.
 */
function getAttendanceSummary(roster: readonly SessionRosterMember[], enrollmentRequired: boolean) {
  const marked = roster.filter(member => member.status !== null);
  if (!marked.length) return null;
  if (!enrollmentRequired) return `${marked.length} check-ins`;
  const attended = marked.filter(member => member.status === 'present' || member.status === 'late');
  return `${attended.length}/${marked.length}`;
}
