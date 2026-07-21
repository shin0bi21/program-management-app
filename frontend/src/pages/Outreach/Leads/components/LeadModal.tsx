import FormField from '../../../../common/components/FormField/FormField';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/ModalFormFooter/ModalFormFooter';
import type { Lead } from '../types';
import { useLeadModal } from './useLeadModal';
import './LeadModal.css';

export default function LeadModal({ isOpen, onClose, onSuccess, lead }: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
  lead?: Lead;
}) {
  const isEdit = lead !== undefined;
  const { register, errors, handleSubmit, onValid, submitStatus, error, handleClose } = useLeadModal({ isOpen, onClose, onSuccess, lead });
  const footer = <ModalFormFooter formId="lead-form" submitLabel={isEdit ? 'Update Lead' : 'Create Lead'} submitStatus={submitStatus} onClose={handleClose} />;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isEdit ? 'Edit Lead' : 'Create Lead'} footer={footer} status={submitStatus}
      statusMessage={submitStatus === 'submitting' ? (isEdit ? 'Updating lead...' : 'Creating lead...') : submitStatus === 'success' ? (isEdit ? 'Lead updated successfully!' : 'Lead created successfully!') : submitStatus === 'error' ? error : undefined}>
      <form id="lead-form" onSubmit={handleSubmit(onValid)}>
        <div className="section-header"><h3>Youth Information</h3></div>
        <div className="form-row">
          <FormField id="lead-youthFirstName" label="First Name *" error={errors.youthFirstName?.message}><input id="lead-youthFirstName" {...register('youthFirstName')} /></FormField>
          <FormField id="lead-youthLastName" label="Last Name *" error={errors.youthLastName?.message}><input id="lead-youthLastName" {...register('youthLastName')} /></FormField>
        </div>
        <div className="form-row">
          <FormField id="lead-age" label="Age *" error={errors.age?.message}><input id="lead-age" type="number" min="5" max="24" {...register('age', { valueAsNumber: true })} /></FormField>
          <FormField id="lead-school" label="School *" error={errors.school?.message}><input id="lead-school" {...register('school')} /></FormField>
        </div>

        <div className="section-divider">
          <div className="section-header"><h3>Primary Contact</h3></div>
          <div className="section-content">
            <div className="form-row">
              <FormField id="lead-contactFirstName" label="First Name *" error={errors.contactFirstName?.message}><input id="lead-contactFirstName" {...register('contactFirstName')} /></FormField>
              <FormField id="lead-contactLastName" label="Last Name *" error={errors.contactLastName?.message}><input id="lead-contactLastName" {...register('contactLastName')} /></FormField>
            </div>
            <div className="form-row">
              <FormField id="lead-contactPhoneNumber" label="Phone Number *" error={errors.contactPhoneNumber?.message}><input id="lead-contactPhoneNumber" type="tel" {...register('contactPhoneNumber')} /></FormField>
              <FormField id="lead-contactRelationship" label="Relationship *" error={errors.contactRelationship?.message}><select id="lead-contactRelationship" {...register('contactRelationship')}><option value="parent">Parent</option><option value="guardian">Guardian</option><option value="sibling">Sibling</option><option value="emergency">Emergency Contact</option></select></FormField>
            </div>
          </div>
        </div>

        <div className="section-divider">
          <div className="section-header"><h3>Follow-up Information</h3></div>
          <div className="section-content">
            <FormField id="lead-discoverySource" label="How Did They Hear About Us? *" error={errors.discoverySource?.message}><select id="lead-discoverySource" {...register('discoverySource')}><option value="online">Online</option><option value="friend_family">Friend / Family</option><option value="school">School</option><option value="community_outreach">Community Outreach</option><option value="other">Other</option></select></FormField>
          </div>
        </div>

        <div className="section-divider">
          <div className="section-header"><h3>Notes <span className="section-optional">(optional)</span></h3></div>
          <div className="section-content"><FormField id="lead-notes" label="Anything else we should know?" error={errors.notes?.message}><textarea id="lead-notes" rows={5} {...register('notes')} /></FormField></div>
        </div>
      </form>
    </Modal>
  );
}
