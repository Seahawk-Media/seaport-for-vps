import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Crown, Info, Target, Wrench, CalendarDays, FileText, MessageSquare, Bot, ListTodo } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  team_type: string | null;
  team_lead_id: string | null;
  slack_channel?: string | null;
  department_id?: string | null;
  components?: string | null;
}

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string | null;
  job_title: string | null;
}

interface TeamMember extends Profile {
  role: string;
}

type FunctionTab = 'general' | 'measurables' | 'tools' | 'meetings' | 'sops' | 'tasks' | 'chat' | 'agents';

export const TeamPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [teamLead, setTeamLead] = useState<Profile | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activeTab, setActiveTab] = useState<FunctionTab>('general');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin } = useRole();
  const { user, loading: authLoading } = useAuth();
  const { organization, loading: orgLoading } = useOrganization();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id) {
      fetchTeamData();
    }
  }, [id]);

  const fetchTeamData = async () => {
    if (!id) return;
    
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', id)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      if (teamData.team_lead_id) {
        const { data: leadData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email, job_title')
          .eq('id', teamData.team_lead_id)
          .single();
        setTeamLead(leadData);
      }

      // Fetch team members
      const { data: teamMembers, error: membersError } = await supabase
        .from('team_members')
        .select('profile_id, role')
        .eq('team_id', id);

      if (membersError) throw membersError;

      const profileIds = teamMembers?.map(tm => tm.profile_id) || [];
      if (profileIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email, job_title')
          .in('id', profileIds);

        const membersWithRoles = profiles?.map(p => {
          const membership = teamMembers?.find(tm => tm.profile_id === p.id);
          return { ...p, role: membership?.role || 'member' };
        }) || [];

        setMembers(membersWithRoles);
      }

    } catch (error) {
      console.error('Error fetching team:', error);
      toast({
        title: "Error",
        description: "Failed to load function data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

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
            onUpdate={fetchTeamData}
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
                  <AvatarImage src={teamLead.avatar_url || ''} />
                  <AvatarFallback className="text-[10px]">{getInitials(teamLead.full_name)}</AvatarFallback>
                </Avatar>
                <span>{teamLead.full_name}</span>
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
