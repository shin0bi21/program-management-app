export const contactRelationships = ['parent', 'sibling', 'guardian'] as const;

export type ContactRelationship = typeof contactRelationships[number];
