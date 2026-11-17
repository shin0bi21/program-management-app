import { useMemo, type ReactNode } from 'react';
import Button from '../../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import type { ProgramSession, SessionRosterMember } from '../../../types';
import useSessionRoster from '../../../hooks/data/useSessionRoster';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../../common/components/PageMessageOverlay/usePageMessageReporter';

/**
 * Loads attendance for the selected session and supplies that roster to its Manage action.
 * @param props - Selected session, write access, loaded-roster callback, and page message reporter.
 * @example <SessionAttendanceDashboardCard session={session} canWrite onManage={openAttendance} />
 */
export default function SessionAttendanceDashboardCard({
  session, canWrite, onManage, onMessageChange,
}: {
  session: ProgramSession | null;
  canWrite: boolean;
  onManage: (session: ProgramSession, roster: SessionRosterMember[]) => void;
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
      disabled={!session || !query.data || query.isLoading || Boolean(query.error)}
      aria-label="Manage attendance"
      onClick={() => { if (session && query.data) onManage(session, query.data); }}
    >Manage</Button> : undefined}
  >
    {content}
  </DashboardCard>;
}

/**
 * Shows attended/roster counts for enrolled sessions and recorded check-ins for open sessions.
 * Returns null for an empty roster or an open session without recorded check-ins.
 * @param roster - Loaded session attendees and their recorded statuses.
 * @param enrollmentRequired - Whether to count the full roster, including unmarked members.
 * @example An enrolled session with 4 attendees and 6 roster members returns '4/6'.
 */
function getAttendanceSummary(roster: readonly SessionRosterMember[], enrollmentRequired: boolean) {
  if (!roster.length) return null;
  if (!enrollmentRequired) {
    const marked = roster.filter(member => member.status !== null);
    return marked.length ? `${marked.length} check-ins` : null;
  }

  const attended = roster.filter(member => member.status === 'present' || member.status === 'late');
  return `${attended.length}/${roster.length}`;
}
