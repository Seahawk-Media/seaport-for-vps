import { db } from '../db/index';
import { agentToolConnections } from '../db/schema/agents';
import { eq } from 'drizzle-orm';

export async function getAgentTools(agentId: string) {
  return db.select().from(agentToolConnections).where(eq(agentToolConnections.agentId, agentId));
}
