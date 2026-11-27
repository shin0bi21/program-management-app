import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { AttendanceStatus } from '../../../../../common/features/AttendanceStatusSelect/types';
import type { SubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../common/hooks/useSubmitLock';
import { getErrorMessage } from '../../../../../http/errors';
import { setAttendance, type YouthAttendanceResult } from '../youthAttendance.api';
import type { AttendanceGroup } from '../../../../../common/features/Attendance/attendance.api';

/**
 * Edits one mounted attendance draft supplied by the dashboard.
 * @param options - Supplied attendance, youth identity and saved-result callback.
 * @example useYouthAttendance({ youthId, attendance, onSaved }) // starts with saved statuses
 */
export default function useYouthAttendance({
  youthId,
  attendance,
  onSaved,
}: {
  youthId: string;
  attendance: AttendanceGroup;
  onSaved: (result: YouthAttendanceResult) => void | Promise<void>;
}) {
  const sessions = attendance.youth.find(person => person.id === youthId)?.sessions ?? [];
  const { tryLock, unlock } = useSubmitLock();
  const { watch, getValues, setValue, handleSubmit } = useForm<{ selections: Record<string, AttendanceStatus | ''> }>({
    defaultValues: {
      selections: Object.fromEntries(sessions.map(session => [session.id, session.status ?? ''])),
    },
  });
  const { selections } = watch();
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';

  /**
   * Changes the supplied session's draft attendance while editing is available.
   * @example updateStatus(sessionId, "late")
   */
  const updateStatus = (sessionId: string, status: AttendanceStatus | '') => {
    if (submissionComplete) return;
    setValue('selections', { ...getValues('selections'), [sessionId]: status });
  };

  /**
   * Saves the complete draft once, preserving failures for retry and successful feedback until close.
   * @example await save()
   */
  const save = handleSubmit(async ({ selections }) => {
    if (sessions.length === 0 || !tryLock()) return;

    const { programId, cycleId } = attendance.programCycle;
    setSubmitStatus('submitting');
    setStatusMessage('Saving youth attendance...');
    let saved: YouthAttendanceResult;
    try {
      saved = await setAttendance(
        youthId,
        { programId, cycleId },
        sessions.map(session => ({
          sessionId: session.id,
          status: selections[session.id] || null,
          notes: session.notes,
        })),
      );
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not save youth attendance'));
      setSubmitStatus('error');
      unlock();
      return;
    }

    let message = 'Youth attendance saved.';
    try {
      await onSaved(saved);
    } catch {
      message = 'Attendance was saved, but the page could not refresh. Reload to see it.';
    }
    setStatusMessage(message);
    setSubmitStatus('success');
  });

  return { selections, updateStatus, save, submitStatus, statusMessage, submissionComplete };
}
