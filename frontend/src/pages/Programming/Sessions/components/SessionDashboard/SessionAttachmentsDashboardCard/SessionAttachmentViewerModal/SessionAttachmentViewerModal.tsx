import ViewFileModal from '../../../../../../../common/features/ViewFileModal/ViewFileModal';
import useViewFileModal from '../../../../../../../common/features/ViewFileModal/hooks/useViewFileModal';
import {
  downloadSessionAttachment,
  getSessionAttachmentFile,
} from '../../../../sessions.api';
import type { Session } from '../../../../../../../common/features/programming/sessions/types';
import type { SessionAttachment } from '../../../../types';

interface SessionAttachmentViewerModalProps {
  session: Session | null;
  attachment: SessionAttachment | null;
  onClose: () => void;
}

/**
 * Mounts one attachment preview while the opening view supplies an active target.
 * @param props - Saved session/attachment and the action clearing its target.
 * @example <SessionAttachmentViewerModal session={session} attachment={attachment} onClose={close} />
 */
export default function SessionAttachmentViewerModal({ session, attachment, onClose }: SessionAttachmentViewerModalProps) {
  return session && attachment
    ? <AttachmentPreview key={`${session.id}:${attachment.id}`} session={session} attachment={attachment} onClose={onClose} />
    : null;
}

/**
 * Loads the selected preview and cancels its request when the viewer unmounts.
 * @param props - Required saved targets and close action.
 * @example <AttachmentPreview session={session} attachment={attachment} onClose={close} />
 */
function AttachmentPreview({ session, attachment, onClose }: { session: Session; attachment: SessionAttachment; onClose: () => void }) {
  const viewFileModal = useViewFileModal({
    requestKey: `${session.id}:${attachment.id}`,
    title: attachment.title,
    mimeType: attachment.mimeType,
    onClose,
    loadFile: signal => getSessionAttachmentFile(session.id, attachment.id, { signal }),
    formatLoadError: cause => cause instanceof Error
      ? cause.message
      : 'Could not load attachment preview',
    onDownload: () => downloadSessionAttachment(session.id, attachment),
  });

  return <ViewFileModal {...viewFileModal} />;
}
