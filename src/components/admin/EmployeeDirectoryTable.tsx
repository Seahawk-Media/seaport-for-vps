import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Search, Plus, ChevronUp, ChevronDown, MoreHorizontal, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { useOrganization } from "@/hooks/useOrganization";
import { InviteUser } from "@/components/admin/InviteUser";

interface ProfileWithExtras {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  location: string | null;
  status: string | null;
  manager_id: string | null;
  manager?: {
    id: string;
    full_name: string;
  } | null;
  department: {
    id: string;
    name: string;
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
}

interface Department {
  id: string;
  name: string;
}

interface PositionRole {
  id: string;
  title: string;
}

interface Team {
  id: string;
  name: string;
}

type SortField = 'full_name' | 'email' | 'department' | 'position_role' | 'manager' | 'employee_status' | 'hire_date';
type SortDirection = 'asc' | 'desc';

export const EmployeeDirectoryTable: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileWithExtras[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<PositionRole[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingCell, setEditingCell] = useState<{profileId: string, field: string} | null>(null);
  
  const { toast } = useToast();
  const { assignRole } = useRole();
  const { organization } = useOrganization();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profilesRes, departmentsRes, positionsRes, teamsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select(`
            *,
            department:departments!profiles_department_id_fkey(id, name),
            position_role:position_roles(id, title),
            team_memberships:team_members(
              role,
              team:teams(id, name)
            )
          `),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('position_roles').select('id, title').order('title'),
        supabase.from('teams').select('id, name').order('name')
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (positionsRes.error) throw positionsRes.error;
      if (teamsRes.error) throw teamsRes.error;

      const profilesWithRolesAndManagers = await Promise.all(
        (profilesRes.data || []).map(async (profile) => {
          const [userRolesRes, managerRes] = await Promise.all([
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', profile.user_id),
            profile.manager_id ? supabase
              .from('profiles')
              .select('id, full_name')
              .eq('id', profile.manager_id)
              .single() : Promise.resolve({ data: null })
          ]);
          
          return {
            ...profile,
            user_roles: userRolesRes.data || [],
            manager: managerRes.data
          };
        })
      );

      setProfiles(profilesWithRolesAndManagers);
      setDepartments(departmentsRes.data || []);
      setPositions(positionsRes.data || []);
      setTeams(teamsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateField = async (profileId: string, field: string, value: any) => {
    try {
      const updates: any = {};
      
      switch (field) {
        case 'location':
        case 'level':
        case 'employee_status':
        case 'hire_date':
          updates[field] = value || null;
          break;
        case 'department':
          updates.department_id = value === 'none' ? null : value || null;
          break;
        case 'position':
          updates.position_role_id = value === 'none' ? null : value || null;
          break;
        case 'manager':
          if (profileId === value) {
            toast({
              title: "Error",
              description: "User cannot be their own manager",
              variant: "destructive"
            });
            return;
          }
          
          const wouldCreateCircle = await checkCircularRelationship(profileId, value);
          if (wouldCreateCircle) {
            toast({
              title: "Error", 
              description: "This would create a circular manager relationship",
              variant: "destructive"
            });
            return;
          }
          
          updates.manager_id = value === 'none' ? null : value || null;
          break;
        case 'role':
          await assignRole(profiles.find(p => p.id === profileId)?.user_id || '', value);
          fetchData();
          return;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profileId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: `${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully`
      });
      fetchData();
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
      toast({
        title: "Error",
        description: `Failed to update ${field}`,
        variant: "destructive"
      });
    }
  };

  const checkCircularRelationship = async (userId: string, newManagerId: string): Promise<boolean> => {
    if (!newManagerId || newManagerId === 'none') return false;
    
    let currentManagerId = newManagerId;
    const visited = new Set([userId]);
    
    while (currentManagerId) {
      if (visited.has(currentManagerId)) {
        return true;
      }
      
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
        .insert([{
          team_id: teamId,
          profile_id: profileId,
          role_in_team: 'member'
        }]);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "User added to team successfully"
      });
      fetchData();
    } catch (error) {
      console.error('Error adding to team:', error);
      toast({
        title: "Error",
        description: "Failed to add user to team",
        variant: "destructive"
      });
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
      
      toast({
        title: "Success",
        description: "User removed from team successfully"
      });
      fetchData();
    } catch (error) {
      console.error('Error removing from team:', error);
      toast({
        title: "Error",
        description: "Failed to remove user from team",
        variant: "destructive"
      });
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(filteredAndSortedProfiles.map(p => p.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (profileId: string, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(profileId);
    } else {
      newSelected.delete(profileId);
    }
    setSelectedRows(newSelected);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const filteredAndSortedProfiles = profiles
    .filter(profile =>
      profile.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.department?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.position_role?.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'full_name':
          aValue = a.full_name;
          bValue = b.full_name;
          break;
        case 'email':
          aValue = a.email;
          bValue = b.email;
          break;
        case 'department':
          aValue = a.department?.name || '';
          bValue = b.department?.name || '';
          break;
        case 'position_role':
          aValue = a.position_role?.title || '';
          bValue = b.position_role?.title || '';
          break;
        case 'manager':
          aValue = a.manager?.full_name || '';
          bValue = b.manager?.full_name || '';
          break;
        case 'employee_status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'hire_date':
          aValue = '';
          bValue = '';
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const SortableHeader: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <TableHead 
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </TableHead>
  );

  const EditableCell: React.FC<{
    profile: ProfileWithExtras;
    field: string;
    value: string;
    type: 'text' | 'select';
    options?: Array<{value: string, label: string}>;
  }> = ({ profile, field, value, type, options }) => {
    const isEditing = editingCell?.profileId === profile.id && editingCell?.field === field;
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleSave = () => {
      if (localValue !== value) {
        updateField(profile.id, field, localValue);
      }
      setEditingCell(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        setLocalValue(value);
        setEditingCell(null);
      }
    };

    if (type === 'select' && isEditing) {
      return (
        <Select value={localValue} onValueChange={(val) => {
          setLocalValue(val);
          updateField(profile.id, field, val);
          setEditingCell(null);
        }}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options?.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (type === 'text' && isEditing) {
      return (
        <Input
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-8"
          autoFocus
        />
      );
    }

    return (
      <div 
        className="cursor-pointer hover:bg-muted/50 p-1 rounded min-h-[2rem] flex items-center"
        onClick={() => setEditingCell({ profileId: profile.id, field })}
      >
        {field === 'department' ? (
          options?.find(o => o.value === value)?.label || 'No Department'
        ) : field === 'position' ? (
          options?.find(o => o.value === value)?.label || 'No Position' 
        ) : field === 'manager' ? (
          options?.find(o => o.value === value)?.label || 'No Manager'
        ) : field === 'role' ? (
          options?.find(o => o.value === value)?.label || 'Employee'
        ) : field === 'employee_status' ? (
          options?.find(o => o.value === value)?.label || 'Active'
        ) : (
          value || <span className="text-muted-foreground">Click to edit</span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Loading employees...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Employee Directory</h3>
          <p className="text-sm text-muted-foreground">
            Manage all employee information in one place
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
          <Button onClick={() => setShowInviteDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Invite Employee
          </Button>
        </div>
      </div>

      {selectedRows.size > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedRows.size} employee(s) selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Bulk Edit
              </Button>
              <Button variant="outline" size="sm">
                Export Selected
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="relative overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedRows.size === filteredAndSortedProfiles.length && filteredAndSortedProfiles.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <SortableHeader field="full_name">Employee</SortableHeader>
                  <TableHead>Contact</TableHead>
                  <SortableHeader field="department">Department</SortableHeader>
                  <SortableHeader field="position_role">Position</SortableHeader>
                  <SortableHeader field="manager">Manager</SortableHeader>
                  <TableHead>Teams</TableHead>
                  <TableHead>Role</TableHead>
                  <SortableHeader field="employee_status">Status</SortableHeader>
                  <SortableHeader field="hire_date">Hire Date</SortableHeader>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedProfiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRows.has(profile.id)}
                        onCheckedChange={(checked) => handleSelectRow(profile.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={profile.avatar_url || ''} />
                          <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{profile.full_name}</div>
                          <div className="text-sm text-muted-foreground">{profile.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <EditableCell
                          profile={profile}
                          field="location"
                          value={profile.location || ''}
                          type="text"
                        />
                        <div className="text-xs text-muted-foreground">Location</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <EditableCell
                        profile={profile}
                        field="department"
                        value={profile.department?.id || 'none'}
                        type="select"
                        options={[
                          { value: 'none', label: 'No Department' },
                          ...departments.map(d => ({ value: d.id, label: d.name }))
                        ]}
                      />
                    </TableCell>
                    <TableCell>
                      <EditableCell
                        profile={profile}
                        field="position"
                        value={profile.position_role?.id || 'none'}
                        type="select"
                        options={[
                          { value: 'none', label: 'No Position' },
                          ...positions.map(p => ({ value: p.id, label: p.title }))
                        ]}
                      />
                    </TableCell>
                    <TableCell>
                      <EditableCell
                        profile={profile}
                        field="manager"
                        value={profile.manager?.id || 'none'}
                        type="select"
                        options={[
                          { value: 'none', label: 'No Manager' },
                          ...profiles
                            .filter(p => p.id !== profile.id)
                            .map(p => ({ value: p.id, label: p.full_name }))
                        ]}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {profile.team_memberships.map((membership, idx) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => removeFromTeam(profile.id, membership.team.id)}
                            >
                              {membership.team.name}
                              <X className="ml-1 h-3 w-3" />
                            </Badge>
                          ))}
                        </div>
                        <Select onValueChange={(value) => addToTeam(profile.id, value)}>
                          <SelectTrigger className="h-6 text-xs">
                            <SelectValue placeholder="+ Add to team" />
                          </SelectTrigger>
                          <SelectContent>
                            {teams
                              .filter(team => !profile.team_memberships.some(tm => tm.team.id === team.id))
                              .map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>
                      <EditableCell
                        profile={profile}
                        field="role"
                        value={profile.user_roles[0]?.role || 'employee'}
                        type="select"
                        options={[
                          { value: 'employee', label: 'Employee' },
                          { value: 'manager', label: 'Manager' },
                          { value: 'admin', label: 'Admin' },
                          { value: 'super_admin', label: 'Super Admin' }
                        ]}
                      />
                    </TableCell>
                    <TableCell>
                      <EditableCell
                        profile={profile}
                        field="status"
                        value={profile.status || 'active'}
                        type="select"
                        options={[
                          { value: 'active', label: 'Active' },
                          { value: 'inactive', label: 'Inactive' },
                          { value: 'terminated', label: 'Terminated' }
                        ]}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">-</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Profile</DropdownMenuItem>
                          <DropdownMenuItem>View Journey</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Deactivate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {organization && (
        <InviteUser
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          onInviteSent={fetchData}
          organizationId={organization.id}
        />
      )}
    </div>
  );
};