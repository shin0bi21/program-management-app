import type { CohortInterestPayload } from '../../api/homepage.api'

export type DiscoverySource = NonNullable<CohortInterestPayload['discoverySource']>
export type ContactRelationship = NonNullable<CohortInterestPayload['contactRelationship']>

export type CohortInterestForm = {
  youthFirstName: string
  youthLastName: string
  age: string
  school: string
  email: string
  phoneNumber: string
  contactFirstName: string
  contactLastName: string
  contactPhoneNumber: string
  contactRelationship: ContactRelationship | ''
  discoverySource: DiscoverySource | ''
  message: string
}

export type CohortInterestErrors = Partial<Record<keyof CohortInterestForm, string>>

export const cohortInterestInitialState: CohortInterestForm = {
  youthFirstName: '',
  youthLastName: '',
  age: '',
  school: '',
  email: '',
  phoneNumber: '',
  contactFirstName: '',
  contactLastName: '',
  contactPhoneNumber: '',
  contactRelationship: '',
  discoverySource: '',
  message: '',
}

export const discoverySourceOptions: { value: DiscoverySource; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'friend_family', label: 'Friend / Family' },
  { value: 'school', label: 'School' },
  { value: 'community_outreach', label: 'Community Outreach' },
  { value: 'other', label: 'Other' },
]

export const contactRelationshipOptions: { value: ContactRelationship; label: string }[] = [
  { value: 'parent', label: 'Parent' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'sibling', label: 'Sibling' },
]
