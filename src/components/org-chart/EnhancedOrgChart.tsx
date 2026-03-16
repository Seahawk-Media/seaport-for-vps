import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, Users, Settings, Eye, GitBranch, Crown, Calendar, Clock, Trophy, Heart, TrendingUp, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ManagerPerformanceReviewDashboard } from "@/components/performance/ManagerPerformanceReviewDashboard";
import { EmployeeJourney } from "@/components/employee-journey/EmployeeJourney";
import { DepartmentDashboard } from "@/components/department/DepartmentDashboard";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { UserProfileDropdown } from "@/components/navigation/UserProfileDropdown";
import { ChevronRight } from "lucide-react";

interface ProfileWithOrg {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  status: string | null;
  location: string | null;
  manager_id: string | null;
  manager?: {
    id: string;
    full_name: string;
  } | null;
  department: {
    id: string;
    name: string;
    parent_department?: {
      name: string;
    } | null;
  } | null;
  position_role: {
    id: string;
    title: string;
  } | null;
  user_roles: Array<{
    role: string;
  }> | any;
  team_memberships: Array<{
    team: {
      id: string;
      name: string;
    };
    role: string;
  }>;
  departmentHeadOf?: Array<{ id: string; name: string; }>;
  teamLeadOf?: Array<{ id: string; name: string; }>;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  head_id: string | null;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  team_type: string;
}

interface EnhancedOrgChartProps {
  onEmployeeClick?: (employee: ProfileWithOrg) => void;
  onMyJourneyClick?: () => void;
  onSettingsClick?: () => void;
  onAdminSettingsClick?: () => void;
  onSignOut?: () => void;
}

