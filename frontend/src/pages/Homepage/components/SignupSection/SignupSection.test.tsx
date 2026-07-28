import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SignupSection from './SignupSection'

const mockSubmitExpressionOfInterest = vi.fn()

vi.mock('../../api/homepage.api', () => ({
  submitExpressionOfInterest: (...args: unknown[]) => mockSubmitExpressionOfInterest(...args),
}))

describe('SignupSection', () => {
  beforeEach(() => {
    mockSubmitExpressionOfInterest.mockReset()
    mockSubmitExpressionOfInterest.mockResolvedValue({ message: 'ok' })
  })

  it('organizes the shared data shape into form sections without duplicate response fields', () => {
    render(<SignupSection />)

    expect(screen.getByText('Youth Information')).toBeInTheDocument()
    expect(screen.getByText('Primary Contact')).toBeInTheDocument()
    expect(screen.queryByText('Follow-up Information')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /notes/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Emergency Contact' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    expect(document.getElementById('cohort-phoneNumber')).not.toBeInTheDocument()
  })

  it('submits the cohort form with a normalized payload', async () => {
    render(<SignupSection />)

    fireEvent.change(document.getElementById('cohort-youthFirstName')!, { target: { value: '  Jordan  ' } })
    fireEvent.change(document.getElementById('cohort-youthLastName')!, { target: { value: '  Test  ' } })
    fireEvent.change(document.getElementById('cohort-age')!, { target: { value: '14' } })
    fireEvent.change(document.getElementById('cohort-school')!, { target: { value: '  Westview  ' } })
    fireEvent.change(document.getElementById('cohort-contactPhoneNumber')!, { target: { value: '  519-555-0199  ' } })
    fireEvent.change(document.getElementById('cohort-contactRelationship')!, { target: { value: 'guardian' } })
    fireEvent.change(document.getElementById('cohort-discoverySource')!, { target: { value: 'online' } })
    fireEvent.change(document.getElementById('cohort-notes')!, { target: { value: '  Please follow up.  ' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(mockSubmitExpressionOfInterest).toHaveBeenCalledWith({
        youthFirstName: 'Jordan',
        youthLastName: 'Test',
        age: 14,
        school: 'Westview',
        contactPhoneNumber: '519-555-0199',
        contactRelationship: 'guardian',
        discoverySource: 'online',
        notes: 'Please follow up.',
      })
    })
  })

  it('shows the success overlay and resets the form after a successful submit', async () => {
    render(<SignupSection />)

    fireEvent.change(document.getElementById('cohort-youthFirstName')!, { target: { value: 'Jordan' } })
    fireEvent.change(document.getElementById('cohort-youthLastName')!, { target: { value: 'Test' } })
    fireEvent.change(document.getElementById('cohort-age')!, { target: { value: '14' } })
    fireEvent.change(document.getElementById('cohort-school')!, { target: { value: 'Westview' } })
    fireEvent.change(document.getElementById('cohort-contactPhoneNumber')!, { target: { value: '519-555-0199' } })
    fireEvent.change(document.getElementById('cohort-contactRelationship')!, { target: { value: 'guardian' } })
    fireEvent.change(document.getElementById('cohort-discoverySource')!, { target: { value: 'online' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(mockSubmitExpressionOfInterest).toHaveBeenCalled()
    })

    expect(screen.getByText(/thank you for your submission/i)).toBeInTheDocument()
    expect((document.getElementById('cohort-youthFirstName') as HTMLInputElement).value).toBe('')
  })

  it('requires the primary contact phone number', async () => {
    render(<SignupSection />)

    fireEvent.change(document.getElementById('cohort-youthFirstName')!, { target: { value: 'Jordan' } })
    fireEvent.change(document.getElementById('cohort-youthLastName')!, { target: { value: 'Test' } })
    fireEvent.change(document.getElementById('cohort-age')!, { target: { value: '14' } })
    fireEvent.change(document.getElementById('cohort-school')!, { target: { value: 'Westview' } })
    fireEvent.change(document.getElementById('cohort-discoverySource')!, { target: { value: 'online' } })
    fireEvent.submit(screen.getByRole('button', { name: /submit/i }).closest('form')!)

    expect(await screen.findByText(/contact phone number is required/i)).toBeInTheDocument()
    expect(mockSubmitExpressionOfInterest).not.toHaveBeenCalled()
  })
})
