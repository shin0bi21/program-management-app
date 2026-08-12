import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import Modal from '../../../../../../common/components/Modal/Modal';
import { useConfirmModal, type ConfirmAction } from '../../../../../../common/components/Modal/hooks/useConfirmModal';
import { deleteSessionAttachment, getSessionAttachments } from '../../../../../../common/features/programming/api/programming.api';
import type { CohortSession, SessionAttachment } from '../../../../../../common/types/cohort';
import SessionAttachmentModal from './SessionAttachmentModal/SessionAttachmentModal';
import SessionAttachmentRow from './SessionAttachmentRow/SessionAttachmentRow';
import SessionAttachmentViewerModal from './SessionAttachmentViewerModal/SessionAttachmentViewerModal';

export default function SessionAttachmentsDashboardCard({ session, canWrite }: { session: CohortSession | null; canWrite: boolean }) {
  const [attachmentTarget, setAttachmentTarget] = useState<CohortSession | null>(null);
  const [editAttachment, setEditAttachment] = useState<SessionAttachment | null>(null);
  const [detailAttachment, setDetailAttachment] = useState<SessionAttachment | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const query = useQuery({
    queryKey: ['sessions', session?.id, 'attachments'],
    queryFn: ({ signal }) => getSessionAttachments(session!.id, { signal }),
    enabled: session !== null,
  });
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });
  const loadAttachments = async () => { await query.refetch(); };
  useEffect(() => {
    setAttachmentTarget(null); setEditAttachment(null); setDetailAttachment(null); setConfirmAction(null);
  }, [session?.id]);

  return <>
    <DashboardCard
      title="Attachments"
      emptyMessage={session ? 'No attachments.' : 'No session selected.'}
      action={canWrite ? <Button size="sm" variant="secondary" disabled={!session} aria-label="Add attachments" onClick={() => { if (session) setAttachmentTarget(session); }}>+ Add</Button> : undefined}
    >
      {session ? query.isLoading ? <p role="status">Loading attachments…</p>
        : query.error ? <p role="alert">{query.error instanceof Error ? query.error.message : 'Could not load session attachments'}</p>
        : query.data?.length ? <div className="session-attachment-list">{query.data.map(attachment => <SessionAttachmentRow
          key={attachment.id}
          attachment={attachment}
          onView={() => setDetailAttachment(attachment)}
          onEdit={canWrite ? () => { setEditAttachment(attachment); setAttachmentTarget(session); } : undefined}
          onDelete={canWrite ? () => setConfirmAction({
            title: 'Delete Attachment', message: `Delete “${attachment.title}”? This cannot be undone.`, confirmLabel: 'Delete',
            confirmVariant: 'danger', successMessage: 'Attachment successfully deleted.',
            onConfirm: async () => { await deleteSessionAttachment(session.id, attachment.id); await loadAttachments(); if (detailAttachment?.id === attachment.id) setDetailAttachment(null); },
          }) : undefined}
        />)}</div> : <p className="dashboard-card__empty">No attachments.</p> : undefined}
    </DashboardCard>
    <SessionAttachmentModal session={attachmentTarget} attachment={editAttachment} onClose={() => { setAttachmentTarget(null); setEditAttachment(null); }} onSaved={loadAttachments} />
    <SessionAttachmentViewerModal session={session} attachment={detailAttachment} onClose={() => setDetailAttachment(null)} />
    <Modal isOpen={confirmAction !== null} onClose={() => setConfirmAction(null)} title={confirmAction?.title ?? ''} footer={confirmModal.footer} status={confirmModal.status} statusMessage={confirmModal.statusMessage} successDelay={confirmModal.successDelay}>
      <p>{confirmAction?.message}</p>
    </Modal>
  </>;
}
