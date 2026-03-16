import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Search, Plus, UserPlus, Mail, Crown, XCircle, Trash2, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { useOrganization } from "@/hooks/useOrganization";
import { InviteUser } from "@/components/admin/InviteUser";
import { CreateUser } from "@/components/admin/CreateUser";

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

interface ProfileWithExtras {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
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

export const UserManagementSettings: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileWithExtras[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<PositionRole[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteConfirmProfile, setDeleteConfirmProfile] = useState<ProfileWithExtras | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { assignRole } = useRole();
  const { organization } = useOrganization();

  useEffect(() => {
    fetchData();
    fetchPendingInvites();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
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

      // Fetch user roles and manager data separately and merge
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
          
          console.log('Profile:', profile.full_name, 'Manager ID:', profile.manager_id, 'Manager fetched:', managerRes.data);
          
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

  const fetchPendingInvites = async () => {
    if (!organization) return;
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('id, email, role, created_at')
        .eq('organization_id', organization.id)
        .eq('accepted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingInvites(data || []);
    } catch (error) {
      console.error('Error fetching pending invites:', error);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    const invite = pendingInvites.find(i => i.id === inviteId);
    if (!invite || !organization) return;

    try {
      const { data, error } = await supabase.functions.invoke('revoke-invite', {
        body: {
          email: invite.email,
          organizationId: organization.id,
        },
      });

      if (error) throw error;

      toast({ title: data?.message || "Invitation revoked" });
      fetchPendingInvites();
    } catch (error: any) {
      console.error('Error revoking invite:', error);
      toast({ title: "Error", description: error.message || "Failed to revoke invitation", variant: "destructive" });
    }
  };

  const isLastSuperAdmin = (userIdToCheck: string): boolean => {
    const superAdmins = profiles.filter(p =>
      Array.isArray(p.user_roles) && p.user_roles.some((r: any) => r.role === 'super_admin')
    );
    return superAdmins.length <= 1 && superAdmins.some(p => p.user_id === userIdToCheck);
  };

  const canDeleteUser = (profile: ProfileWithExtras): boolean => {
    if (profile.user_id === currentUserId) return false;
    if (organization?.created_by === profile.user_id) return false;
    if (isLastSuperAdmin(profile.user_id)) return false;
    return true;
  };

  const deleteUser = async (profile: ProfileWithExtras) => {
    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId: profile.user_id },
      });
      if (error) {
        let message = error.message;
        const context = (error as { context?: Response }).context;
        if (context instanceof Response) {
          try {
            const errorBody = await context.json();
            if (errorBody?.error) message = errorBody.error;
          } catch {}
        }
        throw new Error(message);
      }
      toast({ title: "User removed", description: `${profile.full_name} has been removed from the organisation.` });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete user", variant: "destructive" });
    } finally {
      setDeleteConfirmProfile(null);
    }
  };

  const isOrgCreator = (profile: ProfileWithExtras): boolean => {
    return organization?.created_by === profile.user_id;
  };

