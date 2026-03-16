import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRole, type AppRole } from '@/hooks/useRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Crown, Users, User, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ProfileWithRoles {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  job_title?: string;
  department_id?: string;
  status?: string;
  avatar_url?: string;
  roles: AppRole[];
  highest_role: AppRole;
}

export const AdminPanel = () => {
  const { isSuperAdmin, isAdmin, assignRole, loading: roleLoading } = useRole();
  const [profiles, setProfiles] = useState<ProfileWithRoles[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && (isSuperAdmin() || isAdmin())) {
      fetchProfilesWithRoles();
    } else if (!roleLoading) {
      setLoading(false);
    }
  }, [roleLoading, isSuperAdmin, isAdmin]);

  const fetchProfilesWithRoles = async () => {
    try {
      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine data
      const profilesWithRoles = profilesData.map(profile => {
        const userRoles = rolesData
          .filter(role => role.user_id === profile.user_id)
          .map(role => role.role as AppRole);

        const roleHierarchy: Record<AppRole, number> = {
          'super_admin': 1,
          'admin': 2,
          'manager': 3,
          'employee': 4
        };

        const highestRole = userRoles.length > 0 
          ? userRoles.sort((a, b) => roleHierarchy[a] - roleHierarchy[b])[0]
          : 'employee' as AppRole;

        return {
          ...profile,
          roles: userRoles,
          highest_role: highestRole
        };
      });

      setProfiles(profilesWithRoles);
    } catch (error) {
      console.error('Error fetching profiles with roles:', error);
      toast({
        title: "Error",
        description: "Failed to load user data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleAssignment = async (userId: string, role: AppRole) => {
    const result = await assignRole(userId, role);
    
    if (result.success) {
      toast({
        title: "Success",
        description: `Role ${role} assigned successfully`
      });
      fetchProfilesWithRoles(); // Refresh data
    } else {
      toast({
        title: "Error",
        description: "Failed to assign role",
        variant: "destructive"
      });
    }
  };

  const getRoleIcon = (role: AppRole) => {
    switch (role) {
      case 'super_admin': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'manager': return <Users className="w-4 h-4 text-green-500" />;
      case 'employee': return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeColor = (role: AppRole) => {
    switch (role) {
      case 'super_admin': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'admin': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'manager': return 'bg-green-100 text-green-800 border-green-200';
      case 'employee': return 'bg-gray-100 text-gray-800 border-gray-200';
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

  // Show loading state while roles are being fetched
  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Only show access denied AFTER loading completes
  if (!isSuperAdmin() && !isAdmin()) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to access this admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
        <Badge variant="secondary">{profiles.length} users</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((profile) => (
          <Card key={profile.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate flex items-center gap-2">
                    {profile.full_name}
                    {getRoleIcon(profile.highest_role)}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {profile.roles.length > 0 ? (
                  profile.roles.map((role) => (
                    <Badge 
                      key={role} 
                      variant="outline" 
                      className={getRoleBadgeColor(role)}
                    >
                      {role.replace('_', ' ')}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className={getRoleBadgeColor('employee')}>
                    employee
                  </Badge>
                )}
              </div>

              {profile.job_title && (
                <p className="text-sm text-muted-foreground">
                  {profile.job_title}
                </p>
              )}

              {(isSuperAdmin() || (isAdmin() && profile.highest_role !== 'super_admin')) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assign Role:</label>
                  <div className="flex gap-2">
                    <Select onValueChange={(role) => handleRoleAssignment(profile.user_id, role as AppRole)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {isSuperAdmin() && (
                          <>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </>
                        )}
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};