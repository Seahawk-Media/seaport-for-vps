import { pgTable, text, timestamp, uuid, integer, unique } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { courseStatusEnum } from './enums';

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id'),
  title: text('title').notNull(),
  description: text('description'),
  status: courseStatusEnum('status').default('draft'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const coursePages = pgTable('course_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id'),
  title: text('title'),
  content: text('content'),
  pageOrder: integer('page_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const courseProgress = pgTable('course_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  profileId: uuid('profile_id'),
  organizationId: uuid('organization_id'),
  currentPageOrder: integer('current_page_order').default(0),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique().on(t.courseId, t.profileId),
]);
