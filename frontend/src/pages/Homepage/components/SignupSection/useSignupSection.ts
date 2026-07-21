import { FormEvent, useEffect, useState } from 'react'
import { useSubmitStatus } from '../../../../common/hooks/useSubmitStatus'
import { ApiError, getErrorMessage } from '../../../../common/utils/clientErrors'
import { submitCohortInterest } from '../../api/homepage.api'
import {
  cohortInterestInitialState,
  type CohortInterestErrors,
  type CohortInterestForm,
  type ContactRelationship,
  type DiscoverySource,
} from './signupSectionSchema'

export function useSignupSection() {
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
    setError('')
    setFieldErrors({})

    const nextFieldErrors: CohortInterestErrors = {}
    if (!formData.youthFirstName.trim()) nextFieldErrors.youthFirstName = 'First name is required'
    if (!formData.youthLastName.trim()) nextFieldErrors.youthLastName = 'Last name is required'
    if (!formData.age) nextFieldErrors.age = 'Age is required'
    if (!formData.school.trim()) nextFieldErrors.school = 'School is required'
    if (!formData.discoverySource) nextFieldErrors.discoverySource = 'Please select a source'
    if (!formData.email.trim() && !formData.phoneNumber.trim()) {
      const responseError = 'Provide an email or phone number'
      nextFieldErrors.email = responseError
      nextFieldErrors.phoneNumber = responseError
    }

    if (!formData.contactFirstName.trim()) nextFieldErrors.contactFirstName = 'Contact first name is required'
    if (!formData.contactLastName.trim()) nextFieldErrors.contactLastName = 'Contact last name is required'
    if (!formData.contactPhoneNumber.trim()) nextFieldErrors.contactPhoneNumber = 'Contact phone number is required'
    if (!formData.contactRelationship) nextFieldErrors.contactRelationship = 'Relationship is required'

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors)
      return
    }

    setSubmitStatus('submitting')

    try {
      await submitCohortInterest({
        youthFirstName: formData.youthFirstName.trim(),
        youthLastName: formData.youthLastName.trim(),
        age: Number(formData.age),
        school: formData.school.trim(),
        email: formData.email.trim() || undefined,
        phoneNumber: formData.phoneNumber.trim() || undefined,
        contactFirstName: formData.contactFirstName.trim(),
        contactLastName: formData.contactLastName.trim(),
        contactPhoneNumber: formData.contactPhoneNumber.trim(),
        contactRelationship: formData.contactRelationship as ContactRelationship,
        discoverySource: formData.discoverySource as DiscoverySource,
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

  return {
    formData,
    fieldErrors,
    submitStatus,
    error,
    isFormLocked,
    handleFieldChange,
    handleInterestSubmit,
  }
}
