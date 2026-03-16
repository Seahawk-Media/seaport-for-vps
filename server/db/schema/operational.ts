import { pgTable, text, timestamp, uuid, date, numeric, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { departments } from './departments';
import { teams } from './teams';
import { profiles } from './profiles';

export const measurables = pgTable('measurables', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id),
  name: text('name').notNull(),
  description: text('description'),
  targetValue: numeric('target_value'),
  currentValue: numeric('current_value'),
  unit: text('unit'),
  ownerId: uuid('owner_id').references(() => profiles.id),
  frequency: text('frequency').default('weekly'),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const incentives = pgTable('incentives', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  incentiveType: text('incentive_type'),
  title: text('title'),
  description: text('description'),
  evidenceUrl: text('evidence_url'),
  points: integer('points').default(0),
  status: text('status').default('pending'),
  reviewedBy: uuid('reviewed_by').references(() => profiles.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const incentiveTypes = pgTable('incentive_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id'),
  name: text('name').notNull(),
  description: text('description'),
  defaultPoints: integer('default_points').default(10),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sops = pgTable('sops', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id'),
  departmentId: uuid('department_id').references(() => departments.id),
  teamId: uuid('team_id').references(() => teams.id),
  title: text('title').notNull(),
  content: text('content'),
  category: text('category'),
  version: text('version').default('1.0'),
  status: text('status').default('active'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id'),
  departmentId: uuid('department_id').references(() => departments.id),
  teamId: uuid('team_id').references(() => teams.id),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('todo'),
  priority: text('priority').default('medium'),
  dueDate: date('due_date'),
  assignedTo: uuid('assigned_to').references(() => profiles.id),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id'),
  departmentId: uuid('department_id').references(() => departments.id),
  teamId: uuid('team_id').references(() => teams.id),
  title: text('title').notNull(),
  description: text('description'),
  meetingUrl: text('meeting_url'),
  recurrence: text('recurrence'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tools = pgTable('tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id'),
  departmentId: uuid('department_id').references(() => departments.id),
  teamId: uuid('team_id').references(() => teams.id),
  name: text('name').notNull(),
  description: text('description'),
  url: text('url'),
  icon: text('icon'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const holidays = pgTable('holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  date: date('date').notNull(),
  description: text('description'),
  country: text('country'),
  isRecurring: boolean('is_recurring').default(false),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const coreValues = pgTable('core_values', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  organizationId: uuid('organization_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id'),
  profileId: uuid('profile_id'),
  title: text('title'),
  description: text('description'),
  status: text('status').default('pending'),
  priority: text('priority').default('medium'),
  adminNotes: text('admin_notes'),
  targetQuarter: text('target_quarter'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').references(() => profiles.id),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  activityType: text('activity_type'),
  description: text('description'),
  metadata: jsonb('metadata'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  pagePath: text('page_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
