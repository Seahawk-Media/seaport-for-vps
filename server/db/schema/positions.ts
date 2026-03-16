import { pgTable, text, timestamp, uuid, date } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { profiles } from './profiles';
import { departments } from './departments';
import { users } from './auth';

export const positionRoles = pgTable('position_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const positionChanges = pgTable('position_changes', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  previousPositionId: uuid('previous_position_id').references(() => positionRoles.id),
  newPositionId: uuid('new_position_id').references(() => positionRoles.id),
  previousDepartmentId: uuid('previous_department_id').references(() => departments.id),
  newDepartmentId: uuid('new_department_id').references(() => departments.id),
  effectiveDate: date('effective_date'),
  notes: text('notes'),
  approvedBy: text('approved_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
