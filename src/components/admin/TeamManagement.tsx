import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, Edit, Trash2, UserPlus, Crown, Building2, Network } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Department {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  team_lead_id: string | null;
  team_type: string;
  department_id: string | null;
  organization_id: string;
  created_at: string;
  team_members?: TeamMember[];
  team_lead?: {
    id: string;
    full_name: string;
    email: string;
  };
  department?: { name: string } | null;
}

interface TeamMember {
  id: string;
  role: string;
  profile: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export const TeamManagement: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showMemberForm, setShowMemberForm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    team_type: 'functional',
    team_lead_id: '',
    department_id: '',
  });
  const [memberFormData, setMemberFormData] = useState({
    profile_id: '',
    role_in_team: 'member'
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchTeams();
    fetchProfiles();
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const { data } = await supabase.from('departments').select('id, name').order('name');
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          team_members (
            id,
            role,
            profile:profiles (
              id,
              full_name,
              email
            )
          )
        `)
        .order('name');

      if (error) throw error;
      
      // Fetch team leads separately to handle the join properly
      const teamsWithLeads = await Promise.all(
        (data || []).map(async (team) => {
          if (team.team_lead_id) {
            const { data: leadData } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', team.team_lead_id)
              .single();
            
            return { ...team, team_lead: leadData };
          }
          return team;
        })
      );
      
      setTeams(teamsWithLeads);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        title: "Error",
        description: "Failed to fetch teams",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get user's organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile?.organization_id) throw new Error('No organization found');

      const teamData = {
        name: formData.name,
        description: formData.description || null,
        team_type: formData.team_type,
        team_lead_id: formData.team_lead_id === 'none' ? null : formData.team_lead_id || null,
        department_id: formData.department_id === 'none' ? null : formData.department_id || null,
        organization_id: profile.organization_id
      };

      if (editingTeam) {
        const { error } = await supabase
          .from('teams')
          .update(teamData)
          .eq('id', editingTeam.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Team updated successfully"
        });
      } else {
        const { error } = await supabase
          .from('teams')
          .insert([teamData]);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Team created successfully"
        });
      }

      resetForm();
      fetchTeams();
    } catch (error) {
      console.error('Error saving team:', error);
      toast({
        title: "Error",
        description: "Failed to save team",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (teamId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .insert([{
          team_id: teamId,
          profile_id: memberFormData.profile_id,
          role: memberFormData.role_in_team
        }]);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Team member added successfully"
      });
      setShowMemberForm(null);
      setMemberFormData({ profile_id: '', role_in_team: 'member' });
      fetchTeams();
    } catch (error) {
      console.error('Error adding team member:', error);
      toast({
        title: "Error",
        description: "Failed to add team member",
        variant: "destructive"
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Team member removed successfully"
      });
      fetchTeams();
    } catch (error) {
      console.error('Error removing team member:', error);
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      team_type: team.team_type,
      team_lead_id: team.team_lead_id || '',
      department_id: team.department_id || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;

    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Team deleted successfully"
      });
      fetchTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
      toast({
        title: "Error",
        description: "Failed to delete team",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', team_type: 'functional', team_lead_id: '', department_id: '' });
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
                <Label htmlFor="team_type">Function Type</Label>
                <Select 
                  value={formData.team_type} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, team_type: value }))}
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
                <Label htmlFor="team_lead">Function Lead (Optional)</Label>
                <Select 
                  value={formData.team_lead_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, team_lead_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select function lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Function Lead</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="department">Department</Label>
                <Select
                  value={formData.department_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, department_id: value }))}
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
                <Button type="submit" disabled={loading}>
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
                      {team.team_lead && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    {team.description && (
                      <p className="text-sm text-muted-foreground">{team.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground capitalize">
                      {team.team_type.replace('_', ' ')} Function
                    </p>
                    {team.team_lead && (
                      <p className="text-xs text-muted-foreground">
                        Function Lead: {team.team_lead.full_name}
                      </p>
                    )}
                    {team.department_id && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {departments.find(d => d.id === team.department_id)?.name || 'Unknown dept'}
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
                      value={memberFormData.profile_id} 
                      onValueChange={(value) => setMemberFormData(prev => ({ ...prev, profile_id: value }))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select person" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.filter(p => !team.team_members?.some(tm => tm.profile.id === p.id)).map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select 
                      value={memberFormData.role_in_team} 
                      onValueChange={(value) => setMemberFormData(prev => ({ ...prev, role_in_team: value }))}
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
                      disabled={!memberFormData.profile_id}
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

              {team.team_members && team.team_members.length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <h5 className="font-medium mb-3">Function Members ({team.team_members.length})</h5>
                  <div className="space-y-2">
                    {team.team_members
                      .sort((a, b) => {
                        // Team lead first (if they're also a member)
                        const aIsLead = team.team_lead && a.profile.id === team.team_lead.id;
                        const bIsLead = team.team_lead && b.profile.id === team.team_lead.id;
                        if (aIsLead && !bIsLead) return -1;
                        if (!aIsLead && bIsLead) return 1;
                        return a.profile.full_name.localeCompare(b.profile.full_name);
                      })
                      .map((member) => {
                        const isTeamLead = team.team_lead && member.profile.id === team.team_lead.id;
                        return (
                          <div key={member.id} className="flex justify-between items-center p-2 bg-muted rounded">
                            <div className="flex items-center gap-2">
                              {isTeamLead && <Crown className="h-4 w-4 text-yellow-500" />}
                              <div>
                                <span className="font-medium">{member.profile.full_name}</span>
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