import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, Users, Settings, Eye, GitBranch, Crown, Calendar, Clock, Trophy, Heart, TrendingUp, User } from "lucide-react";
import { trpc } from '@/lib/trpc';
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
  fullName: string;
  email: string;
  avatarUrl: string | null;
  status: string | null;
  location: string | null;
  managerId: string | null;
  manager?: {
    id: string;
    fullName: string;
  } | null;
  department: {
    id: string;
    name: string;
    parentDepartment?: {
      name: string;
    } | null;
  } | null;
  positionRole: {
    id: string;
    title: string;
  } | null;
  userRoles: Array<{
    role: string;
  }>;
  teamMemberships: Array<{
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
  parentId: string | null;
  headId: string | null;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  teamType: string;
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

  // Fetch all data via tRPC
  const { data: profilesRaw, isLoading: profilesLoading } = trpc.profiles.list.useQuery();
  const { data: departmentsRaw, isLoading: deptsLoading } = trpc.departments.list.useQuery();
  const { data: teamsRaw, isLoading: teamsLoading } = trpc.teams.list.useQuery();
  const { data: positionsRaw } = trpc.positions.listRoles.useQuery();
  const { data: myProfile } = trpc.profiles.me.useQuery(undefined, { enabled: !!user });

  const loading = profilesLoading || deptsLoading || teamsLoading;

  const departments: Department[] = (departmentsRaw || []).map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description ?? null,
    parentId: d.parentId ?? null,
    headId: d.headId ?? null,
  }));

  const teams: Team[] = (teamsRaw || []).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    teamType: t.teamType || '',
  }));

  // Build enriched employee list
  const employees: ProfileWithOrg[] = React.useMemo(() => {
    if (!profilesRaw) return [];

    const profiles = profilesRaw as Array<Record<string, unknown>>;
    const deptById = new Map(departments.map(d => [d.id, d]));
    const deptNameById = new Map(departments.map(d => [d.id, d.name]));
    const posById = new Map((positionsRaw || []).map((p) => [p.id, p]));
    const teamById = new Map(teams.map(t => [t.id, t]));
    const profileBasicById = new Map(profiles.map(p => [p.id, { id: p.id, fullName: p.fullName }]));

    // Build team memberships from teamMembers data embedded in profiles or fetched separately
    // Since we don't have a bulk teamMembers query, we'll use what's available in profiles
    const membershipsByProfile = new Map<string, Array<{ team: { id: string; name: string }; role: string }>>();

    return profiles.map((employee) => {
      const departmentHeadOf = departments.filter(dept => dept.headId === employee.id);
      const teamLeadOf = teams.filter((team) => (team as Record<string, unknown>).teamLeadId === employee.id);

      const managerData = employee.managerId ? (profileBasicById.get(employee.managerId) || null) : null;
      const dept = employee.departmentId ? deptById.get(employee.departmentId) : null;
      const position = employee.positionId ? posById.get(employee.positionId) : null;

      return {
        id: employee.id,
        fullName: employee.fullName || '',
        email: employee.email || '',
        avatarUrl: employee.avatarUrl ?? null,
        status: employee.status ?? null,
        location: employee.location ?? null,
        managerId: employee.managerId ?? null,
        manager: managerData,
        department: dept
          ? {
              id: dept.id,
              name: dept.name,
              parentDepartment: dept.parentId ? { name: deptNameById.get(dept.parentId) || 'Unknown' } : null
            }
          : null,
        positionRole: position ? { id: position.id, title: position.title } : null,
        userRoles: employee.userRoles || [],
        teamMemberships: employee.teamMemberships || membershipsByProfile.get(employee.id) || [],
        departmentHeadOf,
        teamLeadOf
      } as ProfileWithOrg;
    });
  }, [profilesRaw, departments, teams, positionsRaw]);

  // Set current user profile
  useEffect(() => {
    if (myProfile) {
      setCurrentUserProfileId(myProfile.id);
      const currentUserData = employees.find(emp => emp.id === myProfile.id);
      if (currentUserData) {
        setCurrentUser(currentUserData);
      }
    }
  }, [myProfile, employees]);

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
        employee.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (employee.positionRole?.title || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (viewMode === 'departments') {
        const matchesDepartment = selectedDepartment === 'none' || selectedDepartment === '' ||
          employee.department?.id === selectedDepartment;
        return matchesSearch && matchesDepartment;
      } else if (viewMode === 'teams') {
        const matchesTeam = selectedTeam === 'none' || selectedTeam === '' ||
          employee.teamMemberships.some(tm => tm.team.id === selectedTeam);
        return matchesSearch && matchesTeam;
      } else {
        return matchesSearch;
      }
    });
  };

  const buildHierarchy = (employees: ProfileWithOrg[]) => {
    const employeeMap = new Map(employees.map(emp => [emp.id, { ...emp, directReports: [] as ProfileWithOrg[] }]));
    const topLevel: (ProfileWithOrg & { directReports: ProfileWithOrg[] })[] = [];

    employees.forEach(employee => {
      const empWithReports = employeeMap.get(employee.id);
      if (!empWithReports) return;

      if (employee.managerId && employeeMap.has(employee.managerId)) {
        const manager = employeeMap.get(employee.managerId);
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
                  <AvatarImage src={employee.avatarUrl || ''} />
                  <AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(employee.status || 'active')}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm truncate">{employee.fullName}</h4>
                  {employee.directReports.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {employee.directReports.length} reports
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
                {employee.positionRole && (
                  <Badge variant="outline" className="text-xs mt-1">
                    {employee.positionRole.title}
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
              .sort((a, b) => a.fullName.localeCompare(b.fullName))
              .map(report => renderHierarchyNode({ ...report, directReports: [] }, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredEmployees = filterEmployees(employees);

  const departmentSections = (() => {
    const base = departments
      .map((dept) => {
        const head = dept.headId ? employees.find(e => e.id === dept.headId) : null;
        return {
          id: dept.id,
          name: dept.name,
          headId: dept.headId,
          head: head ? { id: head.id, fullName: head.fullName, avatarUrl: head.avatarUrl } : null,
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
        employees: filteredEmployees.filter((e) => e.teamMemberships.some((tm) => tm.team.id === team.id)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const scoped = selectedTeam && selectedTeam !== 'none'
      ? base.filter((t) => t.id === selectedTeam)
      : base;

    const noTeams = filteredEmployees.filter((e) => e.teamMemberships.length === 0);
    return { teams: scoped, noTeams };
  })();

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

  if (showMyJourney && currentUserProfileId) {
    return (
      <EmployeeJourney
        employeeId={currentUserProfileId}
        onBack={() => setViewMode('departments')}
      />
    );
  }

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
                                <span className="text-sm text-muted-foreground">{head.fullName}</span>
                              </div>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>

                          {deptEmployees.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No members assigned yet.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {deptEmployees
                                .sort((a, b) => a.fullName.localeCompare(b.fullName))
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
                                            <AvatarImage src={employee.avatarUrl || ''} />
                                            <AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback>
                                          </Avatar>
                                          <div
                                            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(employee.status || 'active')}`}
                                          />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1">
                                            <h4 className="font-semibold text-sm truncate">{employee.fullName}</h4>
                                            {(employee.departmentHeadOf && employee.departmentHeadOf.length > 0) && (
                                              <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                                            )}
                                          </div>
                                          <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
                                          {employee.positionRole && (
                                            <Badge variant="outline" className="text-xs mt-1">
                                              {employee.positionRole.title}
                                            </Badge>
                                          )}
                                          {employee.location && (
                                            <p className="text-xs text-muted-foreground mt-1">{employee.location}</p>
                                          )}
                                          {employee.teamMemberships.length > 0 && (
                                            <div className="flex gap-1 mt-1 flex-wrap">
                                              {employee.teamMemberships.map((tm, idx) => (
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
                                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                                .map((employee) => (
                                  <Card
                                    key={employee.id}
                                    className="hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() => onEmployeeClick?.(employee)}
                                  >
                                    <CardContent className="p-4">
                                      <div className="flex items-center gap-3">
                                        <Avatar className="h-12 w-12">
                                          <AvatarImage src={employee.avatarUrl || ''} />
                                          <AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                          <h4 className="font-semibold text-sm truncate">{employee.fullName}</h4>
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
                                        <AvatarImage src={employee.avatarUrl || ''} />
                                        <AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback>
                                      </Avatar>
                                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(employee.status || 'active')}`} />
                                    </div>
                                     <div className="flex-1 min-w-0">
                                       <div className="flex items-center gap-1">
                                         <h4 className="font-semibold text-sm truncate">{employee.fullName}</h4>
                                         {(employee.teamLeadOf && employee.teamLeadOf.some(team =>
                                           employee.teamMemberships.some(tm => tm.team.id === team.id)
                                         )) && (
                                           <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                                         )}
                                       </div>
                                       <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
                                       {employee.positionRole && (
                                         <Badge variant="outline" className="text-xs mt-1">
                                           {employee.positionRole.title}
                                         </Badge>
                                       )}
                                       {(employee as ProfileWithOrg & { teamRole?: string }).teamRole && (
                                         <Badge variant="secondary" className="text-xs mt-1">
                                           {(employee as ProfileWithOrg & { teamRole?: string }).teamRole}
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
                                        <AvatarImage src={employee.avatarUrl || ''} />
                                        <AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-sm truncate">{employee.fullName}</h4>
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
