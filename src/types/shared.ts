// Shared entity types used across multiple components
// These match the Drizzle schema field names (camelCase)

export interface Department {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  headId: string | null;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  departmentId: string | null;
  teamType: string;
  teamLeadId: string | null;
}

export interface PositionRole {
  id: string;
  title: string;
  description: string | null;
}

export interface ProfileSummary {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  status: string | null;
  departmentId: string | null;
  positionId: string | null;
  managerId: string | null;
  location: string | null;
}
