import Button from '../../../../common/components/Button/Button'
import FormField from '../../../../common/components/FormField/FormField'
import { useSignupSection } from './useSignupSection'
import { discoverySourceOptions } from './signupSectionSchema'

export default function SignupSection() {
  const {
    formData,
    fieldErrors,
    submitStatus,
    error,
    isFormLocked,
    handleFieldChange,
    handleInterestSubmit,
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
            onSubmit={handleInterestSubmit}
          >
            <fieldset className="cohort-inline-form-fields" disabled={isFormLocked}>
              {submitStatus === 'error' && error && (
                <div className="form-error">{error}</div>
              )}
              <div className="form-row">
                <FormField id="cohort-youthName" label="Youth Name" error={fieldErrors.youthName}>
                  <input
                    id="cohort-youthName"
                    value={formData.youthName}
                    onChange={(event) => handleFieldChange('youthName', event.target.value)}
                    autoComplete="name"
                  />
                </FormField>
                <FormField id="cohort-parentName" label="Parent Name" error={fieldErrors.parentName}>
                  <input
                    id="cohort-parentName"
                    value={formData.parentName}
                    onChange={(event) => handleFieldChange('parentName', event.target.value)}
                    autoComplete="name"
                  />
                </FormField>
              </div>
              <div className="form-row">
                <FormField id="cohort-age" label="Age" error={fieldErrors.age}>
                  <input
                    id="cohort-age"
                    type="number"
                    min="1"
                    max="120"
                    value={formData.age}
                    onChange={(event) => handleFieldChange('age', event.target.value)}
                    inputMode="numeric"
                  />
                </FormField>
                <FormField id="cohort-school" label="School" error={fieldErrors.school}>
                  <input
                    id="cohort-school"
                    value={formData.school}
                    onChange={(event) => handleFieldChange('school', event.target.value)}
                  />
                </FormField>
              </div>
              <div className="form-row">
                <FormField id="cohort-email" label="Email" error={fieldErrors.email}>
                  <input
                    id="cohort-email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => handleFieldChange('email', event.target.value)}
                    autoComplete="email"
                  />
                </FormField>
                <FormField id="cohort-phoneNumber" label="Phone Number" error={fieldErrors.phoneNumber}>
                  <input
                    id="cohort-phoneNumber"
                    value={formData.phoneNumber}
                    onChange={(event) => handleFieldChange('phoneNumber', event.target.value)}
                    autoComplete="tel"
                  />
                </FormField>
              </div>
              <div className="form-row">
                <FormField id="cohort-discoverySource" label="How Did You Hear About Us?" error={fieldErrors.discoverySource}>
                  <select
                    id="cohort-discoverySource"
                    value={formData.discoverySource}
                    onChange={(event) => handleFieldChange('discoverySource', event.target.value)}
                  >
                    <option value="">Select one</option>
                    {discoverySourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>
              <FormField id="cohort-message" label="Anything else we should know?" error={fieldErrors.message}>
                <textarea
                  id="cohort-message"
                  rows={5}
                  value={formData.message}
                  onChange={(event) => handleFieldChange('message', event.target.value)}
                />
              </FormField>
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
