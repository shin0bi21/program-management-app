import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConfirmAction } from '../../../../../../../common/components/ConfirmModal/types';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import { deleteSessionAttachment, getSessionAttachments } from '../../../../sessions.api';
import type { Session } from '../../../../../../../common/features/programming/sessions/types';
import type { SessionAttachment } from '../../../../types';

/**
 * Owns this session's attachments query and ID-based editor and viewer targets.
 * Saved records resolve from the current session and complete query result; drafts stay with the modal.
 * @param options - Current saved session, query scope, and page-message reporter.
 * @example useSessionAttachments({ queryKey: ['sessions'], session })
 */
export function useSessionAttachments({ queryKey, session, onMessageChange }: {
  queryKey: readonly unknown[];
  session: Session | null;
  onMessageChange?: PageMessageChangeHandler;
}) {
  const client = useQueryClient();
  const currentSessionId = useRef(session?.id);
  currentSessionId.current = session?.id;
  const [editorSessionId, setEditorSessionId] = useState<string | null>(null);
  const [editAttachmentId, setEditAttachmentId] = useState<string | null>(null);
  const [detailAttachmentId, setDetailAttachmentId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const childQueryKey = [...queryKey, session?.id, 'attachments'];
  const query = useQuery({
    queryKey: childQueryKey,
    queryFn: ({ signal }) => getSessionAttachments(session!.id, { signal }),
    enabled: session !== null,
  });
  const editAttachment = query.data?.find(attachment => attachment.id === editAttachmentId) ?? null;
  const detailAttachment = query.data?.find(attachment => attachment.id === detailAttachmentId) ?? null;
  const isEditorAvailable = editAttachmentId === null || editAttachment !== null;
  const attachmentTarget = session?.id === editorSessionId && isEditorAvailable ? session : null;
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: query.refetch }), [query.refetch]);
  usePageMessageReporter(onMessageChange, query.error ? 'Could not load session attachments.' : null, retryAction);

  useEffect(() => {
    setEditorSessionId(null);
    setEditAttachmentId(null);
    setDetailAttachmentId(null);
    setConfirmAction(null);
  }, [session?.id]);

  /**
   * Keeps a departing session's async work from refreshing the active query.
   * @example isCurrentTarget() // false after the selected session changes
   */
  const isCurrentTarget = () => currentSessionId.current === session?.id;
  const loadAttachments = async () => {
    if (!isCurrentTarget()) return;

    await query.refetch();
  };
  const openAdd = () => {
    if (!session) return;

    setEditAttachmentId(null);
    setEditorSessionId(session.id);
  };
  const openEdit = (attachment: SessionAttachment) => {
    if (!session) return;

    setEditAttachmentId(attachment.id);
    setEditorSessionId(session.id);
  };
  const closeEditor = () => { setEditorSessionId(null); setEditAttachmentId(null); };
  const setDetailAttachment = (attachment: SessionAttachment | null) => {
    setDetailAttachmentId(attachment?.id ?? null);
  };
  const requestDelete = (attachment: SessionAttachment) => {
    if (!session) return;

    setConfirmAction({
      title: 'Delete Attachment',
      message: `Delete “${attachment.title}”? This cannot be undone.`,
      confirmVariant: 'danger',
      successMessage: 'Attachment successfully deleted.',
      onConfirm: async () => {
        if (!isCurrentTarget()) return;

        await deleteSessionAttachment(session.id, attachment.id);
        if (!isCurrentTarget()) return;

        // Confirmed deletion remains authoritative if the follow-up list refresh fails.
        client.setQueryData<SessionAttachment[]>(childQueryKey, current =>
          current?.filter(candidate => candidate.id !== attachment.id),
        );
        setDetailAttachmentId(current => current === attachment.id ? null : current);
        await loadAttachments();
      },
    });
  };

  return {
    query, attachmentTarget, editAttachment, detailAttachment, confirmAction,
    loadAttachments, openAdd, openEdit, closeEditor, setDetailAttachment, requestDelete, setConfirmAction,
  };
}
