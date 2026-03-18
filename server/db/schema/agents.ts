import { pgTable, text, timestamp, uuid, boolean, integer, jsonb, unique } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { departments } from './departments';
import { teams } from './teams';
import { users } from './auth';
import { tools } from './operational';
import { agentTierEnum, conversationStatusEnum, messageRoleEnum, connectionTypeEnum } from './enums';

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id'),
  departmentId: uuid('department_id').references(() => departments.id),
  teamId: uuid('team_id').references(() => teams.id),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type'),
  tier: agentTierEnum('tier').default('functional'),
  systemPrompt: text('system_prompt'),
  aiProvider: text('ai_provider'),
  aiModel: text('ai_model'),
  config: jsonb('config').default({}),
  openclawAgentId: text('openclaw_agent_id'),
  tools: jsonb('tools').default([]),
  channelConfig: jsonb('channel_config').default({}),
  memoryConfig: jsonb('memory_config').default({}),
  alwaysOn: boolean('always_on').default(true),
  status: text('status').default('inactive'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const agentConversations = pgTable('agent_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  status: conversationStatusEnum('status').default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const agentMessages = pgTable('agent_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => agentConversations.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  content: text('content'),
  metadata: jsonb('metadata').default({}),
  tokenCount: integer('token_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const agentToolConnections = pgTable('agent_tool_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  toolId: uuid('tool_id').notNull().references(() => tools.id, { onDelete: 'cascade' }),
  connectionType: connectionTypeEnum('connection_type').notNull(),
  credentialsEncrypted: text('credentials_encrypted'),
  config: jsonb('config').default({}),
  organizationId: uuid('organization_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Agent Memory — OpenClaw-style persistent memory (MEMORY.md equivalent)
export const agentMemories = pgTable('agent_memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  category: text('category').default('general'), // 'fact', 'preference', 'context', 'general'
  content: text('content').notNull(),
  source: text('source'), // 'conversation', 'manual', 'system'
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Agent Identity — SOUL.md equivalent
export const agentIdentity = pgTable('agent_identity', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }).unique(),
  personality: text('personality'), // SOUL.md personality section
  communicationStyle: text('communication_style'), // tone, formality
  values: text('values'), // what the agent cares about
  guardrails: text('guardrails'), // what the agent must NOT do
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orgAiConfig = pgTable('org_ai_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  apiKeyEncrypted: text('api_key_encrypted'),
  apiKeyHint: text('api_key_hint'),
  isEnabled: boolean('is_enabled').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique().on(t.organizationId, t.provider),
]);
