import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Target, TrendingUp, User, Pencil, Trash2, Search, Building, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRole } from '@/hooks/useRole';
import { useOrganization } from '@/hooks/useOrganization';

interface Measurable {
  id: string;
  name: string;
  description: string | null;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  frequency: string | null;
  owner_id: string | null;
  team_id: string | null;
  owner?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  team?: {
    id: string;
    name: string;
    department_id: string | null;
  } | null;
}

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  department_id: string | null;
}

interface MeasurablesTabProps {
  teamId?: string;
  departmentId?: string;
  showAllFunctions?: boolean;
  /** Show ALL measurables for a department (master list incl. function-level items) */
  showDeptAll?: boolean;
}

export const MeasurablesTab: React.FC<MeasurablesTabProps> = ({ teamId, departmentId, showAllFunctions = false, showDeptAll = false }) => {
  const [measurables, setMeasurables] = useState<Measurable[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMeasurable, setEditingMeasurable] = useState<Measurable | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_value: '',
    current_value: '',
    unit: '',
    frequency: 'weekly',
    owner_id: '',
    team_id: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterFunction, setFilterFunction] = useState('all');
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin, isManager } = useRole();
  const { organization } = useOrganization();
  const canEdit = isAdmin() || isSuperAdmin() || isManager();

  useEffect(() => {
    fetchData();
  }, [teamId, departmentId, showAllFunctions, showDeptAll]);

  const fetchData = async () => {
    try {
      let query = supabase
        .from('measurables')
        .select('*, owner:profiles!measurables_owner_id_fkey(id, full_name, avatar_url), team:teams!measurables_team_id_fkey(id, name, department_id)')
        .order('name');

      if (showDeptAll && departmentId) {
        // Department master list: get all teams in this dept, then filter measurables by those team IDs
        const { data: deptTeams } = await supabase.from('teams').select('id').eq('department_id', departmentId);
        const teamIds = deptTeams?.map(t => t.id) || [];
        if (teamIds.length > 0) {
          query = query.in('team_id', teamIds);
        } else {
          setMeasurables([]);
          setLoading(false);
          return;
        }
      } else if (teamId && !showAllFunctions) {
        query = query.eq('team_id', teamId);
      }
      // showAllFunctions: no filter — show everything

      const [measurablesRes, profilesRes, deptRes, teamsRes] = await Promise.all([
        query,
        supabase.from('profiles').select('id, full_name, avatar_url').order('full_name'),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('teams').select('id, name, department_id').order('name')
      ]);

      if (measurablesRes.error) throw measurablesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      setMeasurables(measurablesRes.data || []);
      setProfiles(profilesRes.data || []);
      setDepartments(deptRes.data || []);
      setTeams(teamsRes.data || []);
    } catch (error) {
      console.error('Error fetching measurables:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !organization) return;

    if (showAllFunctions && !formData.team_id) {
      toast({ title: "Error", description: "Please select a function", variant: "destructive" });
      return;
    }

    try {
      const data = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        target_value: formData.target_value ? parseFloat(formData.target_value) : null,
        current_value: formData.current_value ? parseFloat(formData.current_value) : null,
        unit: formData.unit.trim() || null,
        frequency: formData.frequency,
        owner_id: formData.owner_id || null,
        team_id: showAllFunctions ? (formData.team_id || null) : (teamId || null),
        organization_id: organization.id
      };

      if (editingMeasurable) {
        const { error } = await supabase
          .from('measurables')
          .update(data)
          .eq('id', editingMeasurable.id);
        if (error) throw error;
        toast({ title: 'Measurable updated' });
      } else {
        const { error } = await supabase
          .from('measurables')
          .insert([data]);
        if (error) throw error;
        toast({ title: 'Measurable created' });
      }

      setShowForm(false);
      setEditingMeasurable(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving measurable:', error);
      toast({ title: 'Error', description: 'Failed to save measurable', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('measurables').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Measurable deleted' });
      fetchData();
    } catch (error) {
      console.error('Error deleting measurable:', error);
      toast({ title: 'Error', description: 'Failed to delete measurable', variant: 'destructive' });
    }
  };

  const handleEdit = (measurable: Measurable) => {
    setEditingMeasurable(measurable);
    setFormData({
      name: measurable.name,
      description: measurable.description || '',
      target_value: measurable.target_value?.toString() || '',
      current_value: measurable.current_value?.toString() || '',
      unit: measurable.unit || '',
      frequency: measurable.frequency || 'weekly',
      owner_id: measurable.owner_id || '',
      team_id: measurable.team_id || ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      target_value: '',
      current_value: '',
      unit: '',
      frequency: 'weekly',
      owner_id: '',
      team_id: ''
    });
  };

  const getProgressPercentage = (current: number | null, target: number | null) => {
    if (!target || target === 0) return 0;
    if (!current) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  };

  const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  const filteredMeasurables = measurables.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (m.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const mDeptId = m.team?.department_id;
    const matchesDept = filterDepartment === 'all' || mDeptId === filterDepartment;
    const matchesFunc = filterFunction === 'all' || m.team_id === filterFunction;
    
    return matchesSearch && matchesDept && matchesFunc;
  });

  const filteredTeams = filterDepartment === 'all' 
    ? teams 
    : teams.filter(t => t.department_id === filterDepartment);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Measurables</h3>
        {canEdit && (
          <Dialog open={showForm} onOpenChange={(open) => {
            setShowForm(open);
            if (!open) {
              setEditingMeasurable(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Measurable
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingMeasurable ? 'Edit Measurable' : 'Add Measurable'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {(showAllFunctions || editingMeasurable) && (
                  <div className="space-y-2">
                    <Label>Function *</Label>
                    <Select value={formData.team_id} onValueChange={(v) => setFormData({ ...formData, team_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select function" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map(team => {
                          const dept = departments.find(d => d.id === team.department_id);
                          return (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name} {dept && <span className="text-muted-foreground">({dept.name})</span>}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Weekly Revenue"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    value={formData.description} 
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this measurable"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target Value</Label>
                    <Input 
                      type="number"
                      value={formData.target_value} 
                      onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                      placeholder="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Value</Label>
                    <Input 
                      type="number"
                      value={formData.current_value} 
                      onChange={(e) => setFormData({ ...formData, current_value: e.target.value })}
                      placeholder="75"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input 
                      value={formData.unit} 
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="e.g., $, %, units"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={formData.frequency} onValueChange={(value) => setFormData({ ...formData, frequency: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Owner</Label>
                  <Select value={formData.owner_id} onValueChange={(value) => setFormData({ ...formData, owner_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No owner</SelectItem>
                      {profiles.map(profile => (
                        <SelectItem key={profile.id} value={profile.id}>{profile.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button onClick={handleSubmit} disabled={!formData.name.trim()}>
                    {editingMeasurable ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      {showAllFunctions && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search measurables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterDepartment} onValueChange={(v) => { setFilterDepartment(v); setFilterFunction('all'); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterFunction} onValueChange={setFilterFunction}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Functions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Functions</SelectItem>
              {filteredTeams.map(team => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredMeasurables.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No measurables found.</p>
            {canEdit && <p className="text-sm text-muted-foreground mt-1">Add your first measurable to track key metrics.</p>}
          </CardContent>
        </Card>
      ) : showAllFunctions ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Function</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMeasurables.map((measurable) => {
                const progress = getProgressPercentage(measurable.current_value, measurable.target_value);
                const dept = departments.find(d => d.id === measurable.team?.department_id);
                return (
                  <TableRow key={measurable.id}>
                    <TableCell className="font-medium">{measurable.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-2 w-24" />
                        <span className="text-sm text-muted-foreground">
                          {measurable.current_value ?? 0}{measurable.unit} / {measurable.target_value ?? 0}{measurable.unit}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{measurable.frequency}</Badge>
                    </TableCell>
                    <TableCell>
                      {measurable.owner ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={measurable.owner.avatar_url || ''} />
                            <AvatarFallback className="text-xs">{getInitials(measurable.owner.full_name)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{measurable.owner.full_name}</span>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {dept ? (
                        <Badge variant="outline" className="gap-1">
                          <Building className="h-3 w-3" />
                          {dept.name}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {measurable.team ? (
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" />
                          {measurable.team.name}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(measurable)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(measurable.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredMeasurables.map((measurable) => {
            const progress = getProgressPercentage(measurable.current_value, measurable.target_value);
            return (
              <Card key={measurable.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <CardTitle className="text-base">{measurable.name}</CardTitle>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(measurable)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(measurable.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {measurable.description && (
                    <p className="text-sm text-muted-foreground">{measurable.description}</p>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {measurable.current_value ?? 0}{measurable.unit} / {measurable.target_value ?? 0}{measurable.unit}
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{measurable.frequency}</Badge>
                      <span className={`text-sm font-medium ${progress >= 100 ? 'text-green-600' : progress >= 75 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                        {progress}%
                      </span>
                    </div>
                  </div>

                  {measurable.owner && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={measurable.owner.avatar_url || ''} />
                        <AvatarFallback className="text-xs">{getInitials(measurable.owner.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{measurable.owner.full_name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
