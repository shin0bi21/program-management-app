import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../../../../common/components/Button/Button';
import ConfirmModal from '../../../../../../common/components/ConfirmModal/ConfirmModal';
import { type ConfirmAction } from '../../../../../../common/components/ConfirmModal/types';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import { deleteSessionAttachment, getSessionAttachments } from '../../../../../../common/features/programming/api/sessions.api';
import type { CohortSession, SessionAttachment } from '../../../../../../common/types/cohort';
import SessionAttachmentModal from './SessionAttachmentModal/SessionAttachmentModal';
import SessionAttachmentRow from './SessionAttachmentRow/SessionAttachmentRow';
import SessionAttachmentViewerModal from './SessionAttachmentViewerModal/SessionAttachmentViewerModal';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';

export default function SessionAttachmentsDashboardCard({
  queryKey,
  session,
  canWrite,
  onErrorChange,
}: {
  queryKey: readonly unknown[];
  session: CohortSession | null;
  canWrite: boolean;
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
        : query.error ? <UnavailableState compact title="Session attachments unavailable" onRetry={query.refetch} />
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
    <SessionAttachmentModal queryKey={queryKey} session={attachmentTarget} attachment={editAttachment} onClose={() => { setAttachmentTarget(null); setEditAttachment(null); }} onSaved={loadAttachments} />
    <SessionAttachmentViewerModal session={session} attachment={detailAttachment} onClose={() => setDetailAttachment(null)} />
    <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
  </>;
}
