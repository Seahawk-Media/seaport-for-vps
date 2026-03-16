import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
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
  head_id: string | null;
  head?: { full_name: string | null } | null;
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

  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, ResourceCounts>>({});
  const [resources, setResources] = useState<DeptResources | null>(null);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingResources, setLoadingResources] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (organization?.id) fetchDepartments();
  }, [organization?.id]);

  useEffect(() => {
    if (activeDeptId) fetchDeptResources(activeDeptId);
  }, [activeDeptId]);

  const fetchDepartments = async () => {
    try {
      const { data: depts } = await supabase
        .from('departments')
        .select('id, name, description, head_id, head:profiles!departments_head_id_fkey(full_name)')
        .order('name');

      const list = depts || [];
      setDepartments(list);
      if (list.length > 0) setActiveDeptId(list[0].id);

      // Fetch counts for all departments in parallel
      if (list.length > 0) {
        const deptIds = list.map(d => d.id);
        const [toolsRes, meetingsRes, sopsRes, measRes, agentsRes, membersRes, teamsRes] = await Promise.all([
          supabase.from('tools').select('department_id').in('department_id', deptIds),
          supabase.from('meetings').select('department_id').in('department_id', deptIds),
          supabase.from('sops').select('department_id').in('department_id', deptIds),
          supabase.from('measurables').select('team_id, teams!inner(department_id)').filter('teams.department_id', 'in', `(${deptIds.join(',')})`),
          supabase.from('agents').select('department_id').in('department_id', deptIds),
          supabase.from('profiles').select('department_id').in('department_id', deptIds),
          supabase.from('teams').select('department_id').in('department_id', deptIds),
        ]);

        const countMap: Record<string, ResourceCounts> = {};
        list.forEach(d => {
          countMap[d.id] = { tools: 0, meetings: 0, sops: 0, measurables: 0, agents: 0, members: 0, functions: 0 };
        });

        (toolsRes.data || []).forEach(r => { if (r.department_id) countMap[r.department_id].tools++; });
        (meetingsRes.data || []).forEach(r => { if (r.department_id) countMap[r.department_id].meetings++; });
        (sopsRes.data || []).forEach(r => { if (r.department_id) countMap[r.department_id].sops++; });
        (agentsRes.data || []).forEach(r => { if (r.department_id) countMap[r.department_id].agents++; });
        (membersRes.data || []).forEach(r => { if (r.department_id) countMap[r.department_id].members++; });
        (teamsRes.data || []).forEach(r => { if (r.department_id) countMap[r.department_id].functions++; });
        // measurables via teams
        (measRes.data || []).forEach((r: any) => {
          const deptId = r.teams?.department_id;
          if (deptId && countMap[deptId]) countMap[deptId].measurables++;
        });

        setCounts(countMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDepts(false);
    }
  };

  const fetchDeptResources = async (deptId: string) => {
    setLoadingResources(true);
    try {
      const [toolsRes, meetingsRes, sopsRes, measRes, agentsRes] = await Promise.all([
        supabase.from('tools').select('id, name, description').eq('department_id', deptId).limit(5).order('name'),
        supabase.from('meetings').select('id, title, recurrence').eq('department_id', deptId).limit(5).order('title'),
        supabase.from('sops').select('id, title, status').eq('department_id', deptId).limit(5).order('title'),
        supabase.from('measurables').select('id, name, unit, teams!inner(department_id)').eq('teams.department_id', deptId).limit(5).order('name'),
        supabase.from('agents').select('id, name, type').eq('department_id', deptId).limit(5).order('name'),
      ]);

      setResources({
        tools: (toolsRes.data || []).map(t => ({ id: t.id, name: t.name, subtitle: t.description })),
        meetings: (meetingsRes.data || []).map(m => ({ id: m.id, name: m.title, subtitle: m.recurrence })),
        sops: (sopsRes.data || []).map(s => ({ id: s.id, name: s.title, subtitle: s.status })),
        measurables: (measRes.data || []).map((m: any) => ({ id: m.id, name: m.name, subtitle: m.unit })),
        agents: (agentsRes.data || []).map((a: any) => ({ id: a.id, name: a.name, subtitle: a.type })),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingResources(false);
    }
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
                      <span>Head: {(activeDept.head as any).full_name}</span>
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
              {loadingResources ? (
                <div className="flex items-center justify-center h-48">
                  <Spinner size="md" />
                </div>
              ) : (
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
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
