import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Crown, Info, Target, Wrench, CalendarDays, FileText, MessageSquare, Bot, ListTodo } from "lucide-react";
import { trpc } from '@/lib/trpc';
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ToolsTab } from "@/components/workspace/tabs/ToolsTab";
import { MeetingsTab } from "@/components/workspace/tabs/MeetingsTab";
import { SOPsTab } from "@/components/workspace/tabs/SOPsTab";
import { TasksTab } from "@/components/workspace/tabs/TasksTab";
import { ChatTab } from "@/components/workspace/tabs/ChatTab";
import { AgentsTab } from "@/components/workspace/tabs/AgentsTab";
import { FunctionGeneralInfo } from "@/components/function/FunctionGeneralInfo";
import { MeasurablesTab } from "@/components/workspace/tabs/MeasurablesTab";

interface Team {
  id: string;
  name: string;
  description: string | null;
  teamType: string | null;
  teamLeadId: string | null;
  slackChannel?: string | null;
  departmentId?: string | null;
  components?: string | null;
}

interface Profile {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string | null;
  jobTitle: string | null;
}

interface TeamMember extends Profile {
  role: string;
}

type FunctionTab = 'general' | 'measurables' | 'tools' | 'meetings' | 'sops' | 'tasks' | 'chat' | 'agents';

export const TeamPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FunctionTab>('general');
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin } = useRole();
  const { user, loading: authLoading } = useAuth();
  const { organization, loading: orgLoading } = useOrganization();

  React.useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const { data: teamData, isLoading: teamLoading, refetch: refetchTeam } = trpc.teams.get.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const { data: teamLeadData } = trpc.profiles.get.useQuery(
    { id: teamData?.teamLeadId! },
    { enabled: !!teamData?.teamLeadId }
  );

  const { data: teamMembersData } = trpc.teamMembers.list.useQuery(
    { teamId: id! },
    { enabled: !!id }
  );

  const team: Team | null = teamData ? {
    id: teamData.id,
    name: teamData.name,
    description: teamData.description ?? null,
    teamType: teamData.teamType ?? null,
    teamLeadId: teamData.teamLeadId ?? null,
    slackChannel: teamData.slackChannel ?? null,
    departmentId: teamData.departmentId ?? null,
    components: teamData.components ?? null,
  } : null;

  const teamLead: Profile | null = teamLeadData ? {
    id: teamLeadData.id,
    fullName: teamLeadData.fullName || '',
    avatarUrl: teamLeadData.avatarUrl ?? null,
    email: teamLeadData.email ?? null,
    jobTitle: teamLeadData.jobTitle ?? null,
  } : null;

  const members: TeamMember[] = (teamMembersData || []).map((m: any) => ({
    id: m.id,
    fullName: m.fullName || '',
    avatarUrl: m.avatarUrl ?? null,
    email: m.email ?? null,
    jobTitle: m.jobTitle ?? null,
    role: m.role || 'member',
  }));

  const loading = teamLoading;

  const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';

  if (authLoading || orgLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading function...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <DashboardLayout viewMode="functions" title="Function Not Found">
        <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
          <p className="text-muted-foreground">Function not found</p>
          <Button variant="outline" onClick={() => navigate('/functions')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Functions
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <FunctionGeneralInfo
            teamId={id!}
            team={team}
            teamLead={teamLead}
            memberCount={members.length}
            onUpdate={() => refetchTeam()}
          />
        );
      case 'measurables':
        return <MeasurablesTab teamId={id} />;
      case 'tools':
        return <ToolsTab teamId={id} />;
      case 'meetings':
        return <MeetingsTab teamId={id} />;
      case 'sops':
        return <SOPsTab teamId={id} />;
      case 'tasks':
        return <TasksTab teamId={id} />;
      case 'chat':
        return <ChatTab teamId={id} />;
      case 'agents':
        return <AgentsTab functionId={id} />;
      default:
        return null;
    }
  };

  const headerContent = (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="sm" onClick={() => navigate('/functions')} className="h-7 w-7 p-0">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2">
        <div className="rounded bg-primary p-1.5">
          <Users className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold leading-tight">{team.name}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{members.length} members</span>
            {teamLead && (
              <div className="flex items-center gap-1">
                <span>·</span>
                <Avatar className="h-4 w-4">
                  <AvatarImage src={teamLead.avatarUrl || ''} />
                  <AvatarFallback className="text-[10px]">{getInitials(teamLead.fullName)}</AvatarFallback>
                </Avatar>
                <span>{teamLead.fullName}</span>
                <Crown className="h-3 w-3 text-yellow-500" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout
      viewMode="functions"
      headerContent={headerContent}
    >
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FunctionTab)}>
        <TabsList className="w-full justify-start h-auto flex-wrap gap-1 bg-transparent p-0 border-b rounded-none mb-6">
          <TabsTrigger value="general" className="data-[state=active]:bg-background rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary">
            <Info className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="measurables" className="data-[state=active]:bg-background rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary">
            <Target className="h-4 w-4 mr-2" />
            Measurables
          </TabsTrigger>
          <TabsTrigger value="tools" className="data-[state=active]:bg-background rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary">
            <Wrench className="h-4 w-4 mr-2" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="meetings" className="data-[state=active]:bg-background rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary">
            <CalendarDays className="h-4 w-4 mr-2" />
            Meetings
          </TabsTrigger>
          <TabsTrigger value="sops" className="data-[state=active]:bg-background rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary">
            <FileText className="h-4 w-4 mr-2" />
            SOPs
          </TabsTrigger>
          <TabsTrigger value="tasks" className="data-[state=active]:bg-background rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary">
            <ListTodo className="h-4 w-4 mr-2" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="chat" className="data-[state=active]:bg-background rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary">
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="agents" className="data-[state=active]:bg-background rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary">
            <Bot className="h-4 w-4 mr-2" />
            Agents
          </TabsTrigger>
        </TabsList>

        {renderTabContent()}
      </Tabs>
    </DashboardLayout>
  );
};

export default TeamPage;
