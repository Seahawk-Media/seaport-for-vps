import { pgTable, text, timestamp, uuid, date, numeric, boolean, integer, jsonb, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { profiles } from './profiles';
import { users } from './auth';

export const trailEvents = pgTable('trail_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  eventType: text('event_type'),
  title: text('title'),
  description: text('description'),
  eventDate: date('event_date'),
  metadata: jsonb('metadata'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const reviewTemplates = pgTable('review_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  criteria: jsonb('criteria').default([]),
  isDefault: boolean('is_default').default(false),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const performanceReviews = pgTable('performance_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => profiles.id),
  reviewerId: uuid('reviewer_id').notNull().references(() => profiles.id),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').references(() => reviewTemplates.id),
  reviewPeriodStart: date('review_period_start'),
  reviewPeriodEnd: date('review_period_end'),
  status: text('status').default('draft'),
  overallRating: numeric('overall_rating', { precision: 3, scale: 2 }),
  criteriaScores: jsonb('criteria_scores'),
  strengths: text('strengths'),
  areasForImprovement: text('areas_for_improvement'),
  goals: text('goals'),
  employeeComments: text('employee_comments'),
  reviewerComments: text('reviewer_comments'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const promotions = pgTable('promotions', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().unique().references(() => profiles.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  roleTitle: text('role_title'),
  salaryBand: text('salary_band'),
  nextReviewDate: date('next_review_date'),
  lastReviewDate: date('last_review_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const overtimeEntries = pgTable('overtime_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  hours: numeric('hours', { precision: 4, scale: 2 }).notNull(),
  description: text('description'),
  status: text('status').default('pending'),
  approvedBy: text('approved_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const timeOffRequests = pgTable('time_off_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  requestType: text('request_type'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  totalDays: numeric('total_days', { precision: 4, scale: 1 }),
  reason: text('reason'),
  status: text('status').default('pending'),
  reviewedBy: text('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const timeOffBalances = pgTable('time_off_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  leaveType: text('leave_type').notNull(),
  year: integer('year').notNull(),
  totalDays: numeric('total_days', { precision: 4, scale: 1 }).default('0'),
  usedDays: numeric('used_days', { precision: 4, scale: 1 }).default('0'),
  remainingDays: numeric('remaining_days', { precision: 4, scale: 1 }).generatedAlwaysAs(
    sql`(total_days - used_days)`
  ),
}, (t) => [
  unique().on(t.profileId, t.leaveType, t.year),
]);

export const timeOffTypes = pgTable('time_off_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id'),
  name: text('name').notNull(),
  description: text('description'),
  defaultDaysPerYear: numeric('default_days_per_year').default('0'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
