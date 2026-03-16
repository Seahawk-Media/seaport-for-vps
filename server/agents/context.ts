import { db } from '../db/index';
import { agents } from '../db/schema/agents';
import { profiles } from '../db/schema/profiles';
import { departments } from '../db/schema/departments';
import { teams, teamMembers } from '../db/schema/teams';
import { measurables } from '../db/schema/operational';
import { eq } from 'drizzle-orm';

export async function getAgentContext(agentId: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!agent || !agent.organizationId) return null;

  const orgId = agent.organizationId;

  if (agent.tier === 'general') {
    const [depts, tms, emps, kpis] = await Promise.all([
      db.select().from(departments).where(eq(departments.organizationId, orgId)),
      db.select().from(teams).where(eq(teams.organizationId, orgId)),
      db.select().from(profiles).where(eq(profiles.organizationId, orgId)),
      db.select().from(measurables).where(eq(measurables.organizationId, orgId)),
    ]);
    return { scope: 'organization', departments: depts, teams: tms, employees: emps, measurables: kpis };
  }

  if (agent.tier === 'departmental' && agent.departmentId) {
    const [dept] = await db.select().from(departments).where(eq(departments.id, agent.departmentId));
    const tms = await db.select().from(teams).where(eq(teams.departmentId, agent.departmentId));
    const emps = await db.select().from(profiles).where(eq(profiles.departmentId, agent.departmentId));
    return { scope: 'department', department: dept, teams: tms, employees: emps };
  }

  if (agent.tier === 'functional' && agent.teamId) {
    const [team] = await db.select().from(teams).where(eq(teams.id, agent.teamId));
    const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, agent.teamId));
    return { scope: 'team', team, members };
  }

  return null;
}
