import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import FormField from '../FormField/FormField';
import type { OutreachFormValues } from './outreachFormSchema';
import './OutreachForm.css';

const contactRelationshipOptions = [
  { value: 'parent', label: 'Parent' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'emergency', label: 'Emergency Contact' },
] as const;

const discoverySourceOptions = [
  { value: 'online', label: 'Online' },
  { value: 'friend_family', label: 'Friend / Family' },
  { value: 'school', label: 'School' },
  { value: 'community_outreach', label: 'Community Outreach' },
  { value: 'other', label: 'Other' },
] as const;

export default function OutreachFormFields({ idPrefix, register, errors }: {
  idPrefix: string;
  register: UseFormRegister<OutreachFormValues>;
  errors: FieldErrors<OutreachFormValues>;
}) {
  const id = (field: keyof OutreachFormValues) => `${idPrefix}-${field}`;

  return <>
    <section className="outreach-form-section" aria-labelledby={`${idPrefix}-youth-title`}>
      <h3 id={`${idPrefix}-youth-title`} className="outreach-form-section-title">Youth Information</h3>
      <div className="form-row">
        <FormField id={id('youthFirstName')} label="First Name *" error={errors.youthFirstName?.message}><input id={id('youthFirstName')} autoComplete="given-name" {...register('youthFirstName')} /></FormField>
        <FormField id={id('youthLastName')} label="Last Name *" error={errors.youthLastName?.message}><input id={id('youthLastName')} autoComplete="family-name" {...register('youthLastName')} /></FormField>
      </div>
      <div className="form-row">
        <FormField id={id('age')} label="Age *" error={errors.age?.message}><input id={id('age')} type="number" min="5" max="24" {...register('age', { valueAsNumber: true })} /></FormField>
        <FormField id={id('school')} label="School *" error={errors.school?.message}><input id={id('school')} {...register('school')} /></FormField>
      </div>
    </section>

    <section className="outreach-form-section" aria-labelledby={`${idPrefix}-contact-title`}>
      <h3 id={`${idPrefix}-contact-title`} className="outreach-form-section-title">Primary Contact</h3>
      <div className="form-row">
        <FormField id={id('contactFirstName')} label="First Name *" error={errors.contactFirstName?.message}><input id={id('contactFirstName')} {...register('contactFirstName')} /></FormField>
        <FormField id={id('contactLastName')} label="Last Name *" error={errors.contactLastName?.message}><input id={id('contactLastName')} {...register('contactLastName')} /></FormField>
      </div>
      <div className="form-row">
        <FormField id={id('contactPhoneNumber')} label="Phone Number *" error={errors.contactPhoneNumber?.message}><input id={id('contactPhoneNumber')} type="tel" {...register('contactPhoneNumber')} /></FormField>
        <FormField id={id('contactRelationship')} label="Relationship *" error={errors.contactRelationship?.message}>
          <select id={id('contactRelationship')} {...register('contactRelationship')}>
            {contactRelationshipOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </FormField>
      </div>
    </section>

    <section className="outreach-form-section" aria-labelledby={`${idPrefix}-follow-up-title`}>
      <h3 id={`${idPrefix}-follow-up-title`} className="outreach-form-section-title">Follow-up Information</h3>
      <FormField id={id('discoverySource')} label="How Did You Hear About Us? *" error={errors.discoverySource?.message}>
        <select id={id('discoverySource')} {...register('discoverySource')}>
          {discoverySourceOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </FormField>
    </section>

    <section className="outreach-form-section" aria-labelledby={`${idPrefix}-notes-title`}>
      <h3 id={`${idPrefix}-notes-title`} className="outreach-form-section-title">Notes <span className="outreach-form-section-optional">(optional)</span></h3>
      <FormField id={id('notes')} label="Anything else we should know?" error={errors.notes?.message}><textarea id={id('notes')} rows={5} {...register('notes')} /></FormField>
    </section>
  </>;
}
