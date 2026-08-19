import { Controller, type Control, type FieldErrors, type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';
import type { ReactNode } from 'react';
import FloatingSelect from '../../../../components/FloatingSelect/FloatingSelect';
import FormField from '../../../../components/FormField/FormField';
import type { OutreachFormValues } from './outreachFormSchema';
import './OutreachForm.css';

const contactRelationshipOptions = [
  { value: 'parent', label: 'Parent' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'sibling', label: 'Sibling' },
] as const;

const discoverySourceOptions = [
  { value: 'online', label: 'Online' },
  { value: 'friend_family', label: 'Friend / Family' },
  { value: 'school', label: 'School' },
  { value: 'community_outreach', label: 'Community Outreach' },
  { value: 'other', label: 'Other' },
] as const;

export default function OutreachFormFields<T extends OutreachFormValues & FieldValues>({ idPrefix, register, control, errors, programField }: {
  idPrefix: string;
  register: UseFormRegister<T>;
  control: Control<T>;
  errors: FieldErrors<T>;
  programField?: ReactNode;
}) {
  const id = (field: keyof OutreachFormValues) => `${idPrefix}-${field}`;
  const field = (name: keyof OutreachFormValues) => name as Path<T>;

  return <>
    <section className="outreach-form-section" aria-labelledby={`${idPrefix}-youth-title`}>
      <h3 id={`${idPrefix}-youth-title`} className="outreach-form-section-title">Youth Information</h3>
      <div className="form-row">
        <FormField id={id('youthFirstName')} label="First Name *" error={errors.youthFirstName?.message as string | undefined}><input id={id('youthFirstName')} autoComplete="given-name" {...register(field('youthFirstName'))} /></FormField>
        <FormField id={id('youthLastName')} label="Last Name *" error={errors.youthLastName?.message as string | undefined}><input id={id('youthLastName')} autoComplete="family-name" {...register(field('youthLastName'))} /></FormField>
      </div>
      <div className="form-row">
        <FormField id={id('age')} label="Age *" error={errors.age?.message as string | undefined}><input id={id('age')} type="number" min="12" max="19" {...register(field('age'), { valueAsNumber: true })} /></FormField>
        <FormField id={id('school')} label="School *" error={errors.school?.message as string | undefined}><input id={id('school')} {...register(field('school'))} /></FormField>
      </div>
      {programField && <div className="form-row">{programField}</div>}
    </section>

    <section className="outreach-form-section" aria-labelledby={`${idPrefix}-contact-title`}>
      <h3 id={`${idPrefix}-contact-title`} className="outreach-form-section-title">Primary Contact</h3>
      <div className="form-row">
        <FormField id={id('contactPhoneNumber')} label="Phone Number *" error={errors.contactPhoneNumber?.message as string | undefined}><input id={id('contactPhoneNumber')} type="tel" {...register(field('contactPhoneNumber'))} /></FormField>
        <Controller
          name={field('contactRelationship')}
          control={control}
          render={({ field: relationshipField }) => (
            <FormField id={id('contactRelationship')} label="Relationship *" error={errors.contactRelationship?.message as string | undefined}>
              <FloatingSelect
                id={id('contactRelationship')}
                ariaLabel="Relationship"
                value={String(relationshipField.value ?? '')}
                options={contactRelationshipOptions}
                onChange={relationshipField.onChange}
              />
            </FormField>
          )}
        />
      </div>
    </section>

    <div className="outreach-form-section">
      <Controller
        name={field('discoverySource')}
        control={control}
        render={({ field: discoveryField }) => (
          <FormField id={id('discoverySource')} label="How Did You Hear About Us? *" error={errors.discoverySource?.message as string | undefined}>
            <FloatingSelect
              id={id('discoverySource')}
              ariaLabel="How Did You Hear About Us?"
              value={String(discoveryField.value ?? '')}
              options={discoverySourceOptions}
              onChange={discoveryField.onChange}
            />
          </FormField>
        )}
      />
    </div>

    <div className="outreach-form-section outreach-form-section--continuation">
      <FormField id={id('notes')} label="Anything else we should know?" error={errors.notes?.message as string | undefined}><textarea id={id('notes')} rows={5} {...register(field('notes'))} /></FormField>
    </div>
  </>;
}
