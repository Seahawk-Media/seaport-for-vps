import { db } from './index';
import { positionRoles, departments } from './schema/index';
import { reviewTemplates } from './schema/hr';

export async function seedDefaults(organizationId: string, tx?: typeof db) {
  const conn = tx || db;

  // Default position roles
  const defaultPositions = [
    'CEO', 'CTO', 'CFO', 'VP', 'Director', 'Manager',
    'Senior Developer', 'Developer', 'Junior Developer',
    'Designer', 'Analyst', 'HR Manager', 'Recruiter',
  ];

  await conn.insert(positionRoles).values(
    defaultPositions.map((title) => ({ organizationId, title }))
  );

  // Default departments
  const deptNames = ['Sales', 'Marketing', 'Operations', 'Legal', 'Finance', 'HR'];
  await conn.insert(departments).values(
    deptNames.map((name) => ({ organizationId, name }))
  );

  // Default review template
  await conn.insert(reviewTemplates).values({
    organizationId,
    name: 'Standard Performance Review',
    description: 'Default performance review template with 13 criteria',
    isDefault: true,
    criteria: [
      { name: 'Job Knowledge', weight: 1 },
      { name: 'Quality of Work', weight: 1 },
      { name: 'Productivity', weight: 1 },
      { name: 'Dependability', weight: 1 },
      { name: 'Attendance', weight: 1 },
      { name: 'Initiative', weight: 1 },
      { name: 'Communication', weight: 1 },
      { name: 'Teamwork', weight: 1 },
      { name: 'Problem Solving', weight: 1 },
      { name: 'Leadership', weight: 1 },
      { name: 'Adaptability', weight: 1 },
      { name: 'Customer Focus', weight: 1 },
      { name: 'Professional Development', weight: 1 },
    ],
  });
}
