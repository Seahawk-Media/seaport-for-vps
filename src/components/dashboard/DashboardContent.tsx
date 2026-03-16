import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, Users, Eye, GitBranch, Crown, Calendar, Clock, Trophy, Heart, TrendingUp, User, ChevronRight, GraduationCap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ManagerPerformanceReviewDashboard } from "@/components/performance/ManagerPerformanceReviewDashboard";
import { AcademyDashboard } from "@/components/academy/AcademyDashboard";
import { useNavigate } from 'react-router-dom';

interface ProfileWithOrg {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  status: string | null;
  location: string | null;
  managerId: string | null;
  departmentId: string | null;
  positionId: string | null;
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

interface DashboardContentProps {
  viewMode: 'departments' | 'functions' | 'hierarchy' | 'performance' | 'timeoff' | 'overtime' | 'bounties' | 'core-values' | 'growth-journey' | 'my-journey' | 'academy';
  onEmployeeClick?: (employee: { id: string }) => void;
}

export const DashboardContent: React.FC<DashboardContentProps> = ({
  viewMode,
  onEmployeeClick,
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  const profilesQuery = trpc.profiles.list.useQuery();
  const departmentsQuery = trpc.departments.list.useQuery();
  const teamsQuery = trpc.teams.list.useQuery();
  const positionsQuery = trpc.positions.listRoles.useQuery();

  const loading = profilesQuery.isLoading || departmentsQuery.isLoading || teamsQuery.isLoading;

  const departments = departmentsQuery.data || [];
  const teams = teamsQuery.data || [];
  const positions = positionsQuery.data || [];

  const employees: ProfileWithOrg[] = useMemo(() => {
    const profiles = profilesQuery.data || [];
    if (!profiles.length) return [];

    const deptById = new Map(departments.map((d: any) => [d.id, d]));
    const deptNameById = new Map(departments.map((d: any) => [d.id, d.name]));
    const posById = new Map(positions.map((p: any) => [p.id, p]));
    const profileBasicById = new Map(
      profiles.map((p: any) => [p.id, { id: p.id, fullName: p.fullName }])
    );

    return profiles.map((employee: any) => {
      const departmentHeadOf = departments.filter((dept: any) => dept.headId === employee.id);
      const teamLeadOf = teams.filter((team: any) => team.teamLeadId === employee.id);
      const managerData = employee.managerId ? (profileBasicById.get(employee.managerId) || null) : null;
      const dept = employee.departmentId ? deptById.get(employee.departmentId) : null;
      const position = employee.positionId ? posById.get(employee.positionId) : null;

      return {
        ...employee,
        manager: managerData,
        department: dept
          ? {
              id: dept.id,
              name: dept.name,
              parentDepartment: dept.parentId ? { name: deptNameById.get(dept.parentId) || 'Unknown' } : null
            }
          : null,
        positionRole: position ? { id: position.id, title: position.title } : null,
        teamMemberships: [],
        departmentHeadOf,
        teamLeadOf
      };
    });
  }, [profilesQuery.data, departments, teams, positions]);

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
      } else if (viewMode === 'functions') {
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
    return (
      <div key={employee.id} className="space-y-2">
        <Card
          className="hover:shadow-md transition-shadow cursor-pointer"
          style={{ marginLeft: `${Math.min(level * 4, 16) * 4}px` }}
              onClick={() => onEmployeeClick?.({ id: employee.id })}>
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

  const departmentCards = (() => {
    const base = departments
      .map((dept: any) => {
        const head = dept.headId ? employees.find(e => e.id === dept.headId) : null;
        const memberCount = employees.filter((e) => e.department?.id === dept.id).length;
        return {
          id: dept.id,
          name: dept.name,
          description: dept.description,
          headId: dept.headId,
          head: head ? { id: head.id, fullName: head.fullName, avatarUrl: head.avatarUrl } : null,
          memberCount,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return selectedDepartment && selectedDepartment !== 'none'
      ? base.filter((d) => d.id === selectedDepartment)
      : base;
  })();

  const teamSections = (() => {
    const base = teams
      .map((team: any) => ({
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Departments View */}
      {viewMode === 'departments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departmentCards.map((dept) => (
            <Card 
              key={dept.id} 
              className="hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => navigate(`/department/${dept.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{dept.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1">{dept.memberCount} members</Badge>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {dept.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{dept.description}</p>
                )}
                {dept.head && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={dept.head.avatarUrl || ''} />
                      <AvatarFallback className="text-xs">{getInitials(dept.head.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <Crown className="h-3 w-3 text-yellow-500" />
                        <span className="text-xs text-muted-foreground">Department Head</span>
                      </div>
                      <p className="text-sm font-medium truncate">{dept.head.fullName}</p>
                    </div>
                  </div>
                )}
                {!dept.head && (
                  <div className="flex items-center gap-2 pt-2 border-t text-muted-foreground">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="text-sm">No head assigned</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {departmentCards.length === 0 && (
            <div className="col-span-full">
              <EmptyState icon={Building2} title="No departments yet" description="Create departments in Org settings to organize your team." />
            </div>
          )}
        </div>
      )}

      {/* Functions View - Search and Filters */}
      {viewMode === 'functions' && (
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by function" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All Functions</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Hierarchy/Performance/etc. View - Search */}
      {(viewMode === 'hierarchy' || viewMode === 'performance') && (
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}


      {/* Functions View */}
      {viewMode === 'functions' && (
        <div className="space-y-6">
          {teamSections.teams.map(({ id, name, employees: teamEmployees }) => (
            <Card key={id}>
              <CardHeader className="pb-3">
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded-lg transition-colors group"
                  onClick={() => navigate(`/function/${id}`)}
                >
                  <Users className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{name}</CardTitle>
                  <Badge variant="secondary">{teamEmployees.length} members</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardHeader>
              <CardContent>
                {teamEmployees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members assigned yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {teamEmployees.map((employee) => (
                      <Card 
                        key={`${employee.id}-${id}`} 
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => onEmployeeClick?.({ id: employee.id })}
                      >
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
                              <h4 className="font-semibold text-sm truncate">{employee.fullName}</h4>
                              <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
                              {employee.positionRole && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {employee.positionRole.title}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {(selectedTeam === '' || selectedTeam === 'none') && teamSections.noTeams.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">No Functions</CardTitle>
                  <Badge variant="secondary">{teamSections.noTeams.length} members</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {teamSections.noTeams.map((employee) => (
                    <Card
                      key={`${employee.id}-no-team`}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => onEmployeeClick?.({ id: employee.id })}
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
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Hierarchy View */}
      {viewMode === 'hierarchy' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              <CardTitle>Organizational Hierarchy</CardTitle>
              <Badge variant="secondary">{filteredEmployees.length} employees</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {buildHierarchy(filteredEmployees).map(topLevelEmployee => 
                renderHierarchyNode(topLevelEmployee)
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance View */}
      {viewMode === 'performance' && (
        <ManagerPerformanceReviewDashboard />
      )}

      {/* Time Off View */}
      {viewMode === 'timeoff' && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Time Off Management</h3>
              <p className="text-muted-foreground">View and manage employee time off requests, vacation calendar, and PTO balances.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overtime View */}
      {viewMode === 'overtime' && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Overtime Tracking</h3>
              <p className="text-muted-foreground">Monitor overtime hours, approve requests, and track compensation.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bounties View */}
      {viewMode === 'bounties' && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Achievement Bounties</h3>
              <p className="text-muted-foreground">Recognition system for outstanding achievements and milestone rewards.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Core Values View */}
      {viewMode === 'core-values' && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Heart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Core Values</h3>
              <p className="text-muted-foreground">Track alignment with company values and provide feedback on value-driven behavior.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Growth Journey View */}
      {viewMode === 'growth-journey' && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Growth Journey</h3>
              <p className="text-muted-foreground">Monitor employee development, career progression, and skill advancement.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Academy View */}
      {viewMode === 'academy' && <AcademyDashboard />}

      {/* Empty State */}
      {filteredEmployees.length === 0 && (viewMode === 'departments' || viewMode === 'functions' || viewMode === 'hierarchy') && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground">No employees found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filter criteria.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
