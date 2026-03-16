import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, Mail, Crown, XCircle, Trash2, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useOrganization } from "@/hooks/useOrganization";
import { InviteUser } from "@/components/admin/InviteUser";
import { CreateUser } from "@/components/admin/CreateUser";

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

interface ProfileWithExtras {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteConfirmProfile, setDeleteConfirmProfile] = useState<ProfileWithExtras | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { assignRole } = useRole();
  const { organization } = useOrganization();

  const utils = trpc.useUtils();

  const { data: profilesRaw, isLoading: loading } = trpc.profiles.list.useQuery();
  const { data: departmentsRaw } = trpc.departments.list.useQuery();
  const { data: positionsRaw } = trpc.positions.listRoles.useQuery();
  const { data: teamsRaw } = trpc.teams.list.useQuery();
  const { data: invitationsRaw } = trpc.invitations.list.useQuery();

  const profiles: ProfileWithExtras[] = (profilesRaw || []) as ProfileWithExtras[];
  const departments: Department[] = (departmentsRaw ?? []).map((d) => ({ id: d.id, name: d.name }));
  const positions: PositionRole[] = (positionsRaw ?? []) as PositionRole[];
  const teams: Team[] = (teamsRaw ?? []).map((t) => ({ id: t.id, name: t.name }));
  const pendingInvites: PendingInvite[] = (invitationsRaw ?? []).filter((i) => !i.accepted) as PendingInvite[];

  const currentUserId = user?.id || null;

  const updateProfile = trpc.profiles.update.useMutation({
    onSuccess: () => {
      utils.profiles.list.invalidate();
      toast({ title: "Success", description: "User updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user", variant: "destructive" });
    },
  });

  const revokeInviteMutation = trpc.invitations.revoke.useMutation({
    onSuccess: () => {
      utils.invitations.list.invalidate();
      toast({ title: "Invitation revoked" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message || "Failed to revoke invitation", variant: "destructive" });
    },
  });

  const deleteUserMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      utils.profiles.list.invalidate();
      toast({ title: "User removed", description: "User has been removed from the organisation." });
      setDeleteConfirmProfile(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message || "Failed to delete user", variant: "destructive" });
      setDeleteConfirmProfile(null);
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

  const revokeInvite = async (inviteId: string) => {
    revokeInviteMutation.mutate({ id: inviteId });
  };

  const isLastSuperAdmin = (userIdToCheck: string): boolean => {
    const superAdmins = profiles.filter(p =>
      Array.isArray(p.userRoles) && p.userRoles.some((r) => r.role === 'super_admin')
    );
    return superAdmins.length <= 1 && superAdmins.some(p => p.userId === userIdToCheck);
  };

  const canDeleteUser = (profile: ProfileWithExtras): boolean => {
    if (profile.userId === currentUserId) return false;
    if (organization?.created_by === profile.userId) return false;
    if (isLastSuperAdmin(profile.userId)) return false;
    return true;
  };

  const deleteUser = async (profile: ProfileWithExtras) => {
    deleteUserMutation.mutate({ userId: profile.userId });
  };

  const isOrgCreator = (profile: ProfileWithExtras): boolean => {
    return organization?.created_by === profile.userId;
  };

  const updateUserDepartment = async (profileId: string, departmentId: string) => {
    // TODO: profiles.update may not support departmentId directly; adjust if needed
    updateProfile.mutate({ departmentId: departmentId === 'none' ? undefined : departmentId });
  };

  const updateUserPosition = async (profileId: string, positionId: string) => {
    // TODO: profiles.update may not support positionId directly; adjust if needed
    updateProfile.mutate({ positionId: positionId === 'none' ? undefined : positionId });
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
      await assignRole(userId, role);
      toast({ title: "Success", description: "User role updated successfully" });
      utils.profiles.list.invalidate();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  const updateUserManager = async (profileId: string, managerId: string) => {
    if (profileId === managerId) {
      toast({ title: "Error", description: "User cannot be their own manager", variant: "destructive" });
      return;
    }

    // TODO: Circular relationship check would need to be done server-side in tRPC
    updateProfile.mutate({ managerId: managerId === 'none' ? undefined : managerId });
  };

  const addUserToTeam = async (profileId: string, teamId: string) => {
    addTeamMember.mutate({
      teamId,
      profileId,
      role: 'member',
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
                  <AvatarImage src={profile.avatarUrl || ''} />
                  <AvatarFallback>{getInitials(profile.fullName)}</AvatarFallback>
                </Avatar>

                 <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-w-0">
                   <div className="min-w-0">
                     <h4 className="font-semibold truncate">{profile.fullName}</h4>
                     <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                     {profile.userRoles.length > 0 && (
                       <div className="flex gap-1 mt-1 flex-wrap">
                         {profile.userRoles.map((role: { role: string }, idx: number) => (
                           <Badge key={idx} variant="secondary" className="text-xs">
                             {role.role.replace('_', ' ')}
                           </Badge>
                         ))}
                       </div>
                     )}
                     {profile.manager && (
                       <p className="text-xs text-muted-foreground mt-1 truncate">
                         Reports to: {profile.manager.fullName}
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
                           .filter(p => p.id !== profile.id)
                           .map((manager) => (
                           <SelectItem key={manager.id} value={manager.id}>
                             {manager.fullName}
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
                       value={profile.positionRole?.id || ''}
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
                       value={profile.userRoles[0]?.role || ''}
                       onValueChange={(value) => handleRoleAssignment(profile.userId, value)}
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

              {profile.teamMemberships.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <label className="text-xs font-medium text-muted-foreground">Teams:</label>
                  <div className="flex gap-1 mt-1">
                    {profile.teamMemberships.map((membership, idx) => (
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
                    {teams.filter(team => !profile.teamMemberships.some(tm => tm.team.id === team.id)).map((team) => (
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
            <p>Invite links expire after 24 hours by default. If users report expired links, an admin can resend the invitation from this panel.</p>
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
                      Invited {new Date(invite.createdAt).toLocaleDateString()}
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
          onInviteSent={() => { utils.profiles.list.invalidate(); utils.invitations.list.invalidate(); }}
          organizationId={organization.id}
        />
      )}

      {organization && (
        <CreateUser
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreated={() => utils.profiles.list.invalidate()}
          organizationId={organization.id}
        />
      )}

      <AlertDialog open={!!deleteConfirmProfile} onOpenChange={(open) => !open && setDeleteConfirmProfile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteConfirmProfile?.fullName} from the organisation? This cannot be undone.
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
