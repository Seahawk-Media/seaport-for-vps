import { router } from './trpc';
import { setupRouter } from './routes/setup';
import { orgRouter } from './routes/org';
import { usersRouter } from './routes/users';
import { invitationsRouter } from './routes/invitations';
import { departmentsRouter } from './routes/departments';
import { teamsRouter } from './routes/teams';
import { teamMembersRouter } from './routes/team-members';
import { profilesRouter } from './routes/profiles';
import { positionsRouter } from './routes/positions';
import { agentsRouter } from './routes/agents';
import { agentChatRouter } from './routes/agent-chat';
import { reviewsRouter } from './routes/reviews';
import { promotionsRouter } from './routes/promotions';
import { measurablesRouter } from './routes/measurables';
import { incentivesRouter } from './routes/incentives';
import { academyRouter } from './routes/academy';
import { toolsRouter } from './routes/tools';
import { tasksRouter } from './routes/tasks';
import { meetingsRouter } from './routes/meetings';
import { sopsRouter } from './routes/sops';
import { calendarRouter } from './routes/calendar';
import { coreValuesRouter } from './routes/core-values';
import { timeOffRouter } from './routes/time-off';
import { overtimeRouter } from './routes/overtime';
import { feedbackRouter } from './routes/feedback';
import { activityRouter } from './routes/activity';
import { analyticsRouter } from './routes/analytics';
import { aiConfigRouter } from './routes/ai-config';
import { agentIdentityRouter } from './routes/agent-identity';

export const appRouter = router({
  setup: setupRouter,
  org: orgRouter,
  users: usersRouter,
  invitations: invitationsRouter,
  departments: departmentsRouter,
  teams: teamsRouter,
  teamMembers: teamMembersRouter,
  profiles: profilesRouter,
  positions: positionsRouter,
  agents: agentsRouter,
  agentChat: agentChatRouter,
  reviews: reviewsRouter,
  promotions: promotionsRouter,
  measurables: measurablesRouter,
  incentives: incentivesRouter,
  academy: academyRouter,
  tools: toolsRouter,
  tasks: tasksRouter,
  meetings: meetingsRouter,
  sops: sopsRouter,
  calendar: calendarRouter,
  coreValues: coreValuesRouter,
  timeOff: timeOffRouter,
  overtime: overtimeRouter,
  feedback: feedbackRouter,
  activity: activityRouter,
  analytics: analyticsRouter,
  aiConfig: aiConfigRouter,
  agentIdentity: agentIdentityRouter,
});

export type AppRouter = typeof appRouter;
