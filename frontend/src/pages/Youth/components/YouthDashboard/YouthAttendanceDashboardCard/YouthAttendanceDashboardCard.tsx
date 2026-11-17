import { useEffect, useState, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faPen } from '@fortawesome/free-solid-svg-icons';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import ViewAttendanceModal from '../../../../../common/features/Attendance/ViewAttendanceModal';
import YouthAttendanceModal from '../../YouthAttendanceModal/YouthAttendanceModal';
import type { YouthAttendanceResult } from '../../YouthAttendanceModal/youthAttendance.api';
import type { YouthProfile } from '../../../types';
import useYouthAttendanceData from './hooks/useYouthAttendanceData';
import './YouthAttendanceDashboardCard.css';

interface YouthAttendanceDashboardCardProps {
  youthId: string | null;
  youth?: YouthProfile | null;
  canManage?: boolean;
  canViewReport?: boolean;
  onSaved?: (result: YouthAttendanceResult) => void | Promise<void>;
}

/**
 * Displays attendance grouped by program/cycle and opens the selected group's editor or report.
 * @param props - Selected youth, action permissions and saved-attendance callback.
 * @example <YouthAttendanceDashboardCard youthId={selectedProfileId} youth={selectedProfile} onSaved={reconcileAttendance} />
 */
export default function YouthAttendanceDashboardCard({ youthId, ...props }: YouthAttendanceDashboardCardProps) {
  return <AttendanceCard key={youthId} youthId={youthId} {...props} />;
}

/**
 * Owns the selected youth's attendance interactions; changing youth unmounts their targets.
 * @param props - Selected youth and available attendance actions.
 * @example <AttendanceCard youthId={youth.id} youth={youth} />
 */
function AttendanceCard({ youthId, youth, canManage, canViewReport, onSaved }: YouthAttendanceDashboardCardProps) {
  const { attendance, loading, error, retry } = useYouthAttendanceData(youthId);
  const [target, setTarget] = useState<{ type: 'edit' | 'report'; programId: string; cycleId: string } | null>(null);
  const selectedGroup = attendance?.groups.find(group => group.programCycle.programId === target?.programId
    && group.programCycle.cycleId === target?.cycleId);
  useEffect(() => {
    if (target && !selectedGroup) setTarget(null);
  }, [target, selectedGroup]);

  let content: ReactNode = null;
  if (error) {
    content = <div role="alert">
      <p>{error}</p>
      <Button size="sm" onClick={() => { void retry(); }}>Retry</Button>
    </div>;
  } else if (attendance?.groups.length) {
    content = attendance.groups.map(group => {
      const { programCycle } = group;
      const participant = group.youth.find(person => person.id === youthId);
      return <div className="attendance-card__cohort" key={`${programCycle.programId}:${programCycle.cycleId}`}>
        <div className="attendance-card__cohort-header">
          <span>{programCycle.program} · {programCycle.cycle}</span>
          <div className="attendance-card__actions">
            {canViewReport && <Button size="sm" variant="ghost" className="attendance-card__view"
              aria-label={`View attendance report for ${programCycle.program} · ${programCycle.cycle}`}
              disabled={!youth} onClick={() => setTarget({ type: 'report', programId: programCycle.programId, cycleId: programCycle.cycleId })}>
              <FontAwesomeIcon icon={faEye} />
            </Button>}
            {canManage && onSaved && <Button size="sm" variant="ghost" className="attendance-card__manage"
              aria-label={`Manage attendance for ${programCycle.program} · ${programCycle.cycle}`}
              disabled={!youth} onClick={() => setTarget({ type: 'edit', programId: programCycle.programId, cycleId: programCycle.cycleId })}>
              <FontAwesomeIcon icon={faPen} />
            </Button>}
          </div>
        </div>
        <p className="attendance-card__breakdown">Present {participant?.presentCount}<span aria-hidden="true"> · </span>
          Late {participant?.lateCount}<span aria-hidden="true"> · </span>Absent {participant?.absentCount}</p>
      </div>;
    });
  }

  /** Unmounts the selected editor or report. @example close() */
  const close = () => setTarget(null);

  return <>
    <DashboardCard title="Attendance" loading={loading} loadingLabel="Loading attendance…"
      emptyMessage={youthId ? 'No attendance available.' : 'Select a row to view attendance.'}>
      {content}
    </DashboardCard>
    {target?.type === 'edit' && selectedGroup && youth && onSaved && <YouthAttendanceModal
      youth={youth} attendance={selectedGroup} refresh={retry} onClose={close} onSaved={onSaved} />}
    {target?.type === 'report' && selectedGroup && <ViewAttendanceModal data={selectedGroup} onClose={close} />}
  </>;
}
