import { db } from '../db/index';
import { agents } from '../db/schema/agents';
import { eq } from 'drizzle-orm';

// Agent runtime stub — will be expanded with actual AI provider integration
export class AgentRuntime {
  private activeAgents = new Map<string, { name: string; status: string }>();

  async loadAgents(orgId: string) {
    const orgAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.organizationId, orgId));

    for (const agent of orgAgents) {
      if (agent.alwaysOn && agent.status === 'active') {
        this.activeAgents.set(agent.id, { name: agent.name, status: 'running' });
      }
    }
  }

  getStatus(agentId: string) {
    return this.activeAgents.get(agentId) ?? null;
  }

  async processMessage(agentId: string, message: string, _context: unknown): Promise<string> {
    // Stub — integrate with AI provider (Anthropic, OpenAI, etc.) via org_ai_config
    return `[Agent ${agentId}] AI provider integration pending. Message received: "${message.slice(0, 50)}..."`;
  }
}

export const agentRuntime = new AgentRuntime();
