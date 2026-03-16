import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, UserPlus, Crown, Building2, Network } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

interface Department {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  teamLeadId: string | null;
  teamType: string;
  departmentId: string | null;
  organizationId: string;
  createdAt: string;
  teamMembers?: TeamMember[];
  teamLead?: {
    id: string;
    fullName: string;
    email: string;
  };
  department?: { name: string } | null;
}

interface TeamMember {
  id: string;
  role: string;
  profile: {
    id: string;
    fullName: string;
    email: string;
  };
}

interface Profile {
  id: string;
  fullName: string;
  email: string;
}

export const TeamManagement: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showMemberForm, setShowMemberForm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    teamType: 'functional',
    teamLeadId: '',
    departmentId: '',
  });
  const [memberFormData, setMemberFormData] = useState({
    profileId: '',
    roleInTeam: 'member'
  });
  const { toast } = useToast();

  const utils = trpc.useUtils();
  const { data: teamsRaw, isLoading: loading } = trpc.teams.list.useQuery();
  const { data: profilesRaw } = trpc.profiles.list.useQuery();
  const { data: departmentsRaw } = trpc.departments.list.useQuery();

  const teams: Team[] = (teamsRaw || []) as Team[];
  const profiles: Profile[] = (profilesRaw ?? []).map((p) => ({
    id: p.id,
    fullName: p.fullName,
    email: p.email,
  }));
  const departments: Department[] = (departmentsRaw ?? []).map((d) => ({
    id: d.id,
    name: d.name,
  }));

  const createTeam = trpc.teams.create.useMutation({
    onSuccess: () => {
      utils.teams.list.invalidate();
      toast({ title: "Success", description: "Team created successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save team", variant: "destructive" });
    },
  });

  const updateTeam = trpc.teams.update.useMutation({
    onSuccess: () => {
      utils.teams.list.invalidate();
      toast({ title: "Success", description: "Team updated successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save team", variant: "destructive" });
    },
  });

  const deleteTeamMutation = trpc.teams.delete.useMutation({
    onSuccess: () => {
      utils.teams.list.invalidate();
      toast({ title: "Success", description: "Team deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete team", variant: "destructive" });
    },
  });

  const addMember = trpc.teamMembers.add.useMutation({
    onSuccess: () => {
      utils.teams.list.invalidate();
      toast({ title: "Success", description: "Team member added successfully" });
      setShowMemberForm(null);
      setMemberFormData({ profileId: '', roleInTeam: 'member' });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add team member", variant: "destructive" });
    },
  });

  const removeMember = trpc.teamMembers.remove.useMutation({
    onSuccess: () => {
      utils.teams.list.invalidate();
      toast({ title: "Success", description: "Team member removed successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove team member", variant: "destructive" });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingTeam) {
      updateTeam.mutate({
        id: editingTeam.id,
        name: formData.name,
        description: formData.description || undefined,
      });
    } else {
      createTeam.mutate({
        name: formData.name,
        description: formData.description || undefined,
        teamType: formData.teamType || undefined,
        departmentId: formData.departmentId === 'none' ? undefined : formData.departmentId || undefined,
      });
    }
  };

  const handleAddMember = async (teamId: string) => {
    addMember.mutate({
      teamId,
      profileId: memberFormData.profileId,
      role: memberFormData.roleInTeam,
    });
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    removeMember.mutate({ id: memberId });
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      teamType: team.teamType,
      teamLeadId: team.teamLeadId || '',
      departmentId: team.departmentId || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    deleteTeamMutation.mutate({ id: teamId });
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', teamType: 'functional', teamLeadId: '', departmentId: '' });
    setShowForm(false);
    setEditingTeam(null);
  };

  if (loading && teams.length === 0) {
    return <div>Loading functions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Function Management</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage functions within departments
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Function
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingTeam ? 'Edit Function' : 'Create New Function'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Function Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter function name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter function description"
                />
              </div>

              <div>
                <Label htmlFor="teamType">Function Type</Label>
                <Select
                  value={formData.teamType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, teamType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="functional">Functional</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="committee">Committee</SelectItem>
                    <SelectItem value="task_force">Task Force</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="teamLead">Function Lead (Optional)</Label>
                <Select
                  value={formData.teamLeadId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, teamLeadId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select function lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Function Lead</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="department">Department</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, departmentId: value }))}
                >
                  <SelectTrigger>
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

              <div className="flex gap-2">
                <Button type="submit" disabled={createTeam.isPending || updateTeam.isPending}>
                  {editingTeam ? 'Update' : 'Create'} Function
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {teams.map((team) => (
          <Card key={team.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <Network className="h-5 w-5 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{team.name}</h4>
                      {team.teamLead && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    {team.description && (
                      <p className="text-sm text-muted-foreground">{team.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground capitalize">
                      {team.teamType.replace('_', ' ')} Function
                    </p>
                    {team.teamLead && (
                      <p className="text-xs text-muted-foreground">
                        Function Lead: {team.teamLead.fullName}
                      </p>
                    )}
                    {team.departmentId && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {departments.find(d => d.id === team.departmentId)?.name || 'Unknown dept'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMemberForm(team.id)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(team)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(team.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {showMemberForm === team.id && (
                <div className="border-t pt-4 mt-4">
                  <h5 className="font-medium mb-3">Add Function Member</h5>
                  <div className="flex gap-2">
                    <Select
                      value={memberFormData.profileId}
                      onValueChange={(value) => setMemberFormData(prev => ({ ...prev, profileId: value }))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select person" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.filter(p => !team.teamMembers?.some(tm => tm.profile.id === p.id)).map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={memberFormData.roleInTeam}
                      onValueChange={(value) => setMemberFormData(prev => ({ ...prev, roleInTeam: value }))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="coordinator">Coordinator</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => handleAddMember(team.id)}
                      disabled={!memberFormData.profileId}
                    >
                      Add
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowMemberForm(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {team.teamMembers && team.teamMembers.length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <h5 className="font-medium mb-3">Function Members ({team.teamMembers.length})</h5>
                  <div className="space-y-2">
                    {team.teamMembers
                      .sort((a, b) => {
                        const aIsLead = team.teamLead && a.profile.id === team.teamLead.id;
                        const bIsLead = team.teamLead && b.profile.id === team.teamLead.id;
                        if (aIsLead && !bIsLead) return -1;
                        if (!aIsLead && bIsLead) return 1;
                        return a.profile.fullName.localeCompare(b.profile.fullName);
                      })
                      .map((member) => {
                        const isTeamLead = team.teamLead && member.profile.id === team.teamLead.id;
                        return (
                          <div key={member.id} className="flex justify-between items-center p-2 bg-muted rounded">
                            <div className="flex items-center gap-2">
                              {isTeamLead && <Crown className="h-4 w-4 text-yellow-500" />}
                              <div>
                                <span className="font-medium">{member.profile.fullName}</span>
                                <span className="text-sm text-muted-foreground ml-2">
                                  ({member.role})
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        );
                      })}
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
