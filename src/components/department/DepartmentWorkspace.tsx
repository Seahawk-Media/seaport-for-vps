import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TeamsGridTab } from "@/components/workspace/tabs/TeamsGridTab";
import { ToolsTab } from "@/components/workspace/tabs/ToolsTab";
import { MeetingsTab } from "@/components/workspace/tabs/MeetingsTab";
import { SOPsTab } from "@/components/workspace/tabs/SOPsTab";
import { TasksTab } from "@/components/workspace/tabs/TasksTab";
import { ChatTab } from "@/components/workspace/tabs/ChatTab";
import { AgentsTab } from "@/components/workspace/tabs/AgentsTab";
import { MeasurablesTab } from "@/components/workspace/tabs/MeasurablesTab";

type Tab = 'functions' | 'measurables' | 'tools' | 'meetings' | 'sops' | 'tasks' | 'chat' | 'agents';

const TABS: { id: Tab; label: string }[] = [
  { id: 'functions',   label: 'Functions'   },
  { id: 'measurables', label: 'Measurables' },
  { id: 'tools',       label: 'Tools'       },
  { id: 'meetings',    label: 'Meetings'    },
  { id: 'sops',        label: 'SOPs'        },
  { id: 'tasks',       label: 'Tasks'       },
  { id: 'chat',        label: 'Chat'        },
  { id: 'agents',      label: 'Agents'      },
];

interface DeptMeta {
  id: string;
  name: string;
  description: string | null;
  head_id: string | null;
}

interface HeadProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface DepartmentWorkspaceProps {
  departmentId: string;
  /** If true, show department name + meta inline (for dashboard use) */
  showHeader?: boolean;
}

const getInitials = (name: string) =>
  name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';

export const DepartmentWorkspace: React.FC<DepartmentWorkspaceProps> = ({
  departmentId,
  showHeader = false,
}) => {
  const [department, setDepartment] = useState<DeptMeta | null>(null);
  const [head, setHead] = useState<HeadProfile | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('functions');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    setActiveTab('functions');
    fetchData();
  }, [departmentId]);

  const fetchData = async () => {
    try {
      const { data: dept, error } = await supabase
        .from('departments')
        .select('*')
        .eq('id', departmentId)
        .single();

      if (error) throw error;
      setDepartment(dept);

      const [headRes, countRes] = await Promise.all([
        dept.head_id
          ? supabase.from('profiles').select('id, full_name, avatar_url').eq('id', dept.head_id).single()
          : Promise.resolve({ data: null }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('department_id', departmentId),
      ]);

      setHead((headRes as any).data ?? null);
      setMemberCount((countRes as any).count ?? 0);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to load department", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner size="md" />
      </div>
    );
  }

  if (!department) return null;

  const renderContent = () => {
    switch (activeTab) {
      case 'functions':   return <TeamsGridTab departmentId={departmentId} />;
      // Department-level master list: show ALL resources in the dept (incl. those inside functions)
      case 'measurables': return <MeasurablesTab departmentId={departmentId} />;
      case 'tools':       return <ToolsTab departmentId={departmentId} showDeptAll />;
      case 'meetings':    return <MeetingsTab departmentId={departmentId} showDeptAll />;
      case 'sops':        return <SOPsTab departmentId={departmentId} showDeptAll />;
      case 'tasks':       return <TasksTab departmentId={departmentId} departmentName={department.name} showDeptAll />;
      case 'chat':        return <ChatTab departmentId={departmentId} />;
      case 'agents':      return <AgentsTab departmentId={departmentId} showDeptAll />;
      default:            return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Optional inline dept header for dashboard */}
      {showHeader && (
        <div className="flex items-center gap-3 pb-1">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{department.name}</h2>
              <Badge variant="secondary" className="text-xs">{memberCount} members</Badge>
              {head && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={head.avatar_url || ''} />
                    <AvatarFallback className="text-[10px]">{getInitials(head.full_name)}</AvatarFallback>
                  </Avatar>
                  <span>{head.full_name}</span>
                  <Crown className="h-3 w-3 text-primary" />
                </div>
              )}
            </div>
            {department.description && (
              <p className="text-xs text-muted-foreground">{department.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Horizontal tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>{renderContent()}</div>
    </div>
  );
};
