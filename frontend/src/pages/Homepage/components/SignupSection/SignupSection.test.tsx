import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../common/utils/clientErrors'
import SignupSection from './SignupSection'

const mockSubmitCohortInterest = vi.fn()

vi.mock('../../api/homepage.api', () => ({
  submitCohortInterest: (...args: unknown[]) => mockSubmitCohortInterest(...args),
}))

describe('SignupSection', () => {
  beforeEach(() => {
    mockSubmitCohortInterest.mockReset()
    mockSubmitCohortInterest.mockResolvedValue({ message: 'ok' })
  })

  it('submits the cohort form with a normalized payload', async () => {
    render(<SignupSection />)

    fireEvent.change(document.getElementById('cohort-youthName')!, { target: { value: 'Jordan Test' } })
    fireEvent.change(document.getElementById('cohort-parentName')!, { target: { value: '  Taylor Test  ' } })
    fireEvent.change(document.getElementById('cohort-age')!, { target: { value: '14' } })
    fireEvent.change(document.getElementById('cohort-school')!, { target: { value: '  Westview  ' } })
    fireEvent.change(document.getElementById('cohort-email')!, { target: { value: '  jordan@test.local  ' } })
    fireEvent.change(document.getElementById('cohort-phoneNumber')!, { target: { value: '  519-555-0100  ' } })
    fireEvent.change(document.getElementById('cohort-discoverySource')!, { target: { value: 'online' } })
    fireEvent.change(document.getElementById('cohort-message')!, { target: { value: '  Please follow up.  ' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(mockSubmitCohortInterest).toHaveBeenCalledWith({
        youthName: 'Jordan Test',
        parentName: 'Taylor Test',
        age: 14,
        school: 'Westview',
        email: 'jordan@test.local',
        phoneNumber: '519-555-0100',
        discoverySource: 'online',
        message: 'Please follow up.',
      })
    })
  })

  it('shows the success overlay and resets the form after a successful submit', async () => {
    render(<SignupSection />)

    fireEvent.change(document.getElementById('cohort-youthName')!, { target: { value: 'Jordan Test' } })
    fireEvent.change(document.getElementById('cohort-age')!, { target: { value: '14' } })
    fireEvent.change(document.getElementById('cohort-email')!, { target: { value: 'jordan@test.local' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(mockSubmitCohortInterest).toHaveBeenCalled()
    })

    expect(screen.getByText(/thank you for your submission/i)).toBeInTheDocument()
    expect((document.getElementById('cohort-youthName') as HTMLInputElement).value).toBe('')
  })

  it('maps backend validation details to email and phone field errors', async () => {
    mockSubmitCohortInterest.mockRejectedValue(
      new ApiError(400, 'Validation failed', [
        { field: 'body.email', message: 'Provide an email or phone number' },
        { field: 'body.phoneNumber', message: 'Provide an email or phone number' },
      ]),
    )

    render(<SignupSection />)

    fireEvent.change(document.getElementById('cohort-youthName')!, { target: { value: 'Jordan Test' } })
    fireEvent.change(document.getElementById('cohort-age')!, { target: { value: '14' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(screen.getAllByText(/provide an email or phone number/i).length).toBeGreaterThan(0)
    })
  })
})
