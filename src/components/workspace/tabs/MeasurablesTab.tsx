import React, { useState } from 'react';
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
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import { useRole } from '@/hooks/useRole';
import { useOrganization } from '@/hooks/useOrganization';

interface Measurable {
  id: string;
  name: string;
  description: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  frequency: string | null;
  ownerId: string | null;
  teamId: string | null;
  owner?: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  } | null;
  team?: {
    id: string;
    name: string;
    departmentId: string | null;
  } | null;
}

interface Profile {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  departmentId: string | null;
}

interface MeasurablesTabProps {
  teamId?: string;
  departmentId?: string;
  showAllFunctions?: boolean;
  /** Show ALL measurables for a department (master list incl. function-level items) */
  showDeptAll?: boolean;
}

export const MeasurablesTab: React.FC<MeasurablesTabProps> = ({ teamId, departmentId, showAllFunctions = false, showDeptAll = false }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingMeasurable, setEditingMeasurable] = useState<Measurable | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetValue: '',
    currentValue: '',
    unit: '',
    frequency: 'weekly',
    ownerId: '',
    teamId: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterFunction, setFilterFunction] = useState('all');
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin, isManager } = useRole();
  const { organization } = useOrganization();
  const canEdit = isAdmin() || isSuperAdmin() || isManager();

  const utils = trpc.useUtils();

  const { data: allMeasurables = [], isLoading: loadingMeasurables } = trpc.measurables.list.useQuery();
  const { data: profiles = [] } = trpc.profiles.list.useQuery();
  const { data: departments = [] } = trpc.departments.list.useQuery();
  const { data: allTeams = [] } = trpc.teams.list.useQuery();

  const createMeasurable = trpc.measurables.create.useMutation({
    onSuccess: () => {
      utils.measurables.list.invalidate();
      toast({ title: 'Measurable created' });
      setShowForm(false);
      setEditingMeasurable(null);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save measurable', variant: 'destructive' });
    }
  });

  const updateMeasurable = trpc.measurables.update.useMutation({
    onSuccess: () => {
      utils.measurables.list.invalidate();
      toast({ title: 'Measurable updated' });
      setShowForm(false);
      setEditingMeasurable(null);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save measurable', variant: 'destructive' });
    }
  });

  const deleteMeasurable = trpc.measurables.delete.useMutation({
    onSuccess: () => {
      utils.measurables.list.invalidate();
      toast({ title: 'Measurable deleted' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete measurable', variant: 'destructive' });
    }
  });

  // Filter measurables based on props
  const teams: Team[] = allTeams.map((t: { id: string; name: string; departmentId?: string | null }) => ({
    id: t.id,
    name: t.name,
    departmentId: t.departmentId ?? null,
  }));

  const measurables: Measurable[] = (() => {
    let filtered = allMeasurables as Measurable[];
    if (showDeptAll && departmentId) {
      const teamIds = teams.filter(t => t.departmentId === departmentId).map(t => t.id);
      filtered = filtered.filter(m => m.teamId && teamIds.includes(m.teamId));
    } else if (teamId && !showAllFunctions) {
      filtered = filtered.filter(m => m.teamId === teamId);
    }
    return filtered;
  })();

  const handleSubmit = () => {
    if (!formData.name.trim() || !organization) return;

    if (showAllFunctions && !formData.teamId) {
      toast({ title: "Error", description: "Please select a function", variant: "destructive" });
      return;
    }

    const data = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      targetValue: formData.targetValue ? parseFloat(formData.targetValue) : null,
      currentValue: formData.currentValue ? parseFloat(formData.currentValue) : null,
      unit: formData.unit.trim() || null,
      frequency: formData.frequency,
      ownerId: formData.ownerId || null,
      teamId: showAllFunctions ? (formData.teamId || null) : (teamId || null),
      organizationId: organization.id
    };

    if (editingMeasurable) {
      updateMeasurable.mutate({ id: editingMeasurable.id, ...data });
    } else {
      createMeasurable.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    deleteMeasurable.mutate({ id });
  };

  const handleEdit = (measurable: Measurable) => {
    setEditingMeasurable(measurable);
    setFormData({
      name: measurable.name,
      description: measurable.description || '',
      targetValue: measurable.targetValue?.toString() || '',
      currentValue: measurable.currentValue?.toString() || '',
      unit: measurable.unit || '',
      frequency: measurable.frequency || 'weekly',
      ownerId: measurable.ownerId || '',
      teamId: measurable.teamId || ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      targetValue: '',
      currentValue: '',
      unit: '',
      frequency: 'weekly',
      ownerId: '',
      teamId: ''
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

    const mDeptId = m.team?.departmentId;
    const matchesDept = filterDepartment === 'all' || mDeptId === filterDepartment;
    const matchesFunc = filterFunction === 'all' || m.teamId === filterFunction;

    return matchesSearch && matchesDept && matchesFunc;
  });

  const filteredTeams = filterDepartment === 'all'
    ? teams
    : teams.filter(t => t.departmentId === filterDepartment);

  if (loadingMeasurables) {
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
                    <Select value={formData.teamId} onValueChange={(v) => setFormData({ ...formData, teamId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select function" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map(team => {
                          const dept = departments.find((d: { id: string; name: string }) => d.id === team.departmentId);
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
                      value={formData.targetValue}
                      onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                      placeholder="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Value</Label>
                    <Input
                      type="number"
                      value={formData.currentValue}
                      onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
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
                  <Select value={formData.ownerId} onValueChange={(value) => setFormData({ ...formData, ownerId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No owner</SelectItem>
                      {(profiles as Profile[]).map(profile => (
                        <SelectItem key={profile.id} value={profile.id}>{profile.fullName}</SelectItem>
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
              {(departments as Department[]).map(dept => (
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
                const progress = getProgressPercentage(measurable.currentValue, measurable.targetValue);
                const dept = departments.find((d: { id: string; name: string }) => d.id === measurable.team?.departmentId);
                return (
                  <TableRow key={measurable.id}>
                    <TableCell className="font-medium">{measurable.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-2 w-24" />
                        <span className="text-sm text-muted-foreground">
                          {measurable.currentValue ?? 0}{measurable.unit} / {measurable.targetValue ?? 0}{measurable.unit}
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
                            <AvatarImage src={measurable.owner.avatarUrl || ''} />
                            <AvatarFallback className="text-xs">{getInitials(measurable.owner.fullName)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{measurable.owner.fullName}</span>
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
            const progress = getProgressPercentage(measurable.currentValue, measurable.targetValue);
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
                        {measurable.currentValue ?? 0}{measurable.unit} / {measurable.targetValue ?? 0}{measurable.unit}
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
                        <AvatarImage src={measurable.owner.avatarUrl || ''} />
                        <AvatarFallback className="text-xs">{getInitials(measurable.owner.fullName)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{measurable.owner.fullName}</span>
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
