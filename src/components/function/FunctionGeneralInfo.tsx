import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Hash, Crown, Users, Pencil, Save, X, LayoutList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRole } from '@/hooks/useRole';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface FunctionGeneralInfoProps {
  teamId: string;
  team: {
    id: string;
    name: string;
    description: string | null;
    slack_channel?: string | null;
    department_id?: string | null;
    team_lead_id?: string | null;
    components?: string | null;
  };
  teamLead: Profile | null;
  memberCount: number;
  onUpdate: () => void;
}


export const FunctionGeneralInfo: React.FC<FunctionGeneralInfoProps> = ({
  teamId,
  team,
  teamLead,
  memberCount,
  onUpdate
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formData, setFormData] = useState({
    name: team.name,
    description: team.description || '',
    slack_channel: team.slack_channel || '',
    department_id: team.department_id || '',
    team_lead_id: team.team_lead_id || ''
  });
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin, isManager } = useRole();
  const canEdit = isAdmin() || isSuperAdmin() || isManager();

  useEffect(() => {
    if (canEdit) fetchOptions();
  }, [canEdit]);

  useEffect(() => {
    setFormData({
      name: team.name,
      description: team.description || '',
      slack_channel: team.slack_channel || '',
      department_id: team.department_id || '',
      team_lead_id: team.team_lead_id || ''
    });
  }, [team]);

  const fetchOptions = async () => {
    const [profilesRes, departmentsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url').order('full_name'),
      supabase.from('departments').select('id, name').order('name')
    ]);
    setProfiles(profilesRes.data || []);
    setDepartments(departmentsRes.data || []);
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          slack_channel: formData.slack_channel.trim() || null,
          department_id: formData.department_id || null,
          team_lead_id: formData.team_lead_id || null
        })
        .eq('id', teamId);

      if (error) throw error;
      toast({ title: 'Function updated' });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating function:', error);
      toast({ title: 'Error', description: 'Failed to update function', variant: 'destructive' });
    }
  };

  const handleCancel = () => {
    setFormData({
      name: team.name,
      description: team.description || '',
      slack_channel: team.slack_channel || '',
      department_id: team.department_id || '',
      team_lead_id: team.team_lead_id || ''
    });
    setIsEditing(false);
  };

  const getInitials = (name: string) =>
    name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  const currentDepartment = departments.find(d => d.id === team.department_id);
  const components = team.components
    ? team.components.split(',').map(c => c.trim()).filter(Boolean)
    : [];

  // ── EDIT MODE ─────────────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground">Edit Function</h3>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Function Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Function name"
              />
            </div>
            <div className="space-y-2">
              <Label>Slack Channel</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={formData.slack_channel}
                  onChange={(e) => setFormData({ ...formData, slack_channel: e.target.value })}
                  placeholder="#channel-name"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this function's purpose"
              rows={4}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={formData.department_id || 'none'}
                onValueChange={(v) => setFormData({ ...formData, department_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Owner / Lead</Label>
              <Select
                value={formData.team_lead_id || 'none'}
                onValueChange={(v) => setFormData({ ...formData, team_lead_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No owner</SelectItem>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── VIEW MODE ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Top meta row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <h2 className="text-xl font-bold text-foreground">{team.name}</h2>
          {team.description && (
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {team.description}
            </p>
          )}
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        )}
      </div>

      {/* Stat pills row */}
      <div className="flex flex-wrap gap-3">
        {currentDepartment && (
          <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{currentDepartment.name}</span>
          </div>
        )}
        {team.slack_channel && (
          <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm">
            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium font-mono">{team.slack_channel.startsWith('#') ? team.slack_channel : `#${team.slack_channel}`}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
        </div>
        {teamLead && (
          <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm">
            <Crown className="h-3.5 w-3.5 text-yellow-500" />
            <Avatar className="h-4 w-4">
              <AvatarImage src={teamLead.avatar_url || ''} />
              <AvatarFallback className="text-[10px]">{getInitials(teamLead.full_name)}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{teamLead.full_name}</span>
          </div>
        )}
      </div>

      {/* Components */}
      {components.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LayoutList className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Components</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {components.map((c) => (
              <Badge key={c} variant="secondary" className="text-xs font-normal px-2.5 py-1">
                {c}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
