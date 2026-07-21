import Button from '../../../../common/components/Button/Button'
import OutreachFormFields from '../../../../common/components/OutreachForm/OutreachFormFields'
import { useSignupSection } from './useSignupSection'

export default function SignupSection() {
  const {
    register,
    errors,
    handleSubmit,
    onValid,
    submitStatus,
    error,
    isFormLocked,
  } = useSignupSection()

  return (
    <section id="signup" className="cohort-section" aria-labelledby="cohort-section-title">
      <div className="section-inner">
        <div className="cohort-section-copy">
          <h2 id="cohort-section-title" className="section-title">Interested?</h2>
          <p className="cohort-section-title">
            We are now accepting signups for our <span>September cohort</span>.
          </p>
          <p className="cohort-section-description">
             Leave your contact information below and we will follow up with next steps.
          </p>
        </div>
        <div className="cohort-form-shell">
          <form
            className={`cohort-inline-form${submitStatus === 'success' ? ' cohort-inline-form--muted' : ''}`}
            onSubmit={handleSubmit(onValid)}
          >
            <fieldset className="cohort-inline-form-fields" disabled={isFormLocked}>
              {submitStatus === 'error' && error && (
                <div className="form-error">{error}</div>
              )}
              <OutreachFormFields idPrefix="cohort" register={register} errors={errors} />
              <div className="cohort-inline-form-actions">
                <Button type="submit" disabled={submitStatus === 'submitting'}>
                  {submitStatus === 'submitting' ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </fieldset>
          </form>
          {submitStatus === 'success' && (
            <div className="cohort-success-overlay" aria-live="polite">
              <div className="cohort-success-card">
                <p className="cohort-success-title">Thank you for your submission.</p>
                <p className="cohort-success-copy">We will be in touch with next steps soon.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
