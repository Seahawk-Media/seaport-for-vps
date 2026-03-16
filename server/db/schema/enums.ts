import { pgEnum } from 'drizzle-orm/pg-core';

export const appRoleEnum = pgEnum('app_role', [
  'super_admin',
  'admin',
  'manager',
  'employee',
]);

export const agentTierEnum = pgEnum('agent_tier', [
  'general',
  'departmental',
  'functional',
]);

export const courseStatusEnum = pgEnum('course_status', [
  'draft',
  'published',
  'archived',
]);

export const conversationStatusEnum = pgEnum('conversation_status', [
  'active',
  'archived',
]);

export const messageRoleEnum = pgEnum('message_role', [
  'user',
  'assistant',
  'system',
  'tool',
]);

export const connectionTypeEnum = pgEnum('connection_type', [
  'api_key',
  'mcp',
  'cli',
  'oauth',
]);
