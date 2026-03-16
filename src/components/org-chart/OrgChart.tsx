import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Building, MapPin, Crown, Shield, User, Search, Settings, LayoutGrid, GitBranch, ChevronDown, ChevronRight, List } from 'lucide-react';
import { useRole, type AppRole } from '@/hooks/useRole';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { EmployeeDirectoryTable } from '@/components/admin/EmployeeDirectoryTable';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  job_title?: string;
  department_id?: string;
  location?: string;
  status?: string;
  avatar_url?: string;
  manager_id?: string;
  app_role?: AppRole;
}

interface Department {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  department_id?: string;
}

interface TeamMembership {
  team_id: string;
  team: { id: string; name: string };
}

interface OrgChartProps {
  onEmployeeClick: (employeeId: string) => void;
  onAdminClick?: () => void;
}

type ViewMode = 'cards' | 'hierarchy' | 'table';

export const OrgChart = ({ onEmployeeClick, onAdminClick }: OrgChartProps) => {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMemberships, setTeamMemberships] = useState<Map<string, TeamMembership[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterFunction, setFilterFunction] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const { isSuperAdmin, isAdmin, assignRole } = useRole();
  const { toast } = useToast();

  const canEdit = isSuperAdmin() || isAdmin();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profilesRes, rolesRes, departmentsRes, teamsRes, membershipsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('teams').select('id, name').order('name'),
        supabase.from('team_members').select('profile_id, team_id, team:teams(id, name)')
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (teamsRes.error) throw teamsRes.error;
      if (membershipsRes.error) throw membershipsRes.error;

      // Build role hierarchy
      const roleHierarchy: Record<AppRole, number> = {
        'super_admin': 1,
        'admin': 2,
        'manager': 3,
        'employee': 4
      };

      const employeesWithRoles = profilesRes.data.map(profile => {
        const userRoles = rolesRes.data.filter(role => role.user_id === profile.user_id);
        const highestRole = userRoles.length > 0 
          ? userRoles.sort((a, b) => roleHierarchy[a.role as AppRole] - roleHierarchy[b.role as AppRole])[0].role
          : 'employee';

        return { ...profile, app_role: highestRole as AppRole };
      });

      // Build team memberships map
      const membershipMap = new Map<string, TeamMembership[]>();
      membershipsRes.data?.forEach((m: any) => {
        const existing = membershipMap.get(m.profile_id) || [];
        existing.push({ team_id: m.team_id, team: m.team });
        membershipMap.set(m.profile_id, existing);
      });

      setEmployees(employeesWithRoles || []);
      setDepartments(departmentsRes.data || []);
      setTeams(teamsRes.data || []);
      setTeamMemberships(membershipMap);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDepartment = async (profileId: string, departmentId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ department_id: departmentId === 'none' ? null : departmentId })
        .eq('id', profileId);

      if (error) throw error;
      toast({ title: "Department updated" });
      fetchData();
    } catch (error) {
      console.error('Error updating department:', error);
      toast({ title: "Error", description: "Failed to update department", variant: "destructive" });
    }
  };

  const updateManager = async (profileId: string, managerId: string) => {
    if (profileId === managerId) {
      toast({ title: "Error", description: "User cannot be their own manager", variant: "destructive" });
      return;
    }

    // Check for circular relationship
    const wouldCreateCircle = await checkCircularRelationship(profileId, managerId);
    if (wouldCreateCircle) {
      toast({ title: "Error", description: "This would create a circular manager relationship", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ manager_id: managerId === 'none' ? null : managerId })
        .eq('id', profileId);

      if (error) throw error;
      toast({ title: "Manager updated" });
      fetchData();
    } catch (error) {
      console.error('Error updating manager:', error);
      toast({ title: "Error", description: "Failed to update manager", variant: "destructive" });
    }
  };

  const checkCircularRelationship = async (userId: string, newManagerId: string): Promise<boolean> => {
    if (!newManagerId || newManagerId === 'none') return false;
    
    let currentManagerId = newManagerId;
    const visited = new Set([userId]);
    
    while (currentManagerId) {
      if (visited.has(currentManagerId)) return true;
      visited.add(currentManagerId);
      
      const { data } = await supabase
        .from('profiles')
        .select('manager_id')
        .eq('id', currentManagerId)
        .single();
      
      currentManagerId = data?.manager_id || null;
    }
    
    return false;
  };

  const addToTeam = async (profileId: string, teamId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .insert([{ team_id: teamId, profile_id: profileId, role: 'member' }]);

      if (error) throw error;
      toast({ title: "Added to function" });
      fetchData();
    } catch (error) {
      console.error('Error adding to team:', error);
      toast({ title: "Error", description: "Failed to add to function", variant: "destructive" });
    }
  };

  const removeFromTeam = async (profileId: string, teamId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('profile_id', profileId)
        .eq('team_id', teamId);

      if (error) throw error;
      toast({ title: "Removed from function" });
      fetchData();
    } catch (error) {
      console.error('Error removing from team:', error);
      toast({ title: "Error", description: "Failed to remove from function", variant: "destructive" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'onboarding': return 'bg-blue-500';
      case 'active': return 'bg-green-500';
      case 'pip': return 'bg-yellow-500';
      case 'leave': return 'bg-muted-foreground';
      case 'offboarding': return 'bg-destructive';
      default: return 'bg-muted-foreground';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleIcon = (role: AppRole) => {
    switch (role) {
      case 'super_admin': return <Crown className="w-3.5 h-3.5 text-yellow-500" />;
      case 'admin': return <Shield className="w-3.5 h-3.5 text-blue-500" />;
      case 'manager': return <Users className="w-3.5 h-3.5 text-green-500" />;
      case 'employee': return <User className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const filterEmployees = (employees: Profile[]) => {
    return employees.filter(employee => {
      const matchesSearch = employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (employee.job_title && employee.job_title.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesDepartment = filterDepartment === 'all' || employee.department_id === filterDepartment;
      
      // Function filter - check if employee is a member of the selected function
      const employeeTeams = teamMemberships.get(employee.id) || [];
      const matchesFunction = filterFunction === 'all' || employeeTeams.some(tm => tm.team_id === filterFunction);
      
      return matchesSearch && matchesDepartment && matchesFunction;
    });
  };

  const groupByDepartment = (employees: Profile[]) => {
    const filtered = filterEmployees(employees);
    return filtered.reduce((acc, employee) => {
      const deptId = employee.department_id || 'unassigned';
      const deptName = departments.find(d => d.id === deptId)?.name || 'Unassigned';
      if (!acc[deptName]) acc[deptName] = [];
      acc[deptName].push(employee);
      return acc;
    }, {} as Record<string, Profile[]>);
  };

  const buildHierarchy = (employees: Profile[]) => {
    const filtered = filterEmployees(employees);
    const roots = filtered.filter(e => !e.manager_id || !filtered.find(emp => emp.id === e.manager_id));
    
    const addChildren = (employee: Profile): Profile & { children: any[] } => {
      const children = filtered
        .filter(e => e.manager_id === employee.id)
        .map(addChildren);
      return { ...employee, children };
    };
    
    return roots.map(addChildren);
  };

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderHierarchyNode = (employee: Profile & { children: any[] }, level: number = 0) => {
    const hasChildren = employee.children.length > 0;
    const isExpanded = expandedNodes.has(employee.id);
    
    return (
      <div key={employee.id} className="select-none">
        <div 
          className={cn(
            "flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors",
            level > 0 && "ml-6"
          )}
          style={{ marginLeft: level > 0 ? `${level * 24}px` : undefined }}
        >
          {hasChildren ? (
            <button 
              onClick={(e) => { e.stopPropagation(); toggleNode(employee.id); }}
              className="p-0.5 hover:bg-muted rounded"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-5" />
          )}
          
          <div 
            className="flex items-center gap-3 flex-1"
            onClick={() => onEmployeeClick(employee.id)}
          >
            <div className="relative">
              <Avatar className="w-8 h-8">
                <AvatarImage src={employee.avatar_url} />
                <AvatarFallback className="text-xs">{getInitials(employee.full_name)}</AvatarFallback>
              </Avatar>
              <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-background ${getStatusColor(employee.status || 'active')}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-sm truncate">{employee.full_name}</span>
                {employee.app_role && getRoleIcon(employee.app_role)}
              </div>
              <p className="text-xs text-muted-foreground truncate">{employee.job_title || 'No title'}</p>
            </div>
            {employee.children.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {employee.children.length} reports
              </Badge>
            )}
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="border-l border-border ml-5">
            {employee.children.map((child: any) => renderHierarchyNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const groupedEmployees = groupByDepartment(employees);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organization Chart</h1>
          <p className="text-sm text-muted-foreground">Click on any employee to view their journey</p>
        </div>
        {canEdit && onAdminClick && (
          <Button onClick={onAdminClick} variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Admin Panel
          </Button>
        )}
      </div>
      
      {/* Search, Filters, and View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterFunction} onValueChange={setFilterFunction}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Functions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Functions</SelectItem>
              {teams.map(team => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-3"
            onClick={() => setViewMode('cards')}
          >
            <LayoutGrid className="w-4 h-4 mr-1.5" />
            Cards
          </Button>
          <Button
            variant={viewMode === 'hierarchy' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-3"
            onClick={() => setViewMode('hierarchy')}
          >
            <GitBranch className="w-4 h-4 mr-1.5" />
            Hierarchy
          </Button>
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-3"
            onClick={() => setViewMode('table')}
          >
            <List className="w-4 h-4 mr-1.5" />
            Table
          </Button>
        </div>
      </div>

      {/* Hierarchy View */}
      {viewMode === 'hierarchy' && (
        <Card className="p-4">
          <div className="space-y-1">
            {buildHierarchy(employees).map(employee => renderHierarchyNode(employee))}
          </div>
          {filterEmployees(employees).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No employees match your filters
            </div>
          )}
        </Card>
      )}

      {/* Card View - Employee Grid by Department */}
      {viewMode === 'cards' && Object.entries(groupedEmployees).map(([department, deptEmployees]) => (
        <div key={department} className="space-y-3">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{department}</h2>
            <Badge variant="secondary" className="text-xs">{deptEmployees.length}</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {deptEmployees.map((employee) => {
              const employeeTeams = teamMemberships.get(employee.id) || [];
              const manager = employees.find(e => e.id === employee.manager_id);
              const availableTeams = teams.filter(t => !employeeTeams.some(et => et.team_id === t.id));

              return (
                <Card key={employee.id} className="overflow-hidden">
                  {/* Clickable header area */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => onEmployeeClick(employee.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={employee.avatar_url} />
                          <AvatarFallback className="text-sm">{getInitials(employee.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${getStatusColor(employee.status || 'active')}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-medium text-sm truncate">{employee.full_name}</h3>
                          {employee.app_role && getRoleIcon(employee.app_role)}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{employee.job_title || 'No title'}</p>
                        {employee.location && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{employee.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Admin editable section */}
                  {canEdit && (
                    <CardContent className="p-3 pt-0 space-y-2 border-t bg-muted/30">
                      {/* Department */}
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Department</label>
                        <Select 
                          value={employee.department_id || 'none'} 
                          onValueChange={(value) => updateDepartment(employee.id, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Department</SelectItem>
                            {departments.map(dept => (
                              <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Manager */}
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Manager</label>
                        <Select 
                          value={employee.manager_id || 'none'} 
                          onValueChange={(value) => updateManager(employee.id, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select manager" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Manager</SelectItem>
                            {employees
                              .filter(e => e.id !== employee.id)
                              .map(e => (
                                <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Functions (Teams) */}
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Functions</label>
                        <div className="flex flex-wrap gap-1 min-h-[24px]">
                          {employeeTeams.map((membership) => (
                            <Badge 
                              key={membership.team_id} 
                              variant="secondary" 
                              className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                              onClick={() => removeFromTeam(employee.id, membership.team_id)}
                            >
                              {membership.team.name} ×
                            </Badge>
                          ))}
                        </div>
                        {availableTeams.length > 0 && (
                          <Select onValueChange={(value) => addToTeam(employee.id, value)}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="+ Add function" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableTeams.map(team => (
                                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
      
      {viewMode === 'cards' && employees.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No employees found</h3>
          <p className="text-sm text-muted-foreground">Start by adding employee profiles to build your organization chart.</p>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && <EmployeeDirectoryTable />}
    </div>
  );
};
