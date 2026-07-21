import Button from '../../../../common/components/Button/Button'
import FormField from '../../../../common/components/FormField/FormField'
import { useSignupSection } from './useSignupSection'
import { contactRelationshipOptions, discoverySourceOptions } from './signupSectionSchema'

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
              <p className="cohort-form-group-title">Youth Information</p>
              <div className="form-row">
                <FormField id="cohort-youthFirstName" label="Youth First Name" error={fieldErrors.youthFirstName}>
                  <input
                    id="cohort-youthFirstName"
                    value={formData.youthFirstName}
                    onChange={(event) => handleFieldChange('youthFirstName', event.target.value)}
                    autoComplete="given-name"
                    required
                  />
                </FormField>
                <FormField id="cohort-youthLastName" label="Youth Last Name" error={fieldErrors.youthLastName}>
                  <input
                    id="cohort-youthLastName"
                    value={formData.youthLastName}
                    onChange={(event) => handleFieldChange('youthLastName', event.target.value)}
                    autoComplete="family-name"
                    required
                  />
                </FormField>
              </div>
              <div className="form-row">
                <FormField id="cohort-age" label="Age" error={fieldErrors.age}>
                  <input
                    id="cohort-age"
                    type="number"
                    min="5"
                    max="24"
                    value={formData.age}
                    onChange={(event) => handleFieldChange('age', event.target.value)}
                    inputMode="numeric"
                    required
                  />
                </FormField>
                <FormField id="cohort-school" label="School" error={fieldErrors.school}>
                  <input
                    id="cohort-school"
                    value={formData.school}
                    onChange={(event) => handleFieldChange('school', event.target.value)}
                    required
                  />
                </FormField>
              </div>
              <p className="cohort-form-group-title">Primary Contact</p>
              <div className="form-row">
                <FormField id="cohort-contactFirstName" label="First Name" error={fieldErrors.contactFirstName}>
                  <input
                    id="cohort-contactFirstName"
                    value={formData.contactFirstName}
                    onChange={(event) => handleFieldChange('contactFirstName', event.target.value)}
                    autoComplete="off"
                    required
                  />
                </FormField>
                <FormField id="cohort-contactLastName" label="Last Name" error={fieldErrors.contactLastName}>
                  <input
                    id="cohort-contactLastName"
                    value={formData.contactLastName}
                    onChange={(event) => handleFieldChange('contactLastName', event.target.value)}
                    autoComplete="off"
                    required
                  />
                </FormField>
              </div>
              <div className="form-row">
                <FormField id="cohort-contactPhoneNumber" label="Phone Number" error={fieldErrors.contactPhoneNumber}>
                  <input
                    id="cohort-contactPhoneNumber"
                    value={formData.contactPhoneNumber}
                    onChange={(event) => handleFieldChange('contactPhoneNumber', event.target.value)}
                    inputMode="tel"
                    autoComplete="off"
                    required
                  />
                </FormField>
                <FormField id="cohort-contactRelationship" label="Relationship" error={fieldErrors.contactRelationship}>
                  <select
                    id="cohort-contactRelationship"
                    value={formData.contactRelationship}
                    onChange={(event) => handleFieldChange('contactRelationship', event.target.value)}
                    required
                  >
                    <option value="">Select one</option>
                    {contactRelationshipOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>
              <p className="cohort-form-group-title">Follow-up Information</p>
              <div className="form-row">
                <FormField id="cohort-discoverySource" label="How Did You Hear About Us?" error={fieldErrors.discoverySource}>
                  <select
                    id="cohort-discoverySource"
                    value={formData.discoverySource}
                    onChange={(event) => handleFieldChange('discoverySource', event.target.value)}
                    required
                  >
                    <option value="">Select one</option>
                    {discoverySourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>
              <p className="cohort-form-group-title">Notes <span>(optional)</span></p>
              <FormField id="cohort-notes" label="Anything else we should know?" error={fieldErrors.notes}>
                <textarea
                  id="cohort-notes"
                  rows={5}
                  value={formData.notes}
                  onChange={(event) => handleFieldChange('notes', event.target.value)}
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
