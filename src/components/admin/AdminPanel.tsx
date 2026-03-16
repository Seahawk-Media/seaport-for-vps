import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useRole, type AppRole } from '@/hooks/useRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Crown, Users, User, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export const AdminPanel = () => {
  const { isSuperAdmin, isAdmin, assignRole, loading: roleLoading } = useRole();

  const { data: profiles = [], isLoading: profilesLoading, refetch } = trpc.users.list.useQuery(undefined, {
    enabled: !roleLoading && (isSuperAdmin() || isAdmin()),
  });

  const loading = roleLoading || profilesLoading;

  const handleRoleAssignment = async (userId: string, role: AppRole) => {
    const result = await assignRole(userId, role);

    if (result.success) {
      toast({
        title: "Success",
        description: `Role ${role} assigned successfully`
      });
      refetch();
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

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Show loading state while roles are being fetched
  if (loading) {
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
                  <AvatarImage src={profile.avatarUrl ?? undefined} />
                  <AvatarFallback>{getInitials(profile.fullName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate flex items-center gap-2">
                    {profile.fullName ?? 'Unknown'}
                    {getRoleIcon('employee')}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className={getRoleBadgeColor('employee')}>
                  employee
                </Badge>
              </div>

              {profile.jobTitle && (
                <p className="text-sm text-muted-foreground">
                  {profile.jobTitle}
                </p>
              )}

              {(isSuperAdmin() || isAdmin()) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assign Role:</label>
                  <div className="flex gap-2">
                    <Select onValueChange={(role) => handleRoleAssignment(profile.userId, role as AppRole)}>
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
