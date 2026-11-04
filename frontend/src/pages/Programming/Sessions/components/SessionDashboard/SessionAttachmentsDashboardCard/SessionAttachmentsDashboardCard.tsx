import Button from '../../../../../../common/components/Button/Button';
import ConfirmModal from '../../../../../../common/components/ConfirmModal/ConfirmModal';
import { DashboardCard } from '../../../../../../common/components/DashboardCard/DashboardCard';
import type { ProgramSession } from '../../../types';
import SessionAttachmentModal from './SessionAttachmentModal/SessionAttachmentModal';
import SessionAttachmentRow from './SessionAttachmentRow/SessionAttachmentRow';
import SessionAttachmentViewerModal from './SessionAttachmentViewerModal/SessionAttachmentViewerModal';
import { type PageMessageChangeHandler } from '../../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import UnavailableState from '../../../../../../common/components/UnavailableState/UnavailableState';
import { useSessionAttachments } from './hooks/useSessionAttachments';

export default function SessionAttachmentsDashboardCard({
  queryKey,
  session,
  canWrite,
  onMessageChange,
}: {
  queryKey: readonly unknown[];
  session: ProgramSession | null;
  canWrite: boolean;
  onMessageChange?: PageMessageChangeHandler;
}) {
  const workflow = useSessionAttachments({ queryKey, session, onMessageChange });
  const { query, attachmentTarget, editAttachment, detailAttachment, confirmAction, loadAttachments, openAdd, openEdit, closeEditor, setDetailAttachment, requestDelete, setConfirmAction } = workflow;

  return <>
    <DashboardCard
      title="Attachments"
      loading={Boolean(session) && query.isLoading}
      loadingLabel="Loading attachments…"
      emptyMessage={session ? 'No attachments.' : 'No session selected.'}
      action={canWrite ? <Button size="sm" variant="secondary" disabled={!session} aria-label="Add attachments" onClick={openAdd}>+ Add</Button> : undefined}
    >
      {session ? query.error ? <UnavailableState compact title="Session attachments unavailable" onRetry={query.refetch} />
        : query.data?.length ? <div className="session-attachment-list">{query.data.map(attachment => <SessionAttachmentRow
          key={attachment.id}
          attachment={attachment}
          onView={() => setDetailAttachment(attachment)}
          onEdit={canWrite ? () => openEdit(attachment) : undefined}
          onDelete={canWrite ? () => requestDelete(attachment) : undefined}
        />)}</div> : <p className="dashboard-card__empty">No attachments.</p> : undefined}
    </DashboardCard>
    <SessionAttachmentModal queryKey={queryKey} session={attachmentTarget} attachment={editAttachment} onClose={closeEditor} onSaved={loadAttachments} />
    <SessionAttachmentViewerModal session={session} attachment={detailAttachment} onClose={() => setDetailAttachment(null)} />
    <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
  </>;
}
