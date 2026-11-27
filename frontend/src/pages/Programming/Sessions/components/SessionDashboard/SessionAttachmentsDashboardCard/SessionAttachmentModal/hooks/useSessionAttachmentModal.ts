import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { createSessionAttachment, getSessionRoster, updateSessionAttachment } from '../../../../../sessions.api';
import type { SubmitStatus } from '../../../../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../../../../common/hooks/useSubmitLock';
import type { Session } from '../../../../../../../../common/features/programming/sessions/types';
import type { SessionAttachment, SessionRosterMember } from '../../../../../types';

/**
 * Owns attachment upload or metadata-edit drafts and prevents duplicate pending saves.
 * Same-ID saved-record refreshes preserve the draft and submission lock.
 * @param options - Current saved session and attachment, roster query scope, and save refresh action.
 * @example useSessionAttachmentModal({ queryKey: ['sessions'], session, attachment, onSaved })
 */
export function useSessionAttachmentModal({ queryKey, session, attachment, onSaved }: {
  queryKey: readonly unknown[];
  session: Session;
  attachment: SessionAttachment | null;
  onSaved: () => void | Promise<void>;
}) {
  const { register, watch, getValues, setValue, handleSubmit } = useForm<{
    title: string;
    file?: FileList;
    description: string;
    selectedYouthIds: string[];
  }>({
    defaultValues: {
      title: attachment?.title ?? '',
      description: attachment?.description ?? '',
      selectedYouthIds: attachment?.youth.map(youth => youth.youthId) ?? [],
    },
  });
  const selectedYouthIds = watch('selectedYouthIds');
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();
  const rosterQuery = useQuery<SessionRosterMember[]>({
    queryKey: [...queryKey, session.id, 'roster'],
    queryFn: ({ signal }) => getSessionRoster(session.id, { signal }),
  });

  const toggleYouth = (youthId: string) => {
    const ids = getValues('selectedYouthIds');
    setValue('selectedYouthIds', ids.includes(youthId) ? ids.filter(id => id !== youthId) : [...ids, youthId]);
  };

  const submit = handleSubmit(async draft => {
    const file = draft.file?.[0];
    if ((!attachment && !file?.size) || !tryLock()) return;
    setSubmitStatus('submitting');
    setStatusMessage(attachment ? 'Saving attachment...' : 'Uploading attachment...');

    try {
      const description = draft.description.trim();
      const data = { title: draft.title.trim(), description: description || null, youthIds: draft.selectedYouthIds };
      if (attachment) await updateSessionAttachment(session.id, attachment.id, data);
      else if (file) await createSessionAttachment(session.id, { ...data, file });
    } catch (cause) {
      setStatusMessage(cause instanceof Error ? cause.message : `Could not ${attachment ? 'update' : 'add'} attachment`);
      setSubmitStatus('error');
      unlock();
      return;
    }

    let message = attachment ? 'Attachment successfully updated.' : 'Attachment successfully added.';
    try {
      await onSaved();
    } catch {
      message = 'Attachment was saved, but the page could not refresh. Reload to see it.';
    }
    setStatusMessage(message);
    setSubmitStatus('success');
  });

  return {
    roster: rosterQuery.data ?? [], rosterQuery, selectedYouthIds, register, setValue,
    submitStatus, statusMessage, submissionComplete: submitStatus === 'submitting' || submitStatus === 'success',
    toggleYouth, submit,
  };
}
