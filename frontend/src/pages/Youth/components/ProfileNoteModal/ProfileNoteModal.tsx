import { useEffect, useState } from 'react';
import Button from '../../../../common/components/Button/Button';
import FormField from '../../../../common/components/FormField/FormField';
import Modal from '../../../../common/components/Modal/Modal';
import { createYouthProfileNote, updateYouthProfileNote } from '../../../../common/features/youth/api/youth.api';
import type { YouthProfileNote, YouthProfileNoteCategory } from '../../../../common/types/youth';
import { getErrorMessage } from '../../../../http/clientErrors';

export default function ProfileNoteModal({ youthId, note, onClose, onSaved }: { youthId: string; note?: YouthProfileNote | null; onClose: () => void; onSaved: (note: YouthProfileNote) => void }) {
  const [category, setCategory] = useState<YouthProfileNoteCategory>('general');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setCategory(note?.category ?? 'general'); setTitle(note?.title ?? ''); setDetails(note?.details ?? ''); setError(''); }, [note]);
  const submit = async () => {
    if (!title.trim()) return;
    setSubmitting(true); setError('');
    try {
      const data = { category, title: title.trim(), details: details.trim() || null };
      onSaved(note ? await updateYouthProfileNote(youthId, note.id, data) : await createYouthProfileNote(youthId, data));
    } catch (err) { setError(getErrorMessage(err, 'Failed to save profile note')); } finally { setSubmitting(false); }
  };
  return <Modal isOpen onClose={onClose} title={note ? 'Edit Profile Note' : 'Add Profile Note'} status={error ? 'error' : submitting ? 'submitting' : 'idle'} statusMessage={error || (submitting ? 'Saving note...' : undefined)} disableClose={submitting} footer={<><Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button><Button onClick={submit} disabled={submitting || !title.trim()}>Save</Button></>}>
    <FormField id="profile-note-category" label="Type"><select id="profile-note-category" value={category} onChange={event => setCategory(event.target.value as YouthProfileNoteCategory)}><option value="general">General</option><option value="health">Health</option><option value="preference">Preference</option></select></FormField>
    <FormField id="profile-note-title" label="Title *"><input id="profile-note-title" value={title} onChange={event => setTitle(event.target.value)} /></FormField>
    <FormField id="profile-note-details" label="Details (optional)"><textarea id="profile-note-details" rows={5} value={details} onChange={event => setDetails(event.target.value)} /></FormField>
  </Modal>;
}
