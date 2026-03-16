import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Search, ChevronRight, Building2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';

interface Team {
  id: string;
  name: string;
  description: string | null;
  departmentId: string | null;
  teamLeadId: string | null;
  teamLead?: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  } | null;
  memberCount: number;
}

export default function FunctionsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const { data: teamsData, isLoading: teamsLoading } = trpc.teams.list.useQuery();
  const { data: departmentsData, isLoading: deptsLoading } = trpc.departments.list.useQuery();
  const { data: profilesData } = trpc.profiles.list.useQuery();

  const loading = teamsLoading || deptsLoading;

  const departments = (departmentsData ?? []).map(d => ({ id: d.id, name: d.name }));

  // Build teams with lead info and member counts
  const teams: Team[] = (teamsData ?? []).map((team: any) => {
    const lead = team.teamLeadId && profilesData
      ? profilesData.find((p: any) => p.id === team.teamLeadId)
      : null;
    return {
      id: team.id,
      name: team.name,
      description: team.description ?? null,
      departmentId: team.departmentId ?? null,
      teamLeadId: team.teamLeadId ?? null,
      teamLead: lead ? { id: lead.id, fullName: lead.fullName, avatarUrl: lead.avatarUrl } : null,
      memberCount: team.memberCount ?? 0,
    };
  });

  const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  const filteredTeams = teams.filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (team.description && team.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDepartment = filterDepartment === 'all' || team.departmentId === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  // Group teams by department
  const groupedTeams = filteredTeams.reduce((acc, team) => {
    const deptId = team.departmentId || 'unassigned';
    const deptName = departments.find(d => d.id === deptId)?.name || 'Unassigned';
    if (!acc[deptName]) acc[deptName] = [];
    acc[deptName].push(team);
    return acc;
  }, {} as Record<string, Team[]>);

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Functions" description="View all functions in your organization">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Functions" description="View all functions in your organization">
      <div className="space-y-6">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search functions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter by Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Functions grouped by department */}
        {Object.entries(groupedTeams).map(([deptName, deptTeams]) => (
          <div key={deptName} className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h2 className="text-lg font-semibold">{deptName}</h2>
              <Badge variant="secondary" className="text-xs">{deptTeams.length} functions</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {deptTeams.map((team) => (
                <Card
                  key={team.id}
                  className="cursor-pointer hover:shadow-md transition-all group"
                  onClick={() => navigate(`/function/${team.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{team.name}</CardTitle>
                          <Badge variant="outline" className="text-xs mt-1">
                            {team.memberCount} members
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {team.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{team.description}</p>
                    )}
                    {team.teamLead && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Lead:</span>
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={team.teamLead.avatarUrl || ''} />
                          <AvatarFallback className="text-xs">{getInitials(team.teamLead.fullName)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{team.teamLead.fullName}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {filteredTeams.length === 0 && (
          <EmptyState
            icon={Users}
            title="No functions found"
            description={searchTerm || filterDepartment !== 'all' ? 'Try adjusting your filters.' : 'Create functions in Org Settings to get started.'}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
