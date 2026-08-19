export interface HomepageImage {
  id: string;
  imageUrl: string;
  mobileUrl: string;
  thumbnailUrl: string;
  altText: string;
  caption: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface HomepageSession {
  id: string;
  cohortId: string;
  theme: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  cohortName: string;
  programId: string;
  programName: string;
  programDescription: string | null;
  rosterMode: 'enrolled' | 'open';
  minAge: number | null;
  maxAge: number | null;
  addedAt: string;
}
