import { FormEvent, useEffect, useState } from 'react';
import FormField from '../../../../common/components/FormField/FormField';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/ModalFormFooter/ModalFormFooter';
import { inviteYouth } from '../../../../common/api/youth.api';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import type { YouthProfile } from '../../../../common/types/youth';

interface Props {
  youth: YouthProfile | null;
  onClose: () => void;
  onSuccess: (account: NonNullable<YouthProfile['account']>) => void;
}

export default function YouthInviteModal({ youth, onClose, onSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (youth) {
      setEmail('');
      setStatus('idle');
      setError('');
    }
  }, [youth]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!youth) return;
    setStatus('submitting');
    setError('');
    try {
      const account = await inviteYouth(youth.id, email.trim());
      if (!account) throw new Error('Account invitation was not created');
      setStatus('success');
      setTimeout(() => onSuccess(account), 800);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send youth invitation'));
      setStatus('error');
    }
  };

  return (
    <Modal
      isOpen={!!youth}
      onClose={onClose}
      title={youth ? `Invite ${youth.firstName} ${youth.lastName}` : 'Invite Youth'}
      status={status}
      statusMessage={status === 'submitting' ? 'Sending invite...' : status === 'success' ? 'Invite sent!' : status === 'error' ? error : undefined}
      disableClose={status === 'submitting'}
      footer={<ModalFormFooter formId="youth-invite-form" submitLabel="Send Invite" submitStatus={status} onClose={onClose} />}
    >
      <form id="youth-invite-form" onSubmit={submit}>
        <FormField id="youthInviteEmail" label="Login Email *">
          <input id="youthInviteEmail" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}
