export type Gender = 'male' | 'female' | 'other';

export type RelationshipType =
  | 'father' | 'mother' | 'spouse' | 'son' | 'daughter'
  | 'brother' | 'sister' | 'grandfather' | 'grandmother' | 'child';

export interface CustomField {
  key: string;
  value: string;
}

export interface FamilyMember {
  id: string;
  groupId: string;             // which group this member belongs to
  name: string;
  age: number | null;
  dob: string | null;          // date of birth in ISO format (YYYY-MM-DD)
  gender: Gender;
  photo: string | null;
  notes: string;
  customFields: CustomField[];
  generation: number;
  spouseId: string | null;
  parentIds: string[];
  childIds: string[];
  siblingIds: string[];
  x: number;
  y: number;
}

export interface FamilyLink {
  id: string;
  fromId: string;
  toId: string;
  type: RelationshipType;
  crossGroup?: boolean;        // true when connecting members from different groups
}

export interface FamilyGroup {
  id: string;
  name: string;
  color: string;               // accent color for the group
}

export interface FamilyTree {
  groups: FamilyGroup[];
  members: FamilyMember[];
  links: FamilyLink[];
  activeGroupId: string;
}

export interface PdfOptions {
  includePhoto: boolean;
  includeAge: boolean;
  includeGender: boolean;
  includeRelationship: boolean;
  includeSpouse: boolean;
  includeParents: boolean;
  includeChildren: boolean;
  includeNotes: boolean;
  includeCustomFields: boolean;
  exportMode: 'full' | 'ancestors' | 'descendants';
  exportGroupId: 'all' | string;
  layoutExport: boolean;
  reportExport: boolean;
}

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  'father','mother','spouse','son','daughter',
  'brother','sister','grandfather','grandmother','child'
];

export const GROUP_COLORS = [
  '#6f42c1','#0d6efd','#198754','#0d9488','#fd7e14','#dc3545','#e91e63','#795548'
];

export const DEFAULT_PDF_OPTIONS: PdfOptions = {
  includePhoto: true, includeAge: true, includeGender: true,
  includeRelationship: true, includeSpouse: true, includeParents: true,
  includeChildren: true, includeNotes: true, includeCustomFields: true,
  exportMode: 'full', exportGroupId: 'all', layoutExport: true, reportExport: true
};
