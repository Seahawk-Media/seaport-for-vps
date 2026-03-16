import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useOrganization } from "@/hooks/useOrganization";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  Building2, Wrench, Video, FileText, Target, Bot,
  Users, ChevronRight, ArrowRight
} from "lucide-react";

interface Department {
  id: string;
  name: string;
  description: string | null;
  headId: string | null;
  head?: { fullName: string | null } | null;
}

interface ResourceCounts {
  tools: number;
  meetings: number;
  sops: number;
  measurables: number;
  agents: number;
  members: number;
  functions: number;
}

interface ResourceItem {
  id: string;
  name: string;
  subtitle?: string | null;
}

interface DeptResources {
  tools: ResourceItem[];
  meetings: ResourceItem[];
  sops: ResourceItem[];
  measurables: ResourceItem[];
  agents: ResourceItem[];
}

const resourceConfig = [
  { key: 'tools' as const,       label: 'Tools',       icon: Wrench,  color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
  { key: 'meetings' as const,    label: 'Meetings',    icon: Video,   color: 'text-green-500',  bg: 'bg-green-500/10'  },
  { key: 'sops' as const,        label: 'SOPs',        icon: FileText,color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { key: 'measurables' as const, label: 'Measurables', icon: Target,  color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { key: 'agents' as const,      label: 'Agents',      icon: Bot,     color: 'text-pink-500',   bg: 'bg-pink-500/10'   },
];

export default function DepartmentsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, isAdmin, loading: roleLoading } = useRole();
  const { organization } = useOrganization();

  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // Fetch all departments
  const { data: departmentsRaw, isLoading: loadingDepts } = trpc.departments.list.useQuery(undefined, {
    enabled: !!organization?.id,
  });

  // Fetch resource lists for counts
  const { data: toolsList } = trpc.tools.list.useQuery();
  const { data: meetingsList } = trpc.meetings.list.useQuery();
  const { data: sopsList } = trpc.sops.list.useQuery();
  const { data: measurablesList } = trpc.measurables.list.useQuery();
  const { data: agentsList } = trpc.agents.list.useQuery();
  const { data: profilesList } = trpc.profiles.list.useQuery();
  const { data: teamsList } = trpc.teams.list.useQuery();

  const departments: Department[] = (departmentsRaw || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    description: d.description ?? null,
    headId: d.headId ?? null,
    head: d.head ?? null,
  }));

  // Set first department as active when loaded
  useEffect(() => {
    if (departments.length > 0 && !activeDeptId) {
      setActiveDeptId(departments[0].id);
    }
  }, [departments, activeDeptId]);

  // Compute counts per department
  const counts: Record<string, ResourceCounts> = {};
  departments.forEach(d => {
    counts[d.id] = { tools: 0, meetings: 0, sops: 0, measurables: 0, agents: 0, members: 0, functions: 0 };
  });
  (toolsList || []).forEach((r: any) => { if (r.departmentId && counts[r.departmentId]) counts[r.departmentId].tools++; });
  (meetingsList || []).forEach((r: any) => { if (r.departmentId && counts[r.departmentId]) counts[r.departmentId].meetings++; });
  (sopsList || []).forEach((r: any) => { if (r.departmentId && counts[r.departmentId]) counts[r.departmentId].sops++; });
  (agentsList || []).forEach((r: any) => { if (r.departmentId && counts[r.departmentId]) counts[r.departmentId].agents++; });
  (profilesList || []).forEach((r: any) => { if (r.departmentId && counts[r.departmentId]) counts[r.departmentId].members++; });
  (teamsList || []).forEach((r: any) => { if (r.departmentId && counts[r.departmentId]) counts[r.departmentId].functions++; });
  // measurables via teams
  (measurablesList || []).forEach((r: any) => {
    const team = (teamsList || []).find((t: any) => t.id === r.teamId);
    if (team?.departmentId && counts[team.departmentId]) counts[team.departmentId].measurables++;
  });

  // Build resources for active department (top 5)
  const buildResources = (deptId: string): DeptResources => {
    const filterByDept = (list: any[], key: string = 'departmentId') =>
      (list || []).filter((r: any) => r[key] === deptId).slice(0, 5);

    return {
      tools: filterByDept(toolsList || []).map((t: any) => ({ id: t.id, name: t.name, subtitle: t.description })),
      meetings: filterByDept(meetingsList || []).map((m: any) => ({ id: m.id, name: m.title, subtitle: m.recurrence })),
      sops: filterByDept(sopsList || []).map((s: any) => ({ id: s.id, name: s.title, subtitle: s.status })),
      measurables: (measurablesList || [])
        .filter((m: any) => {
          const team = (teamsList || []).find((t: any) => t.id === m.teamId);
          return team?.departmentId === deptId;
        })
        .slice(0, 5)
        .map((m: any) => ({ id: m.id, name: m.name, subtitle: m.unit })),
      agents: filterByDept(agentsList || []).map((a: any) => ({ id: a.id, name: a.name, subtitle: a.type })),
    };
  };

  if (authLoading || roleLoading || loadingDepts) {
    return (
      <DashboardLayout title="Departments" description="Department rollup overview">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  const activeDept = departments.find(d => d.id === activeDeptId);
  const activeCounts = activeDeptId ? counts[activeDeptId] : null;
  const resources = activeDeptId ? buildResources(activeDeptId) : null;

  return (
    <DashboardLayout title="Departments" description="Overview of all departments and their resources">
      <div className="flex gap-6 h-full">

        {/* Left: Department flipbook selector */}
        <div className="w-60 flex-shrink-0">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-3">
              {departments.length} Departments
            </p>
            {departments.map(dept => {
              const c = counts[dept.id];
              const isActive = dept.id === activeDeptId;
              return (
                <button
                  key={dept.id}
                  onClick={() => setActiveDeptId(dept.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                      <span className="text-sm font-medium truncate">{dept.name}</span>
                    </div>
                    <ChevronRight className={cn("h-3.5 w-3.5 flex-shrink-0 transition-transform", isActive ? "text-primary-foreground" : "text-muted-foreground", isActive && "rotate-90")} />
                  </div>
                  {c && (
                    <div className={cn("flex gap-2 mt-1 text-xs", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      <span>{c.members} members</span>
                      <span>·</span>
                      <span>{c.functions} functions</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active department detail */}
        <div className="flex-1 min-w-0">
          {!activeDept ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Select a department to view its resources
            </div>
          ) : (
            <div className="space-y-5">
              {/* Department Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold">{activeDept.name}</h2>
                    {activeCounts && (
                      <Badge variant="secondary">{activeCounts.members} members</Badge>
                    )}
                  </div>
                  {activeDept.description && (
                    <p className="text-sm text-muted-foreground mt-1">{activeDept.description}</p>
                  )}
                  {activeDept.head && (
                    <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>Head: {activeDept.head.fullName}</span>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/department/${activeDept.id}`)}
                  className="gap-1.5"
                >
                  Open Department
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Resource Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {resourceConfig.map(({ key, label, icon: Icon, color, bg }) => {
                  const items = resources?.[key] || [];
                  const count = activeCounts?.[key] ?? 0;
                  return (
                    <Card key={key} className="flex flex-col">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn("rounded-md p-1.5", bg)}>
                              <Icon className={cn("h-4 w-4", color)} />
                            </div>
                            <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                          </div>
                          <Badge variant="outline" className="text-xs">{count}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 flex-1">
                        {items.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No {label.toLowerCase()} yet</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {items.map(item => (
                              <li key={item.id} className="flex items-center justify-between gap-2">
                                <span className="text-sm truncate">{item.name}</span>
                                {item.subtitle && (
                                  <span className="text-xs text-muted-foreground flex-shrink-0 capitalize">{item.subtitle}</span>
                                )}
                              </li>
                            ))}
                            {count > 5 && (
                              <li className="text-xs text-muted-foreground pt-1">
                                +{count - 5} more
                              </li>
                            )}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
