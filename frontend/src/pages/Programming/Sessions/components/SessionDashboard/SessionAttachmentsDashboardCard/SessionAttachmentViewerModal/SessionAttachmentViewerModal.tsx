import ViewFileModal from '../../../../../../../common/components/ViewFileModal/ViewFileModal';
import useViewFileModal from '../../../../../../../common/components/ViewFileModal/hooks/useViewFileModal';
import {
  downloadSessionAttachment,
  getSessionAttachmentFile,
} from '../../../../../../../common/features/programming/api/sessions.api';
import type { CohortSession, SessionAttachment } from '../../../../../../../common/types/cohort';

export default function SessionAttachmentViewerModal({
  session,
  attachment,
  onClose,
}: {
  session: CohortSession | null;
  attachment: SessionAttachment | null;
  onClose: () => void;
}) {
  const viewFileModal = useViewFileModal({
    isOpen: attachment !== null && session !== null,
    requestKey: attachment && session ? `${session.id}:${attachment.id}` : null,
    title: attachment?.title ?? '',
    mimeType: attachment?.mimeType ?? '',
    onClose,
    loadFile: signal => getSessionAttachmentFile(session!.id, attachment!.id, { signal }),
    formatLoadError: cause => cause instanceof Error
      ? cause.message
      : 'Could not load attachment preview',
    onDownload: attachment && session
      ? () => downloadSessionAttachment(session.id, attachment)
      : undefined,
  });

  return <ViewFileModal {...viewFileModal} />;
}
