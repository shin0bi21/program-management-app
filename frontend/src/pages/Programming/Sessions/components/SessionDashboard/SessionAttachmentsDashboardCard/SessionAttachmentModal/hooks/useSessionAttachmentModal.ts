import { type FormEvent, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createSessionAttachment, getSessionRoster, updateSessionAttachment } from '../../../../../sessions.api';
import type { SubmitStatus } from '../../../../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../../../../common/hooks/useSubmitLock';
import type { ProgramSession, SessionAttachment, SessionRosterMember } from '../../../../../types';

export function useSessionAttachmentModal({ queryKey, session, attachment, onSaved }: {
  queryKey: readonly unknown[];
  session: ProgramSession | null;
  attachment: SessionAttachment | null;
  onSaved: () => void | Promise<void>;
}) {
  const [selectedYouthIds, setSelectedYouthIds] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();
  const rosterQuery = useQuery<SessionRosterMember[]>({
    queryKey: [...queryKey, session?.id, 'roster'],
    queryFn: ({ signal }) => getSessionRoster(session!.id, { signal }),
    enabled: session !== null,
  });

  useEffect(() => {
    if (!session) return;
    setSelectedYouthIds(attachment?.youth.map(youth => youth.youthId) ?? []);
    setSelectedFile(null);
    setSubmitStatus('idle');
    setStatusMessage('');
    unlock();
  }, [attachment, session, unlock]);

  const toggleYouth = (youthId: string) => setSelectedYouthIds(current => current.includes(youthId)
    ? current.filter(id => id !== youthId)
    : [...current, youthId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || (!attachment && !selectedFile?.size) || !tryLock()) return;

    const form = new FormData(event.currentTarget);
    setSubmitStatus('submitting');
    setStatusMessage(attachment ? 'Saving attachment...' : 'Uploading attachment...');

    try {
      const description = String(form.get('description') ?? '').trim();
      const data = { title: String(form.get('title')).trim(), description: description || null, youthIds: selectedYouthIds };
      if (attachment) await updateSessionAttachment(session.id, attachment.id, data);
      else await createSessionAttachment(session.id, { ...data, file: selectedFile! });
      await onSaved();
      setStatusMessage(attachment ? 'Attachment successfully updated.' : 'Attachment successfully added.');
      setSubmitStatus('success');
    } catch (cause) {
      setStatusMessage(cause instanceof Error ? cause.message : `Could not ${attachment ? 'update' : 'add'} attachment`);
      setSubmitStatus('error');
      unlock();
    }
  };

  return {
    roster: rosterQuery.data ?? [], rosterQuery, selectedYouthIds, setSelectedFile,
    submitStatus, statusMessage, submissionComplete: submitStatus === 'submitting' || submitStatus === 'success',
    toggleYouth, submit,
  };
}
