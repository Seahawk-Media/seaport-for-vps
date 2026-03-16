import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRole } from '@/hooks/useRole';
import { useOrganization } from '@/hooks/useOrganization';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  job_title?: string;
  department_id?: string;
  location?: string;
  status?: string;
  avatar_url?: string;
  manager_id?: string;
}

interface EmployeeSidebarProps {
  employee: Profile;
  onEmployeeUpdate?: () => void;
}

export const EmployeeSidebar = ({ employee, onEmployeeUpdate }: EmployeeSidebarProps) => {
  const { organization } = useOrganization();
  const [editData, setEditData] = useState({
    full_name: employee.full_name || '',
    job_title: employee.job_title || '',
    location: employee.location || '',
    manager_id: employee.manager_id || ''
  });
  const [profiles, setProfiles] = useState<{id: string; full_name: string}[]>([]);
  const [leadershipRoles, setLeadershipRoles] = useState<{
    isDepartmentHead: boolean;
    isFunctionLead: boolean;
    departmentName?: string;
    functionNames?: string[];
  }>({
    isDepartmentHead: false,
    isFunctionLead: false
  });
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin } = useRole();
  
  const canEdit = isAdmin() || isSuperAdmin();

  useEffect(() => {
    if (canEdit) {
      fetchProfiles();
    }
    fetchLeadershipRoles();
    setEditData({
      full_name: employee.full_name || '',
      job_title: employee.job_title || '',
      location: employee.location || '',
      manager_id: employee.manager_id || ''
    });
  }, [canEdit, employee]);

  const fetchProfiles = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const fetchLeadershipRoles = async () => {
    try {
      const { data: departments } = await supabase
        .from('departments')
        .select('name')
        .eq('head_id', employee.id);

      const { data: teams } = await supabase
        .from('teams')
        .select('name')
        .eq('team_lead_id', employee.id);

      setLeadershipRoles({
        isDepartmentHead: (departments && departments.length > 0),
        isFunctionLead: (teams && teams.length > 0),
        departmentName: departments?.[0]?.name,
        functionNames: teams?.map(t => t.name) || []
      });
    } catch (error) {
      console.error('Error fetching leadership roles:', error);
    }
  };

  const handleFieldUpdate = async (field: string, value: string) => {
    if (!canEdit) return;
    
    try {
      const updateData: any = {};
      if (field === 'manager_id') {
        updateData[field] = value === 'none' ? null : value || null;
      } else {
        updateData[field] = value || null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', employee.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully"
      });
      
      onEmployeeUpdate?.();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
      });
    }
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
              <AvatarImage src={employee.avatar_url} />
              <AvatarFallback className="text-sm">{getInitials(employee.full_name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              {canEdit ? (
                <Input
                  value={editData.full_name}
                  onChange={(e) => setEditData(prev => ({ ...prev, full_name: e.target.value }))}
                  onBlur={(e) => handleFieldUpdate('full_name', e.target.value)}
                  className="text-lg font-semibold border-none px-0 h-auto focus-visible:ring-0"
                  placeholder="Employee Name"
                />
              ) : (
                <h3 className="text-lg font-semibold truncate">{employee.full_name}</h3>
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
                {leadershipRoles.isFunctionLead && leadershipRoles.functionNames && (
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
                value={editData.job_title}
                onChange={(e) => setEditData(prev => ({ ...prev, job_title: e.target.value }))}
                onBlur={(e) => handleFieldUpdate('job_title', e.target.value)}
                className="mt-1 h-8"
                placeholder="Enter job title"
              />
            ) : (
              <p className="text-sm mt-1">{employee.job_title || 'Not specified'}</p>
            )}
          </div>
          
          <div>
            <label className="text-sm font-medium text-muted-foreground">Manager</label>
            {canEdit ? (
              <Select
                value={editData.manager_id}
                onValueChange={(value) => {
                  setEditData(prev => ({ ...prev, manager_id: value }));
                  handleFieldUpdate('manager_id', value);
                }}
              >
                <SelectTrigger className="mt-1 h-8">
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Manager</SelectItem>
                  {profiles
                    .filter(p => p.id !== employee.id)
                    .map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm mt-1">
                {profiles.find(p => p.id === employee.manager_id)?.full_name || 'No manager assigned'}
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
