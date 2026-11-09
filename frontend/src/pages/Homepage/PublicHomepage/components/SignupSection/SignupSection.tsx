import { useEffect, useState } from 'react';
import { Controller } from 'react-hook-form';
import Button from '../../../../../common/components/Button/Button';
import OutreachFormFields from '../../../../../common/features/OutreachForm/OutreachFormFields';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import { useSignupSection } from './useSignupSection';

/**
 * Displays signup and replaces each accepted form with feedback for 2500 milliseconds.
 * Starting another entry mounts a fresh form after that feedback ends.
 * @example <SignupSection />
 */
export default function SignupSection() {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!showSuccess) return;

    const timeoutId = window.setTimeout(() => setShowSuccess(false), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [showSuccess]);

  return (
    <section id="signup" className="cohort-section" aria-labelledby="cohort-section-title">
      <div className="section-inner">
        <div className="cohort-section-copy">
          <h2 id="cohort-section-title" className="section-title">Interested?</h2>
          <p className="cohort-section-description">
            Leave your contact information below and we will follow up with next steps.
          </p>
        </div>
        <div className="cohort-form-shell">
          {showSuccess ? (
            <div className="cohort-success-card" role="status">
              <p className="cohort-success-title">Thank you for your submission.</p>
              <p className="cohort-success-copy">We will be in touch with next steps soon.</p>
            </div>
          ) : <SignupForm onSuccess={() => setShowSuccess(true)} />}
        </div>
      </div>
    </section>
  );
}

/**
 * Owns one blank intake draft until the server accepts it or the section unmounts.
 * @param props.onSuccess - Ends this form instance and shows the section's feedback.
 * @example <SignupForm onSuccess={showFeedback} />
 */
function SignupForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, control, errors, handleSubmit, onValid, submitStatus, error, isFormLocked } = useSignupSection(onSuccess);

  return (
    <form className="cohort-inline-form" onSubmit={handleSubmit(onValid)}>
      <fieldset className="cohort-inline-form-fields" disabled={isFormLocked}>
        {submitStatus === 'error' && error && <div className="form-error" role="alert">{error}</div>}
        <input type="text" hidden tabIndex={-1} autoComplete="off" aria-hidden="true" {...register('website')} />
        <div className="outreach-form-section">
          <Controller
            name="submittedByRole"
            control={control}
            render={({ field }) => (
              <FormField id="cohort-submittedByRole" label="Who is filling out this form? *" error={errors.submittedByRole?.message}>
                <FloatingSelect
                  id="cohort-submittedByRole"
                  ariaLabel="Who is filling out this form?"
                  value={field.value ?? ''}
                  options={[
                    { value: 'youth', label: 'Youth' },
                    { value: 'parent', label: 'Parent' },
                    { value: 'guardian', label: 'Guardian' },
                  ]}
                  onChange={field.onChange}
                  disabled={isFormLocked}
                />
              </FormField>
            )}
          />
        </div>
        <OutreachFormFields idPrefix="cohort" register={register} control={control} errors={errors} disabled={isFormLocked} />
        <div className="cohort-inline-form-actions">
          <Button type="submit" disabled={isFormLocked}>
            {submitStatus === 'submitting' ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
