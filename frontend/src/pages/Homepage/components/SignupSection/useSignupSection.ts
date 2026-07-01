import { FormEvent, useEffect, useState } from 'react'
import { useSubmitStatus } from '../../../../common/hooks/useSubmitStatus'
import { ApiError, getErrorMessage } from '../../../../common/utils/clientErrors'
import { submitCohortInterest } from '../../api/homepage.api'
import {
  cohortInterestInitialState,
  type CohortInterestErrors,
  type CohortInterestForm,
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
