import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, ChevronUp, ChevronDown, MoreHorizontal, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { useOrganization } from "@/hooks/useOrganization";
import { InviteUser } from "@/components/admin/InviteUser";

interface ProfileWithExtras {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  location: string | null;
  status: string | null;
  managerId: string | null;
  manager?: {
    id: string;
    fullName: string;
  } | null;
  department: {
    id: string;
    name: string;
  } | null;
  positionRole: {
    id: string;
    title: string;
  } | null;
  userRoles: Array<{
    role: string;
  }>;
  teamMemberships: Array<{
    id: string;
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

type SortField = 'fullName' | 'email' | 'department' | 'positionRole' | 'manager' | 'employeeStatus' | 'hireDate';
type SortDirection = 'asc' | 'desc';

export const EmployeeDirectoryTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('fullName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingCell, setEditingCell] = useState<{profileId: string, field: string} | null>(null);

  const { toast } = useToast();
  const { assignRole } = useRole();
  const { organization } = useOrganization();

  const utils = trpc.useUtils();

  const { data: profilesRaw, isLoading: loading } = trpc.profiles.list.useQuery();
  const { data: departmentsRaw } = trpc.departments.list.useQuery();
  const { data: positionsRaw } = trpc.positions.listRoles.useQuery();
  const { data: teamsRaw } = trpc.teams.list.useQuery();

  const profiles: ProfileWithExtras[] = (profilesRaw || []) as ProfileWithExtras[];
  const departments: Department[] = (departmentsRaw ?? []).map((d) => ({ id: d.id, name: d.name }));
  const positions: PositionRole[] = (positionsRaw ?? []) as PositionRole[];
  const teams: Team[] = (teamsRaw ?? []).map((t) => ({ id: t.id, name: t.name }));

  const updateProfile = trpc.profiles.update.useMutation({
    onSuccess: (_, variables) => {
      utils.profiles.list.invalidate();
      toast({ title: "Success", description: "Updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    },
  });

  const addTeamMember = trpc.teamMembers.add.useMutation({
    onSuccess: () => {
      utils.profiles.list.invalidate();
      toast({ title: "Success", description: "User added to team successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add user to team", variant: "destructive" });
    },
  });

  const removeTeamMember = trpc.teamMembers.remove.useMutation({
    onSuccess: () => {
      utils.profiles.list.invalidate();
      toast({ title: "Success", description: "User removed from team successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove user from team", variant: "destructive" });
    },
  });

  const updateField = async (profileId: string, field: string, value: string) => {
    try {
      switch (field) {
        case 'location':
          updateProfile.mutate({ location: value || undefined });
          break;
        case 'department':
          updateProfile.mutate({ departmentId: value === 'none' ? undefined : value || undefined });
          break;
        case 'position':
          updateProfile.mutate({ positionId: value === 'none' ? undefined : value || undefined });
          break;
        case 'manager':
          if (profileId === value) {
            toast({ title: "Error", description: "User cannot be their own manager", variant: "destructive" });
            return;
          }
          // TODO: Circular relationship check should be done server-side in tRPC
          updateProfile.mutate({ managerId: value === 'none' ? undefined : value || undefined });
          break;
        case 'role':
          await assignRole(profiles.find(p => p.id === profileId)?.userId || '', value);
          utils.profiles.list.invalidate();
          return;
        case 'status':
        case 'employee_status':
          updateProfile.mutate({ status: value || undefined });
          break;
        default:
          updateProfile.mutate({ [field]: value || undefined });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to update ${field}: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`,
        variant: "destructive",
      });
    }
  };

  const addToTeam = async (profileId: string, teamId: string) => {
    addTeamMember.mutate({
      teamId,
      profileId,
      role: 'member',
    });
  };

  const removeFromTeam = async (profileId: string, teamId: string) => {
    // TODO: teamMembers.remove expects {id} not {profileId, teamId} - may need adjustment
    // For now, find the membership id from the profile data
    const profile = profiles.find(p => p.id === profileId);
    const membership = profile?.teamMemberships.find(tm => tm.team.id === teamId);
    if (membership?.id) {
      removeTeamMember.mutate({ id: membership.id });
    } else {
      toast({ title: "Error", description: "Could not find team membership to remove", variant: "destructive" });
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
      profile.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.department?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.positionRole?.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: string;
      let bValue: string;

      switch (sortField) {
        case 'fullName':
          aValue = a.fullName;
          bValue = b.fullName;
          break;
        case 'email':
          aValue = a.email;
          bValue = b.email;
          break;
        case 'department':
          aValue = a.department?.name || '';
          bValue = b.department?.name || '';
          break;
        case 'positionRole':
          aValue = a.positionRole?.title || '';
          bValue = b.positionRole?.title || '';
          break;
        case 'manager':
          aValue = a.manager?.fullName || '';
          bValue = b.manager?.fullName || '';
          break;
        case 'employeeStatus':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'hireDate':
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
                  <SortableHeader field="fullName">Employee</SortableHeader>
                  <TableHead>Contact</TableHead>
                  <SortableHeader field="department">Department</SortableHeader>
                  <SortableHeader field="positionRole">Position</SortableHeader>
                  <SortableHeader field="manager">Manager</SortableHeader>
                  <TableHead>Teams</TableHead>
                  <TableHead>Role</TableHead>
                  <SortableHeader field="employeeStatus">Status</SortableHeader>
                  <SortableHeader field="hireDate">Hire Date</SortableHeader>
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
                          <AvatarImage src={profile.avatarUrl || ''} />
                          <AvatarFallback>{getInitials(profile.fullName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{profile.fullName}</div>
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
                        value={profile.positionRole?.id || 'none'}
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
                            .map(p => ({ value: p.id, label: p.fullName }))
                        ]}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {profile.teamMemberships.map((membership, idx) => (
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
                              .filter(team => !profile.teamMemberships.some(tm => tm.team.id === team.id))
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
                        value={profile.userRoles[0]?.role || 'employee'}
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
          onInviteSent={() => utils.profiles.list.invalidate()}
          organizationId={organization.id}
        />
      )}
    </div>
  );
};
