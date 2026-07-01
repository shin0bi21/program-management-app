import { FormEvent, useEffect, useState } from 'react'
import Button from '../../../common/components/Button/Button'
import FormField from '../../../common/components/FormField/FormField'
import { useSubmitStatus } from '../../../common/hooks/useSubmitStatus'
import { ApiError, getErrorMessage } from '../../../common/utils/clientErrors'
import { submitCohortInterest, type CohortInterestPayload } from '../api/homepage.api'

type DiscoverySource = NonNullable<CohortInterestPayload['discoverySource']>

type CohortInterestForm = {
  youthName: string
  parentName: string
  age: string
  school: string
  email: string
  phoneNumber: string
  discoverySource: DiscoverySource | ''
  message: string
}

type CohortInterestErrors = Partial<Record<keyof CohortInterestForm, string>>

const cohortInterestInitialState: CohortInterestForm = {
  youthName: '',
  parentName: '',
  age: '',
  school: '',
  email: '',
  phoneNumber: '',
  discoverySource: '',
  message: '',
}

const discoverySourceOptions: { value: DiscoverySource; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'friend_family', label: 'Friend / Family' },
  { value: 'school', label: 'School' },
  { value: 'community_outreach', label: 'Community Outreach' },
  { value: 'other', label: 'Other' },
]

export default function SignupSection() {
  const [formData, setFormData] = useState<CohortInterestForm>(cohortInterestInitialState)
  const [fieldErrors, setFieldErrors] = useState<CohortInterestErrors>({})
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus()
  const isFormLocked = submitStatus === 'submitting' || submitStatus === 'success'

  useEffect(() => {
    if (submitStatus !== 'success') return

    const timeoutId = window.setTimeout(() => {
      resetStatus()
    }, 2500)

    return () => window.clearTimeout(timeoutId)
  }, [submitStatus, resetStatus])

  const handleFieldChange = (field: keyof CohortInterestForm, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  const handleInterestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitStatus('submitting')
    setError('')
    setFieldErrors({})

    try {
      await submitCohortInterest({
        youthName: formData.youthName,
        parentName: formData.parentName.trim() || undefined,
        age: Number(formData.age),
        school: formData.school.trim() || undefined,
        email: formData.email.trim() || undefined,
        phoneNumber: formData.phoneNumber.trim() || undefined,
        discoverySource: formData.discoverySource || undefined,
        message: formData.message.trim() || undefined,
      })
      setFormData(cohortInterestInitialState)
      setFieldErrors({})
      setSubmitStatus('success')
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        const nextFieldErrors: CohortInterestErrors = {}
        for (const detail of err.details) {
          const field = detail.field.replace(/^body\./, '') as keyof CohortInterestForm
          nextFieldErrors[field] = detail.message
        }
        setFieldErrors(nextFieldErrors)
      }
      setSubmitStatus('error')
      setError(getErrorMessage(err, 'Unable to submit the form right now.'))
    }
  }

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
