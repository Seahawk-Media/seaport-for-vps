import { pgTable, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { departments } from './departments';
import { profiles } from './profiles';

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  departmentId: uuid('department_id').references(() => departments.id),
  name: text('name').notNull(),
  description: text('description'),
  teamType: text('team_type').default('project'),
  teamLeadId: uuid('team_lead_id').references(() => profiles.id),
  slackChannel: text('slack_channel'),
  components: text('components'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  role: text('role').default('member'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique().on(t.teamId, t.profileId),
]);
