import type { CohortInterestPayload } from '../../api/homepage.api'

export type DiscoverySource = NonNullable<CohortInterestPayload['discoverySource']>

export type CohortInterestForm = {
  youthName: string
  parentName: string
  age: string
  school: string
  email: string
  phoneNumber: string
  discoverySource: DiscoverySource | ''
  message: string
}

export type CohortInterestErrors = Partial<Record<keyof CohortInterestForm, string>>

export const cohortInterestInitialState: CohortInterestForm = {
  youthName: '',
  parentName: '',
  age: '',
  school: '',
  email: '',
  phoneNumber: '',
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
