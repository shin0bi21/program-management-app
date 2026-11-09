import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SignupSection from './SignupSection'

const mockSubmitPublicLead = vi.fn()

vi.mock('../../publicHomepage.api', () => ({
  submitPublicLead: (...args: unknown[]) => mockSubmitPublicLead(...args),
}))

describe('SignupSection', () => {
  beforeEach(() => {
    mockSubmitPublicLead.mockReset()
    mockSubmitPublicLead.mockResolvedValue({ message: 'ok' })
  })

  afterEach(() => vi.useRealTimers())

  it('submits the cohort form with a normalized payload', async () => {
    render(<SignupSection />)

    fireEvent.change(document.getElementById('cohort-youthFirstName')!, { target: { value: '  Jordan  ' } })
    fireEvent.change(document.getElementById('cohort-youthLastName')!, { target: { value: '  Test  ' } })
    fireEvent.change(document.getElementById('cohort-dateOfBirth')!, { target: { value: `${new Date().getFullYear() - 14}-01-01` } })
    fireEvent.change(document.getElementById('cohort-school')!, { target: { value: '  Westview  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Who is filling out this form?' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Youth' }))
    fireEvent.change(document.getElementById('cohort-contactPhoneNumber')!, { target: { value: '  519-555-0199  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Relationship' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Guardian' }))
    fireEvent.click(screen.getByRole('button', { name: 'How Did You Hear About Us?' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Online' }))
    fireEvent.change(document.getElementById('cohort-notes')!, { target: { value: '  Please follow up.  ' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(mockSubmitPublicLead).toHaveBeenCalledWith({
        youthFirstName: 'Jordan',
        youthLastName: 'Test',
        dateOfBirth: `${new Date().getFullYear() - 14}-01-01`,
        school: 'Westview',
        submittedByRole: 'youth',
        contactPhoneNumber: '519-555-0199',
        contactRelationship: 'guardian',
        discoverySource: 'online',
        notes: 'Please follow up.',
        website: '',
      })
    })
  })

  it('shows success feedback before mounting a fresh signup form', async () => {
    render(<SignupSection />)

    fireEvent.change(document.getElementById('cohort-youthFirstName')!, { target: { value: 'Jordan' } })
    fireEvent.change(document.getElementById('cohort-youthLastName')!, { target: { value: 'Test' } })
    fireEvent.change(document.getElementById('cohort-dateOfBirth')!, { target: { value: `${new Date().getFullYear() - 14}-01-01` } })
    fireEvent.change(document.getElementById('cohort-school')!, { target: { value: 'Westview' } })
    fireEvent.change(document.getElementById('cohort-contactPhoneNumber')!, { target: { value: '519-555-0199' } })
    fireEvent.click(screen.getByRole('button', { name: 'Who is filling out this form?' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Parent' }))
    fireEvent.click(screen.getByRole('button', { name: 'Relationship' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Parent' }))
    fireEvent.click(screen.getByRole('button', { name: 'How Did You Hear About Us?' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Online' }))
    vi.useFakeTimers()
    await act(async () => fireEvent.submit(screen.getByRole('button', { name: /submit/i }).closest('form')!))

    expect(mockSubmitPublicLead).toHaveBeenCalledOnce()

    expect(screen.getByText(/thank you for your submission/i)).toBeInTheDocument()
    expect(document.getElementById('cohort-youthFirstName')).toBeNull()
    act(() => vi.advanceTimersByTime(2500))
    expect(document.getElementById('cohort-youthFirstName')).toHaveValue('')
    expect(screen.queryByText(/thank you for your submission/i)).not.toBeInTheDocument()
  })

  it('requires the primary contact phone number', async () => {
    render(<SignupSection />)

    fireEvent.change(document.getElementById('cohort-youthFirstName')!, { target: { value: 'Jordan' } })
    fireEvent.change(document.getElementById('cohort-youthLastName')!, { target: { value: 'Test' } })
    fireEvent.change(document.getElementById('cohort-dateOfBirth')!, { target: { value: `${new Date().getFullYear() - 14}-01-01` } })
    fireEvent.change(document.getElementById('cohort-school')!, { target: { value: 'Westview' } })
    fireEvent.submit(screen.getByRole('button', { name: /submit/i }).closest('form')!)

    expect(await screen.findByText(/contact phone number is required/i)).toBeInTheDocument()
    expect(mockSubmitPublicLead).not.toHaveBeenCalled()
  })
})
