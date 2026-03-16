import { pgTable, text, timestamp, uuid, boolean, unique } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { appRoleEnum } from './enums';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdBy: text('created_by').references(() => users.id),
  primaryColor: text('primary_color'),
  accentColor: text('accent_color'),
  logoUrl: text('logo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: appRoleEnum('role').notNull(),
  assignedBy: text('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique().on(t.userId, t.role),
]);

export const roleAuditLog = pgTable('role_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id'),
  role: appRoleEnum('role'),
  action: text('action'),
  performedBy: text('performed_by'),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),
});

export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: appRoleEnum('role').default('employee').notNull(),
  token: text('token').notNull().unique(),
  invitedBy: text('invited_by').references(() => users.id),
  accepted: boolean('accepted').default(false).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique().on(t.organizationId, t.email),
]);
