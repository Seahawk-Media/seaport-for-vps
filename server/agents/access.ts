import { db } from '../db/index';
import { agents } from '../db/schema/agents';
import { profiles } from '../db/schema/profiles';
import { teamMembers } from '../db/schema/teams';
import { eq, and } from 'drizzle-orm';

export async function canAccessAgent(userId: string, agentId: string): Promise<boolean> {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent) return false;

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) return false;

  // Must be in same org
  if (agent.organizationId !== profile.organizationId) return false;

  if (agent.tier === 'general') return true;

  if (agent.tier === 'departmental') {
    return agent.departmentId === profile.departmentId;
  }

  if (agent.tier === 'functional') {
    if (!agent.teamId) return false;
    const [membership] = await db.select().from(teamMembers)
      .where(and(eq(teamMembers.profileId, profile.id), eq(teamMembers.teamId, agent.teamId)))
      .limit(1);
    return !!membership;
  }

  return false;
}
