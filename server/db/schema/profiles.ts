import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { organizations } from './organizations';

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  fullName: text('full_name'),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  jobTitle: text('job_title'),
  phone: text('phone'),
  location: text('location'),
  managerId: uuid('manager_id'),
  departmentId: uuid('department_id'),
  positionId: uuid('position_id'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
