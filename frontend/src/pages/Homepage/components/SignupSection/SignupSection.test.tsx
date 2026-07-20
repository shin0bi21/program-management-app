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

    fireEvent.change(document.getElementById('cohort-youthFirstName')!, { target: { value: '  Jordan  ' } })
    fireEvent.change(document.getElementById('cohort-youthLastName')!, { target: { value: '  Test  ' } })
    fireEvent.change(document.getElementById('cohort-age')!, { target: { value: '14' } })
    fireEvent.change(document.getElementById('cohort-school')!, { target: { value: '  Westview  ' } })
    fireEvent.change(document.getElementById('cohort-email')!, { target: { value: '  jordan@test.local  ' } })
    fireEvent.change(document.getElementById('cohort-phoneNumber')!, { target: { value: '  519-555-0100  ' } })
    fireEvent.change(document.getElementById('cohort-contactFirstName')!, { target: { value: '  Taylor  ' } })
    fireEvent.change(document.getElementById('cohort-contactLastName')!, { target: { value: '  Test  ' } })
    fireEvent.change(document.getElementById('cohort-contactPhoneNumber')!, { target: { value: '  519-555-0199  ' } })
    fireEvent.change(document.getElementById('cohort-contactRelationship')!, { target: { value: 'guardian' } })
    fireEvent.change(document.getElementById('cohort-discoverySource')!, { target: { value: 'online' } })
    fireEvent.change(document.getElementById('cohort-message')!, { target: { value: '  Please follow up.  ' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(mockSubmitCohortInterest).toHaveBeenCalledWith({
        youthFirstName: 'Jordan',
        youthLastName: 'Test',
        age: 14,
        school: 'Westview',
        email: 'jordan@test.local',
        phoneNumber: '519-555-0100',
        contactFirstName: 'Taylor',
        contactLastName: 'Test',
        contactPhoneNumber: '519-555-0199',
        contactRelationship: 'guardian',
        discoverySource: 'online',
        message: 'Please follow up.',
      })
    })
  })

  it('shows the success overlay and resets the form after a successful submit', async () => {
    render(<SignupSection />)

    fireEvent.change(document.getElementById('cohort-youthFirstName')!, { target: { value: 'Jordan' } })
    fireEvent.change(document.getElementById('cohort-youthLastName')!, { target: { value: 'Test' } })
    fireEvent.change(document.getElementById('cohort-age')!, { target: { value: '14' } })
    fireEvent.change(document.getElementById('cohort-school')!, { target: { value: 'Westview' } })
    fireEvent.change(document.getElementById('cohort-email')!, { target: { value: 'jordan@test.local' } })
    fireEvent.change(document.getElementById('cohort-contactFirstName')!, { target: { value: 'Taylor' } })
    fireEvent.change(document.getElementById('cohort-contactLastName')!, { target: { value: 'Test' } })
    fireEvent.change(document.getElementById('cohort-contactPhoneNumber')!, { target: { value: '519-555-0199' } })
    fireEvent.change(document.getElementById('cohort-contactRelationship')!, { target: { value: 'guardian' } })
    fireEvent.change(document.getElementById('cohort-discoverySource')!, { target: { value: 'online' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(mockSubmitCohortInterest).toHaveBeenCalled()
    })

    expect(screen.getByText(/thank you for your submission/i)).toBeInTheDocument()
    expect((document.getElementById('cohort-youthFirstName') as HTMLInputElement).value).toBe('')
  })

  it('maps backend validation details to email and phone field errors', async () => {
    mockSubmitCohortInterest.mockRejectedValue(
      new ApiError(400, 'Validation failed', [
        { field: 'body.email', message: 'Provide an email or phone number' },
        { field: 'body.phoneNumber', message: 'Provide an email or phone number' },
      ]),
    )

    render(<SignupSection />)

    fireEvent.change(document.getElementById('cohort-youthFirstName')!, { target: { value: 'Jordan' } })
    fireEvent.change(document.getElementById('cohort-youthLastName')!, { target: { value: 'Test' } })
    fireEvent.change(document.getElementById('cohort-age')!, { target: { value: '14' } })
    fireEvent.change(document.getElementById('cohort-school')!, { target: { value: 'Westview' } })
    fireEvent.change(document.getElementById('cohort-discoverySource')!, { target: { value: 'online' } })
    fireEvent.submit(screen.getByRole('button', { name: /submit/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getAllByText(/provide an email or phone number/i).length).toBeGreaterThan(0)
    })
  })

  it('requires every primary contact field', async () => {
    render(<SignupSection />)

    fireEvent.change(document.getElementById('cohort-youthFirstName')!, { target: { value: 'Jordan' } })
    fireEvent.change(document.getElementById('cohort-youthLastName')!, { target: { value: 'Test' } })
    fireEvent.change(document.getElementById('cohort-age')!, { target: { value: '14' } })
    fireEvent.change(document.getElementById('cohort-school')!, { target: { value: 'Westview' } })
    fireEvent.change(document.getElementById('cohort-email')!, { target: { value: 'jordan@test.local' } })
    fireEvent.change(document.getElementById('cohort-discoverySource')!, { target: { value: 'online' } })
    fireEvent.submit(screen.getByRole('button', { name: /submit/i }).closest('form')!)

    expect(await screen.findByText(/contact first name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/contact last name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/contact phone number is required/i)).toBeInTheDocument()
    expect(screen.getByText(/relationship is required/i)).toBeInTheDocument()
    expect(mockSubmitCohortInterest).not.toHaveBeenCalled()
  })
})
