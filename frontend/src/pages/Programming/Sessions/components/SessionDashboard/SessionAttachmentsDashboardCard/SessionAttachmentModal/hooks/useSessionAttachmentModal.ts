import { type FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createSessionAttachment, getSessionRoster, updateSessionAttachment } from '../../../../../sessions.api';
import type { SubmitStatus } from '../../../../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../../../../common/hooks/useSubmitLock';
import type { ProgramSession, SessionAttachment, SessionRosterMember } from '../../../../../types';

/**
 * Owns attachment upload or metadata-edit drafts and prevents duplicate pending saves.
 * Same-ID saved-record refreshes preserve the draft and submission lock.
 * @param options - Current saved session and attachment, roster query scope, and save refresh action.
 * @example useSessionAttachmentModal({ queryKey: ['sessions'], session, attachment, onSaved })
 */
export function useSessionAttachmentModal({ queryKey, session, attachment, onSaved }: {
  queryKey: readonly unknown[];
  session: ProgramSession;
  attachment: SessionAttachment | null;
  onSaved: () => void | Promise<void>;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedYouthIds, setSelectedYouthIds] = useState<string[]>(() => attachment?.youth.map(youth => youth.youthId) ?? []);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();
  const rosterQuery = useQuery<SessionRosterMember[]>({
    queryKey: [...queryKey, session.id, 'roster'],
    queryFn: ({ signal }) => getSessionRoster(session.id, { signal }),
  });

  const toggleYouth = (youthId: string) => setSelectedYouthIds(current => current.includes(youthId)
    ? current.filter(id => id !== youthId)
    : [...current, youthId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((!attachment && !selectedFile?.size) || !tryLock()) return;

    const form = new FormData(event.currentTarget);
    setSubmitStatus('submitting');
    setStatusMessage(attachment ? 'Saving attachment...' : 'Uploading attachment...');

    try {
      const description = String(form.get('description') ?? '').trim();
      const data = { title: String(form.get('title')).trim(), description: description || null, youthIds: selectedYouthIds };
      if (attachment) await updateSessionAttachment(session.id, attachment.id, data);
      else await createSessionAttachment(session.id, { ...data, file: selectedFile! });
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
  };

  return {
    roster: rosterQuery.data ?? [], rosterQuery, selectedYouthIds, setSelectedFile,
    submitStatus, statusMessage, submissionComplete: submitStatus === 'submitting' || submitStatus === 'success',
    toggleYouth, submit,
  };
}
