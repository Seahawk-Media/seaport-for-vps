import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Crown } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import { useRole } from '@/hooks/useRole';
import { useOrganization } from '@/hooks/useOrganization';

interface Profile {
  id: string;
  fullName: string;
  email: string;
  jobTitle?: string | null;
  departmentId?: string | null;
  location?: string | null;
  status?: string | null;
  avatarUrl?: string | null;
  managerId?: string | null;
}

interface EmployeeSidebarProps {
  employee: Profile;
  onEmployeeUpdate?: () => void;
}

export const EmployeeSidebar = ({ employee, onEmployeeUpdate }: EmployeeSidebarProps) => {
  const { organization } = useOrganization();
  const [editData, setEditData] = useState({
    fullName: employee.fullName || '',
    jobTitle: employee.jobTitle || '',
    location: employee.location || '',
    managerId: employee.managerId || ''
  });
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin } = useRole();

  const canEdit = isAdmin() || isSuperAdmin();

  const { data: profiles = [] } = trpc.profiles.list.useQuery(undefined, { enabled: canEdit });
  const { data: departments = [] } = trpc.departments.list.useQuery();
  const { data: teams = [] } = trpc.teams.list.useQuery();

  // Compute leadership roles from departments and teams data
  const leadershipRoles = {
    isDepartmentHead: departments.some((d: any) => d.headId === employee.id),
    isFunctionLead: teams.some((t: any) => t.teamLeadId === employee.id),
    departmentName: departments.find((d: any) => d.headId === employee.id)?.name,
    functionNames: teams.filter((t: any) => t.teamLeadId === employee.id).map((t: any) => t.name),
  };

  const updateProfileMutation = trpc.profiles.update.useMutation({
    onSuccess: () => {
      toast({ title: "Success", description: "Profile updated successfully" });
      onEmployeeUpdate?.();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
    },
  });

  useEffect(() => {
    setEditData({
      fullName: employee.fullName || '',
      jobTitle: employee.jobTitle || '',
      location: employee.location || '',
      managerId: employee.managerId || ''
    });
  }, [employee]);

  const handleFieldUpdate = (field: string, value: string) => {
    if (!canEdit) return;

    const updateData: any = {};
    if (field === 'managerId') {
      updateData[field] = value === 'none' ? undefined : value || undefined;
    } else {
      updateData[field] = value || undefined;
    }

    updateProfileMutation.mutate(updateData);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12">
              <AvatarImage src={employee.avatarUrl || undefined} />
              <AvatarFallback className="text-sm">{getInitials(employee.fullName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              {canEdit ? (
                <Input
                  value={editData.fullName}
                  onChange={(e) => setEditData(prev => ({ ...prev, fullName: e.target.value }))}
                  onBlur={(e) => handleFieldUpdate('fullName', e.target.value)}
                  className="text-lg font-semibold border-none px-0 h-auto focus-visible:ring-0"
                  placeholder="Employee Name"
                />
              ) : (
                <h3 className="text-lg font-semibold truncate">{employee.fullName}</h3>
              )}
              <p className="text-sm text-muted-foreground truncate">{employee.email}</p>
              {(leadershipRoles.isDepartmentHead || leadershipRoles.isFunctionLead) && (
                <div className="flex items-center gap-1 mt-1">
                  <Crown className="w-3 h-3 text-yellow-500" />
                  <span className="text-xs text-yellow-600">Leadership Role</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Leadership Roles */}
          {(leadershipRoles.isDepartmentHead || leadershipRoles.isFunctionLead) && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Leadership Roles</span>
              </div>
              <div className="space-y-1">
                {leadershipRoles.isDepartmentHead && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Department Head: {leadershipRoles.departmentName}
                  </p>
                )}
                {leadershipRoles.isFunctionLead && leadershipRoles.functionNames.length > 0 && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Function Lead: {leadershipRoles.functionNames.join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Job Title</label>
            {canEdit ? (
              <Input
                value={editData.jobTitle}
                onChange={(e) => setEditData(prev => ({ ...prev, jobTitle: e.target.value }))}
                onBlur={(e) => handleFieldUpdate('jobTitle', e.target.value)}
                className="mt-1 h-8"
                placeholder="Enter job title"
              />
            ) : (
              <p className="text-sm mt-1">{employee.jobTitle || 'Not specified'}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Manager</label>
            {canEdit ? (
              <Select
                value={editData.managerId}
                onValueChange={(value) => {
                  setEditData(prev => ({ ...prev, managerId: value }));
                  handleFieldUpdate('managerId', value);
                }}
              >
                <SelectTrigger className="mt-1 h-8">
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Manager</SelectItem>
                  {profiles
                    .filter((p: any) => p.id !== employee.id)
                    .map((manager: any) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm mt-1">
                {profiles.find((p: any) => p.id === employee.managerId)?.fullName || 'No manager assigned'}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Location</label>
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              {canEdit ? (
                <Input
                  value={editData.location}
                  onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))}
                  onBlur={(e) => handleFieldUpdate('location', e.target.value)}
                  className="flex-1 h-8"
                  placeholder="Enter location"
                />
              ) : (
                <p className="text-sm">{employee.location || 'Not specified'}</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Status</label>
            <p className="text-sm mt-1">{employee.status || 'active'}</p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};
