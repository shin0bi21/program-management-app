import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ConfirmAction } from '../../../../../../../common/components/ConfirmModal/types';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import { deleteSessionAttachment, getSessionAttachments } from '../../../../sessions.api';
import type { CohortSession, SessionAttachment } from '../../../../types';

export function useSessionAttachments({ queryKey, session, onErrorChange }: {
  queryKey: readonly unknown[];
  session: CohortSession | null;
  onErrorChange?: PageErrorChangeHandler;
}) {
  const [attachmentTarget, setAttachmentTarget] = useState<CohortSession | null>(null);
  const [editAttachment, setEditAttachment] = useState<SessionAttachment | null>(null);
  const [detailAttachment, setDetailAttachment] = useState<SessionAttachment | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const query = useQuery({
    queryKey: [...queryKey, session?.id, 'attachments'],
    queryFn: ({ signal }) => getSessionAttachments(session!.id, { signal }),
    enabled: session !== null,
  });
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: query.refetch }), [query.refetch]);
  usePageErrorReporter(onErrorChange, query.error ? 'Could not load session attachments.' : null, retryAction);

  useEffect(() => {
    setAttachmentTarget(null);
    setEditAttachment(null);
    setDetailAttachment(null);
    setConfirmAction(null);
  }, [session?.id]);

  const loadAttachments = async () => { await query.refetch(); };
  const openAdd = () => { if (session) setAttachmentTarget(session); };
  const openEdit = (attachment: SessionAttachment) => {
    if (!session) return;
    setEditAttachment(attachment);
    setAttachmentTarget(session);
  };
  const closeEditor = () => { setAttachmentTarget(null); setEditAttachment(null); };
  const requestDelete = (attachment: SessionAttachment) => {
    if (!session) return;
    setConfirmAction({
      title: 'Delete Attachment',
      message: `Delete “${attachment.title}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      successMessage: 'Attachment successfully deleted.',
      onConfirm: async () => {
        await deleteSessionAttachment(session.id, attachment.id);
        await loadAttachments();
        if (detailAttachment?.id === attachment.id) setDetailAttachment(null);
      },
    });
  };

  return {
    query, attachmentTarget, editAttachment, detailAttachment, confirmAction,
    loadAttachments, openAdd, openEdit, closeEditor, setDetailAttachment, requestDelete, setConfirmAction,
  };
}