  const updateUserDepartment = async (userId: string, departmentId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ department_id: departmentId === 'none' ? null : departmentId || null })
        .eq('id', userId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "User department updated successfully"
      });
      fetchData();
    } catch (error) {
      console.error('Error updating department:', error);
      toast({
        title: "Error",
        description: "Failed to update user department",
        variant: "destructive"
      });
    }
  };

  const updateUserPosition = async (userId: string, positionId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ position_id: positionId === 'none' ? null : positionId || null })
        .eq('id', userId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "User position updated successfully"
      });
      fetchData();
    } catch (error) {
      console.error('Error updating position:', error);
      toast({
        title: "Error",
        description: "Failed to update user position",
        variant: "destructive"
      });
    }
  };

  const handleRoleAssignment = async (userId: string, role: string) => {
    if (isLastSuperAdmin(userId) && role !== 'super_admin') {
      toast({
        title: "Action blocked",
        description: "Cannot demote the last Super Admin. Promote another user first.",
        variant: "destructive"
      });
      return;
    }

    try {
      await assignRole(userId, role as any);
      toast({
        title: "Success",
        description: "User role updated successfully"
      });
      fetchData();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive"
      });
    }
  };

  const updateUserManager = async (userId: string, managerId: string) => {
    // Prevent circular manager relationships
    if (userId === managerId) {
      toast({
        title: "Error",
        description: "User cannot be their own manager",
        variant: "destructive"
      });
      return;
    }

    // Check if the selected manager would create a circular relationship
    const wouldCreateCircle = await checkCircularRelationship(userId, managerId);
    if (wouldCreateCircle) {
      toast({
        title: "Error",
        description: "This would create a circular manager relationship",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ manager_id: managerId === 'none' ? null : managerId || null })
        .eq('id', userId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "User manager updated successfully"
      });
      console.log('Manager update successful, refetching data...');
      fetchData();
    } catch (error) {
      console.error('Error updating manager:', error);
      toast({
        title: "Error",
        description: "Failed to update user manager",
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
        return true; // Circular relationship detected
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

  const addUserToTeam = async (userId: string, teamId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .insert([{
          team_id: teamId,
          profile_id: userId,
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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div>Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-lg font-semibold">User Management</h3>
            <p className="text-sm text-muted-foreground">
              Assign departments, positions, roles, and teams to users
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">{profiles.length} users</Badge>
            {pendingInvites.length > 0 && (
              <Badge variant="outline">{pendingInvites.length} pending</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
          <Button variant="outline" onClick={() => setShowInviteDialog(true)}>
            <Mail className="w-4 h-4 mr-2" />
            Invite by Email
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredProfiles.map((profile) => (
          <Card key={profile.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4 flex-1">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={profile.avatar_url || ''} />
                  <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                </Avatar>
                
                 <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-w-0">
                   <div className="min-w-0">
                     <h4 className="font-semibold truncate">{profile.full_name}</h4>
                     <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                     {profile.user_roles.length > 0 && (
                       <div className="flex gap-1 mt-1 flex-wrap">
                         {profile.user_roles.map((role, idx) => (
                           <Badge key={idx} variant="secondary" className="text-xs">
                             {role.role.replace('_', ' ')}
                           </Badge>
                         ))}
                       </div>
                     )}
                     {profile.manager && (
                       <p className="text-xs text-muted-foreground mt-1 truncate">
                         Reports to: {profile.manager.full_name}
                       </p>
                     )}
                   </div>

                   <div className="min-w-0">
                     <label className="text-xs font-medium text-muted-foreground">Manager</label>
                     <Select 
                       value={profile.manager?.id || ''} 
                       onValueChange={(value) => updateUserManager(profile.id, value)}
                     >
                       <SelectTrigger className="h-8 w-full">
                         <SelectValue placeholder="Select manager" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="none">No Manager</SelectItem>
                         {profiles
                           .filter(p => p.id !== profile.id) // Can't be their own manager
                           .map((manager) => (
                           <SelectItem key={manager.id} value={manager.id}>
                             {manager.full_name}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>

                   <div className="min-w-0">
                     <label className="text-xs font-medium text-muted-foreground">Department</label>
                     <Select 
                       value={profile.department?.id || ''} 
                       onValueChange={(value) => updateUserDepartment(profile.id, value)}
                     >
                       <SelectTrigger className="h-8 w-full">
                         <SelectValue placeholder="Select department" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="none">No Department</SelectItem>
                         {departments.map((dept) => (
                           <SelectItem key={dept.id} value={dept.id}>
                             {dept.name}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>

                   <div className="min-w-0">
                     <label className="text-xs font-medium text-muted-foreground">Position</label>
                     <Select 
                       value={profile.position_role?.id || ''} 
                       onValueChange={(value) => updateUserPosition(profile.id, value)}
                     >
                       <SelectTrigger className="h-8 w-full">
                         <SelectValue placeholder="Select position" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="none">No Position</SelectItem>
                         {positions.map((pos) => (
                           <SelectItem key={pos.id} value={pos.id}>
                             {pos.title}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>

                   <div className="min-w-0">
                     <label className="text-xs font-medium text-muted-foreground">
                       System Role {isOrgCreator(profile) && <Crown className="inline w-3 h-3 text-primary ml-1" />}
                     </label>
                     <Select 
                       value={profile.user_roles[0]?.role || ''} 
                       onValueChange={(value) => handleRoleAssignment(profile.user_id, value)}
                       disabled={isOrgCreator(profile)}
                     >
                       <SelectTrigger className="h-8 w-full">
                         <SelectValue placeholder="Assign role" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="employee">Employee</SelectItem>
                         <SelectItem value="manager">Manager</SelectItem>
                         <SelectItem value="admin">Admin</SelectItem>
                         <SelectItem value="super_admin">Super Admin</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                 </div>
                {canDeleteUser(profile) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2 text-destructive hover:text-destructive shrink-0"
                    onClick={() => setDeleteConfirmProfile(profile)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {profile.team_memberships.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <label className="text-xs font-medium text-muted-foreground">Teams:</label>
                  <div className="flex gap-1 mt-1">
                    {profile.team_memberships.map((membership, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {membership.team.name} ({membership.role})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 pt-3 border-t">
                <label className="text-xs font-medium text-muted-foreground">Add to Team:</label>
                <Select onValueChange={(value) => addUserToTeam(profile.id, value)}>
                  <SelectTrigger className="h-8 mt-1">
                    <SelectValue placeholder="Select team to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.filter(team => !profile.team_memberships.some(tm => tm.team.id === team.id)).map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending Invitations Section */}
      {pendingInvites.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending Invitations</h4>
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>Invite links expire based on your OTP settings. If users report expired links, go to Supabase Dashboard → Authentication → Configuration → Email → and set OTP Expiry to 86400 (24 hours).</p>
          </div>
          {pendingInvites.map((invite) => (
            <Card key={invite.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{invite.email[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited {new Date(invite.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {invite.role.replace('_', ' ')}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => revokeInvite(invite.id)} className="text-destructive hover:text-destructive">
                  <XCircle className="w-4 h-4 mr-1" />
                  Revoke
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {organization && (
        <InviteUser
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          onInviteSent={() => { fetchData(); fetchPendingInvites(); }}
          organizationId={organization.id}
        />
      )}

      {organization && (
        <CreateUser
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreated={fetchData}
          organizationId={organization.id}
        />
      )}

      <AlertDialog open={!!deleteConfirmProfile} onOpenChange={(open) => !open && setDeleteConfirmProfile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteConfirmProfile?.full_name} from the organisation? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmProfile && deleteUser(deleteConfirmProfile)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};