export const EnhancedOrgChart: React.FC<EnhancedOrgChartProps> = ({
  onEmployeeClick,
  onMyJourneyClick,
  onSettingsClick,
  onAdminSettingsClick,
  onSignOut
}) => {
  const [employees, setEmployees] = useState<ProfileWithOrg[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [viewMode, setViewMode] = useState<'departments' | 'teams' | 'hierarchy' | 'performance' | 'timeoff' | 'overtime' | 'bounties' | 'core-values' | 'growth-journey' | 'my-journey' | 'settings' | 'admin'>('departments');
  const [showMyJourney, setShowMyJourney] = useState(false);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<ProfileWithOrg | null>(null);
  const [departmentDashboardId, setDepartmentDashboardId] = useState<string | null>(null);
  const { isSuperAdmin, isAdmin } = useRole();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    fetchCurrentUserProfile();
  }, []);

  const fetchCurrentUserProfile = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      setCurrentUserProfileId(profile.id);
    }
  };

  const fetchData = async () => {
    try {
      // Avoid relational-select FK-hint joins here (they can break when the schema cache is stale).
      // Instead, fetch base tables and stitch the objects together client-side.
      const [profilesRes, departmentsRes, teamsRes, positionsRes, teamMembersRes] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('departments').select('*').order('name'),
        supabase.from('teams').select('*').order('name'),
        supabase.from('position_roles').select('id, title').order('title'),
        supabase.from('team_members').select('profile_id, team_id, role')
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (teamsRes.error) throw teamsRes.error;
      if (positionsRes.error) throw positionsRes.error;
      if (teamMembersRes.error) throw teamMembersRes.error;

      const departments = departmentsRes.data || [];
      const teams = teamsRes.data || [];
      const profiles = profilesRes.data || [];

      const deptById = new Map(departments.map(d => [d.id, d]));
      const deptNameById = new Map(departments.map(d => [d.id, d.name]));
      const posById = new Map((positionsRes.data || []).map(p => [p.id, p]));
      const teamById = new Map(teams.map(t => [t.id, t]));
      const profileBasicById = new Map(
        profiles.map(p => [p.id, { id: p.id, full_name: p.full_name }])
      );

      const membershipsByProfile = new Map<string, Array<{ team: { id: string; name: string }; role: string }>>();
      (teamMembersRes.data || []).forEach((tm) => {
        const team = teamById.get(tm.team_id);
        if (!team) return;
        const existing = membershipsByProfile.get(tm.profile_id) || [];
        existing.push({ team: { id: team.id, name: team.name }, role: tm.role });
        membershipsByProfile.set(tm.profile_id, existing);
      });

      // Fetch user roles separately and merge (per-user to respect RLS)
      const employeesWithRoles = await Promise.all(
        profiles.map(async (employee) => {
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', employee.user_id);

          return {
            ...employee,
            user_roles: userRoles || []
          };
        })
      );

      const employeesWithLeadership = employeesWithRoles.map((employee) => {
        const departmentHeadOf = departments.filter(dept => dept.head_id === employee.id);
        const teamLeadOf = teams.filter(team => team.team_lead_id === employee.id);

        const managerData = employee.manager_id ? (profileBasicById.get(employee.manager_id) || null) : null;
        const dept = employee.department_id ? deptById.get(employee.department_id) : null;
        const position = employee.position_id ? posById.get(employee.position_id) : null;

        return {
          ...employee,
          manager: managerData,
          department: dept
            ? {
                id: dept.id,
                name: dept.name,
                parent_department: dept.parent_id ? { name: deptNameById.get(dept.parent_id) || 'Unknown' } : null
              }
            : null,
          position_role: position ? { id: position.id, title: position.title } : null,
          team_memberships: membershipsByProfile.get(employee.id) || [],
          departmentHeadOf,
          teamLeadOf
        };
      }) as ProfileWithOrg[];

      setEmployees(employeesWithLeadership);
      setDepartments(departments);
      setTeams(teams);
      
      // Set current user data from the employees list
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          const currentUserData = employeesWithLeadership.find(emp => emp.id === profile.id);
          if (currentUserData) {
            setCurrentUser(currentUserData as ProfileWithOrg);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch organizational data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-red-500';
      case 'on_leave': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getHighestRole = (userRoles: Array<{role: string}>) => {
    if (!userRoles.length) return 'employee';
    const roleHierarchy = ['super_admin', 'admin', 'manager', 'employee'];
    for (const role of roleHierarchy) {
      if (userRoles.some(ur => ur.role === role)) return role;
    }
    return 'employee';
  };

  const getViewModeTitle = (mode: string) => {
    switch (mode) {
      case 'departments': return 'Departments';
      case 'teams': return 'Teams';
      case 'hierarchy': return 'Organizational Hierarchy';
      case 'performance': return 'Performance Dashboard';
      case 'timeoff': return 'Time Off Management';
      case 'overtime': return 'Overtime Tracking';
      case 'bounties': return 'Achievement Bounties';
      case 'core-values': return 'Core Values';
      case 'growth-journey': return 'Growth Journey';
      case 'my-journey': return 'My Journey';
      default: return 'Team Structure';
    }
  };

  const getViewModeDescription = (mode: string) => {
    switch (mode) {
      case 'departments': return 'Browse by department structure';
      case 'teams': return 'Browse by team composition';
      case 'hierarchy': return 'Browse by reporting hierarchy';
      case 'performance': return 'View performance insights and analytics';
      case 'timeoff': return 'Manage time off requests and calendar';
      case 'overtime': return 'Track and approve overtime requests';
      case 'bounties': return 'View and manage achievement bounties';
      case 'core-values': return 'Track core values alignment and feedback';
      case 'growth-journey': return 'Monitor employee growth and development';
      case 'my-journey': return 'Your personal employee journey and achievements';
      default: return 'View your team structure and organization';
    }
  };

  const filterEmployees = (employees: ProfileWithOrg[]) => {
    return employees.filter(employee => {
      const matchesSearch = searchTerm === '' || 
        employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (employee.position_role?.title || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (viewMode === 'departments') {
        const matchesDepartment = selectedDepartment === 'none' || selectedDepartment === '' || 
          employee.department?.id === selectedDepartment;
        return matchesSearch && matchesDepartment;
      } else if (viewMode === 'teams') {
        const matchesTeam = selectedTeam === 'none' || selectedTeam === '' || 
          employee.team_memberships.some(tm => tm.team.id === selectedTeam);
        return matchesSearch && matchesTeam;
      } else {
        return matchesSearch; // hierarchy view shows all that match search
      }
    });
  };

  const groupByDepartment = (employees: ProfileWithOrg[]) => {
    const grouped: { [key: string]: ProfileWithOrg[] } = {};
    
    employees.forEach(employee => {
      const deptName = employee.department?.name || 'Unassigned';
      if (!grouped[deptName]) {
        grouped[deptName] = [];
      }
      grouped[deptName].push(employee);
    });

    return grouped;
  };

  const groupByTeam = (employees: ProfileWithOrg[]) => {
    const grouped: { [key: string]: ProfileWithOrg[] } = {};
    
    employees.forEach(employee => {
      if (employee.team_memberships.length === 0) {
        if (!grouped['No Teams']) {
          grouped['No Teams'] = [];
        }
        grouped['No Teams'].push(employee);
      } else {
        // If a specific team is selected, only show that team
        if (selectedTeam && selectedTeam !== 'none' && selectedTeam !== '') {
          const selectedMembership = employee.team_memberships.find(tm => tm.team.id === selectedTeam);
          if (selectedMembership) {
            const teamName = selectedMembership.team.name;
            if (!grouped[teamName]) {
              grouped[teamName] = [];
            }
            grouped[teamName].push({
              ...employee,
              teamRole: selectedMembership.role
            } as ProfileWithOrg & { teamRole: string });
          }
        } else {
          // If no specific team selected, show all teams
          employee.team_memberships.forEach(membership => {
            const teamName = membership.team.name;
            if (!grouped[teamName]) {
              grouped[teamName] = [];
            }
            grouped[teamName].push({
              ...employee,
              teamRole: membership.role
            } as ProfileWithOrg & { teamRole: string });
          });
        }
      }
    });

    return grouped;
  };

  const buildHierarchy = (employees: ProfileWithOrg[]) => {
    const employeeMap = new Map(employees.map(emp => [emp.id, { ...emp, directReports: [] as ProfileWithOrg[] }]));
    const topLevel: (ProfileWithOrg & { directReports: ProfileWithOrg[] })[] = [];

    employees.forEach(employee => {
      const empWithReports = employeeMap.get(employee.id);
      if (!empWithReports) return;

      if (employee.manager_id && employeeMap.has(employee.manager_id)) {
        const manager = employeeMap.get(employee.manager_id);
        manager?.directReports.push(empWithReports);
      } else {
        topLevel.push(empWithReports);
      }
    });

    return topLevel;
  };

  const renderHierarchyNode = (employee: ProfileWithOrg & { directReports: ProfileWithOrg[] }, level: number = 0) => {
    const indentClass = level > 0 ? `ml-${Math.min(level * 4, 16)}` : '';
    
    return (
      <div key={employee.id} className="space-y-2">
        <Card className={`hover:shadow-md transition-shadow cursor-pointer ${indentClass}`} 
              onClick={() => onEmployeeClick?.(employee)}>
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={employee.avatar_url || ''} />
                  <AvatarFallback>{getInitials(employee.full_name)}</AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(employee.status || 'active')}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm truncate">{employee.full_name}</h4>
                  {employee.directReports.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {employee.directReports.length} reports
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
                {employee.position_role && (
                  <Badge variant="outline" className="text-xs mt-1">
                    {employee.position_role.title}
                  </Badge>
                )}
                {employee.department && (
                  <p className="text-xs text-muted-foreground mt-1">{employee.department.name}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        {employee.directReports.length > 0 && (
          <div className="space-y-2">
            {employee.directReports
              .sort((a, b) => a.full_name.localeCompare(b.full_name))
              .map(report => renderHierarchyNode({ ...report, directReports: [] }, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredEmployees = filterEmployees(employees);

  // In the UI, we want departments/teams to appear even when they have 0 members.
  // The previous grouping helpers only returned groups that had at least one employee.
  const departmentSections = (() => {
    const base = departments
      .map((dept) => {
        const head = dept.head_id ? employees.find(e => e.id === dept.head_id) : null;
        return {
          id: dept.id,
          name: dept.name,
          head_id: dept.head_id,
          head: head ? { id: head.id, full_name: head.full_name, avatar_url: head.avatar_url } : null,
          employees: filteredEmployees.filter((e) => e.department?.id === dept.id),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const scoped = selectedDepartment && selectedDepartment !== 'none'
      ? base.filter((d) => d.id === selectedDepartment)
      : base;

    const unassigned = filteredEmployees.filter((e) => !e.department);
    return { departments: scoped, unassigned };
  })();

  const teamSections = (() => {
    const base = teams
      .map((team) => ({
        id: team.id,
        name: team.name,
        employees: filteredEmployees.filter((e) => e.team_memberships.some((tm) => tm.team.id === team.id)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const scoped = selectedTeam && selectedTeam !== 'none'
      ? base.filter((t) => t.id === selectedTeam)
      : base;

    const noTeams = filteredEmployees.filter((e) => e.team_memberships.length === 0);
    return { teams: scoped, noTeams };
  })();

  // Handle view mode changes - show separate UI for my-journey
  useEffect(() => {
    if (viewMode === 'my-journey' && currentUserProfileId) {
      setShowMyJourney(true);
    } else {
      setShowMyJourney(false);
    }
  }, [viewMode, currentUserProfileId]);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading organizational chart...</div>;
  }

  // Show separate EmployeeJourney UI when My Journey is selected
  if (showMyJourney && currentUserProfileId) {
    return (
      <EmployeeJourney
        employeeId={currentUserProfileId}
        onBack={() => setViewMode('departments')}
      />
    );
  }

  // Show Department Dashboard when a department is selected
  if (departmentDashboardId) {
    return (
      <DepartmentDashboard
        departmentId={departmentDashboardId}
        onBack={() => setDepartmentDashboardId(null)}
        onEmployeeClick={(employeeId) => {
          const emp = employees.find(e => e.id === employeeId);
          if (emp) onEmployeeClick?.(emp);
        }}
      />
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar viewMode={viewMode} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Navbar */}
          <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 px-6 py-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary p-2">
                    <Users className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-foreground">{import.meta.env.VITE_APP_NAME || 'Seaport'}</h1>
                    <p className="text-sm text-muted-foreground">Employee Operating System</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <UserProfileDropdown
                  onMyJourneyClick={onMyJourneyClick || (() => {})}
                  onSettingsClick={onSettingsClick || (() => {})}
                  onAdminSettingsClick={onAdminSettingsClick}
                  onSignOut={onSignOut || (() => {})}
                />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-hidden">
            <div className="container mx-auto p-4 space-y-4">
              {/* Chart Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Building2 className="h-6 w-6" />
                    Organization Chart
                  </h2>
                  <p className="text-muted-foreground">
                    {viewMode === 'my-journey' && 'View your personal employee journey and achievements'}
                    {viewMode === 'departments' && 'View your organization by departments'}
                    {viewMode === 'teams' && 'View your organization by teams'}
                    {viewMode === 'hierarchy' && 'View your complete organizational hierarchy'}
                    {viewMode === 'performance' && 'View performance insights'}
                    {viewMode === 'timeoff' && 'Manage and view time off requests'}
                    {viewMode === 'overtime' && 'Track overtime hours and requests'}
                    {viewMode === 'bounties' && 'View and manage achievement bounties'}
                    {viewMode === 'core-values' && 'Track core values alignment and feedback'}
                    {viewMode === 'growth-journey' && 'Monitor employee growth and development'}
                  </p>
                </div>
              </div>

              {/* Main Content */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{getViewModeTitle(viewMode)}</CardTitle>
                      <CardDescription>
                        {getViewModeDescription(viewMode)}
                        {viewMode === 'bounties' && 'Achievement system for employee recognition'}
                        {viewMode === 'core-values' && 'Core values tracking and feedback'}
                        {viewMode === 'growth-journey' && 'Employee development and career progression'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>

                  <div className="flex flex-col md:flex-row gap-4 mt-6 mb-6">
                    <div className="flex items-center gap-2 flex-1">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search employees..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    {viewMode === 'departments' && (
                      <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Filter by department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">All Departments</SelectItem>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {viewMode === 'teams' && (
                      <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Filter by team" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">All Teams</SelectItem>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {viewMode === 'departments' && (
                    <div className="space-y-6">
                      {departmentSections.departments.map(({ id, name, head, employees: deptEmployees }) => (
                        <div key={id} className="space-y-4">
                          <div 
                            className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg -ml-2 transition-colors group"
                            onClick={() => window.location.href = `/department/${id}`}
                          >
                            <Building2 className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-semibold">{name}</h3>
                            <Badge variant="secondary">{deptEmployees.length} members</Badge>
                            {head && (
                              <div className="flex items-center gap-1 ml-2">
                                <Crown className="h-4 w-4 text-yellow-500" />
                                <span className="text-sm text-muted-foreground">{head.full_name}</span>
                              </div>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>

                          {deptEmployees.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No members assigned yet.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {deptEmployees
                                .sort((a, b) => a.full_name.localeCompare(b.full_name))
                                .map((employee) => (
                                  <Card
                                    key={employee.id}
                                    className="hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() => onEmployeeClick?.(employee)}
                                  >
                                    <CardContent className="p-4">
                                      <div className="flex items-center gap-3">
                                        <div className="relative">
                                          <Avatar className="h-12 w-12">
                                            <AvatarImage src={employee.avatar_url || ''} />
                                            <AvatarFallback>{getInitials(employee.full_name)}</AvatarFallback>
                                          </Avatar>
                                          <div
                                            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(employee.status || 'active')}`}
                                          />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1">
                                            <h4 className="font-semibold text-sm truncate">{employee.full_name}</h4>
                                            {(employee.departmentHeadOf && employee.departmentHeadOf.length > 0) && (
                                              <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                                            )}
                                          </div>
                                          <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
                                          {employee.position_role && (
                                            <Badge variant="outline" className="text-xs mt-1">
                                              {employee.position_role.title}
                                            </Badge>
                                          )}
                                          {employee.location && (
                                            <p className="text-xs text-muted-foreground mt-1">{employee.location}</p>
                                          )}
                                          {employee.team_memberships.length > 0 && (
                                            <div className="flex gap-1 mt-1 flex-wrap">
                                              {employee.team_memberships.map((tm, idx) => (
                                                <Badge key={idx} variant="secondary" className="text-xs">
                                                  {tm.team.name}
                                                </Badge>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {selectedDepartment === '' || selectedDepartment === 'none' ? (
                        departmentSections.unassigned.length > 0 ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <User className="h-5 w-5 text-primary" />
                              <h3 className="text-lg font-semibold">Unassigned</h3>
                              <Badge variant="secondary">{departmentSections.unassigned.length} members</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {departmentSections.unassigned
                                .sort((a, b) => a.full_name.localeCompare(b.full_name))
                                .map((employee) => (
                                  <Card
                                    key={employee.id}
                                    className="hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() => onEmployeeClick?.(employee)}
                                  >
                                    <CardContent className="p-4">
                                      <div className="flex items-center gap-3">
                                        <Avatar className="h-12 w-12">
                                          <AvatarImage src={employee.avatar_url || ''} />
                                          <AvatarFallback>{getInitials(employee.full_name)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                          <h4 className="font-semibold text-sm truncate">{employee.full_name}</h4>
                                          <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                            </div>
                          </div>
                        ) : null
                      ) : null}
                    </div>
                  )}

                  {viewMode === 'teams' && (
                    <div className="space-y-6">
                      {teamSections.teams.map(({ id, name, employees: teamEmployees }) => (
                        <div key={id} className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-semibold">{name}</h3>
                            <Badge variant="secondary">{teamEmployees.length} members</Badge>
                          </div>

                          {teamEmployees.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No members assigned yet.</p>
                          ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {teamEmployees.map((employee) => (
                              <Card key={`${employee.id}-${id}`} className="hover:shadow-md transition-shadow cursor-pointer" 
                                    onClick={() => onEmployeeClick?.(employee)}>
                                <CardContent className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className="relative">
                                      <Avatar className="h-12 w-12">
                                        <AvatarImage src={employee.avatar_url || ''} />
                                        <AvatarFallback>{getInitials(employee.full_name)}</AvatarFallback>
                                      </Avatar>
                                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(employee.status || 'active')}`} />
                                    </div>
                                     <div className="flex-1 min-w-0">
                                       <div className="flex items-center gap-1">
                                         <h4 className="font-semibold text-sm truncate">{employee.full_name}</h4>
                                         {(employee.teamLeadOf && employee.teamLeadOf.some(team => 
                                           employee.team_memberships.some(tm => tm.team.id === team.id)
                                         )) && (
                                           <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                                         )}
                                       </div>
                                       <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
                                       {employee.position_role && (
                                         <Badge variant="outline" className="text-xs mt-1">
                                           {employee.position_role.title}
                                         </Badge>
                                       )}
                                       {(employee as any).teamRole && (
                                         <Badge variant="secondary" className="text-xs mt-1">
                                           {(employee as any).teamRole}
                                         </Badge>
                                       )}
                                       {employee.department && (
                                         <p className="text-xs text-muted-foreground mt-1">{employee.department.name}</p>
                                       )}
                                       {employee.location && (
                                         <p className="text-xs text-muted-foreground">{employee.location}</p>
                                       )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                          )}
                        </div>
                      ))}

                      {selectedTeam === '' || selectedTeam === 'none' ? (
                        teamSections.noTeams.length > 0 ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <User className="h-5 w-5 text-primary" />
                              <h3 className="text-lg font-semibold">No Teams</h3>
                              <Badge variant="secondary">{teamSections.noTeams.length} members</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {teamSections.noTeams.map((employee) => (
                                <Card
                                  key={`${employee.id}-no-team`}
                                  className="hover:shadow-md transition-shadow cursor-pointer"
                                  onClick={() => onEmployeeClick?.(employee)}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-12 w-12">
                                        <AvatarImage src={employee.avatar_url || ''} />
                                        <AvatarFallback>{getInitials(employee.full_name)}</AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-sm truncate">{employee.full_name}</h4>
                                        <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        ) : null
                      ) : null}
                    </div>
                  )}

                  {viewMode === 'hierarchy' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <GitBranch className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold">Organizational Hierarchy</h3>
                        <Badge variant="secondary">{filteredEmployees.length} employees</Badge>
                      </div>
                      <div className="space-y-4">
                        {buildHierarchy(filteredEmployees).map(topLevelEmployee => 
                          renderHierarchyNode(topLevelEmployee)
                        )}
                      </div>
                    </div>
                  )}


                  {viewMode === 'performance' && (
                    <ManagerPerformanceReviewDashboard />
                  )}

                  {viewMode === 'timeoff' && (
                    <div className="text-center py-12">
                      <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Time Off Management</h3>
                      <p className="text-muted-foreground">View and manage employee time off requests, vacation calendar, and PTO balances.</p>
                    </div>
                  )}

                  {viewMode === 'overtime' && (
                    <div className="text-center py-12">
                      <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Overtime Tracking</h3>
                      <p className="text-muted-foreground">Monitor overtime hours, approve requests, and track compensation.</p>
                    </div>
                  )}

                  {viewMode === 'bounties' && (
                    <div className="text-center py-12">
                      <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Achievement Bounties</h3>
                      <p className="text-muted-foreground">Recognition system for outstanding achievements and milestone rewards.</p>
                    </div>
                  )}

                  {viewMode === 'core-values' && (
                    <div className="text-center py-12">
                      <Heart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Core Values</h3>
                      <p className="text-muted-foreground">Track alignment with company values and provide feedback on value-driven behavior.</p>
                    </div>
                  )}

                  {viewMode === 'growth-journey' && (
                    <div className="text-center py-12">
                      <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Growth Journey</h3>
                      <p className="text-muted-foreground">Monitor employee development, career progression, and skill advancement.</p>
                    </div>
                  )}

                  {filteredEmployees.length === 0 && (
                    <div className="text-center py-8">
                      <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-muted-foreground">No employees found</h3>
                      <p className="text-muted-foreground">Try adjusting your search or filter criteria.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};