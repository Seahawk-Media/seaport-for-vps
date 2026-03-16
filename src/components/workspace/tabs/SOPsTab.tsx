import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText, Edit, Trash2, Eye, Search, Building, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { useOrganization } from "@/hooks/useOrganization";

interface SOPsTabProps {
  departmentId?: string;
  teamId?: string;
  showAllFunctions?: boolean;
  /** Show ALL SOPs for a department (master list incl. function-level items) */
  showDeptAll?: boolean;
}

interface SOP {
  id: string;
  title: string;
  content: string | null;
  category: string | null;
  version: string | null;
  status: string | null;
  teamId: string | null;
  departmentId: string | null;
  team?: { id: string; name: string; departmentId: string | null } | null;
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

export const SOPsTab: React.FC<SOPsTabProps> = ({ departmentId, teamId, showAllFunctions = false, showDeptAll = false }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingSOP, setViewingSOP] = useState<SOP | null>(null);
  const [editingSOP, setEditingSOP] = useState<SOP | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    version: '1.0',
    status: 'active',
    teamId: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterFunction, setFilterFunction] = useState('all');
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin, isManager } = useRole();
  const { organization } = useOrganization();

  const canManage = isAdmin() || isSuperAdmin() || isManager();
  const utils = trpc.useUtils();

  const sopsQuery = trpc.sops.list.useQuery();
  const departmentsQuery = trpc.departments.list.useQuery();
  const teamsQuery = trpc.teams.list.useQuery();

  const createMutation = trpc.sops.create.useMutation({
    onSuccess: () => {
      toast({ title: "SOP created" });
      resetForm();
      utils.sops.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = trpc.sops.update.useMutation({
    onSuccess: () => {
      toast({ title: "SOP updated" });
      resetForm();
      utils.sops.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = trpc.sops.delete.useMutation({
    onSuccess: () => {
      toast({ title: "SOP deleted" });
      utils.sops.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const allSops = (sopsQuery.data || []) as SOP[];
  const departments = (departmentsQuery.data || []) as Department[];
  const teams = (teamsQuery.data || []) as Team[];
  const loading = sopsQuery.isLoading;

  // Filter SOPs based on scope
  const sops = allSops.filter(sop => {
    if (showAllFunctions) return true;
    if (teamId) return sop.teamId === teamId;
    if (showDeptAll && departmentId) return sop.departmentId === departmentId;
    if (departmentId) return sop.departmentId === departmentId && !sop.teamId;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    if (showAllFunctions && !formData.teamId) {
      toast({ title: "Error", description: "Please select a function", variant: "destructive" });
      return;
    }

    const selectedTeam = teams.find(t => t.id === formData.teamId);

    if (editingSOP) {
      updateMutation.mutate({
        id: editingSOP.id,
        title: formData.title,
        content: formData.content || undefined,
        category: formData.category || undefined,
        status: formData.status,
      });
    } else {
      createMutation.mutate({
        title: formData.title,
        content: formData.content || undefined,
        category: formData.category || undefined,
        departmentId: showAllFunctions ? (selectedTeam?.departmentId || undefined) : (departmentId || undefined),
        teamId: showAllFunctions ? (formData.teamId || undefined) : (teamId || undefined),
      });
    }
  };

  const resetForm = () => {
    setDialogOpen(false);
    setEditingSOP(null);
    setFormData({ title: '', content: '', category: '', version: '1.0', status: 'active', teamId: '' });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  const openEdit = (sop: SOP) => {
    setEditingSOP(sop);
    setFormData({
      title: sop.title,
      content: sop.content || '',
      category: sop.category || '',
      version: sop.version || '1.0',
      status: sop.status || 'active',
      teamId: sop.teamId || ''
    });
    setDialogOpen(true);
  };

  const getStatusBadge = (status: string | null) => {
    const colors: Record<string, string> = {
      'active': 'bg-green-100 text-green-800',
      'draft': 'bg-yellow-100 text-yellow-800',
      'archived': 'bg-gray-100 text-gray-800',
    };
    return colors[status || 'active'] || colors['active'];
  };

  const filteredSOPs = sops.filter(sop => {
    const matchesSearch = sop.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (sop.content?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (sop.category?.toLowerCase().includes(searchTerm.toLowerCase()));

    const sopDeptId = sop.team?.departmentId || sop.departmentId;
    const matchesDept = filterDepartment === 'all' || sopDeptId === filterDepartment;
    const matchesFunc = filterFunction === 'all' || sop.teamId === filterFunction;

    return matchesSearch && matchesDept && matchesFunc;
  });

  const filteredTeams = filterDepartment === 'all'
    ? teams
    : teams.filter(t => t.departmentId === filterDepartment);

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground">Loading SOPs...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Standard Operating Procedures</h2>
          <p className="text-sm text-muted-foreground">Documentation and guidelines</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add SOP
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingSOP ? 'Edit SOP' : 'Create SOP'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {(showAllFunctions || editingSOP) && (
                  <div className="space-y-2">
                    <Label>Function *</Label>
                    <Select value={formData.teamId} onValueChange={(v) => setFormData({ ...formData, teamId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select function" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map(team => {
                          const dept = departments.find(d => d.id === team.departmentId);
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
                <Input
                  placeholder="SOP Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                  <Input
                    placeholder="Version"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  />
                </div>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="SOP Content (Markdown supported)"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="min-h-[200px]"
                />
                <Button type="submit" className="w-full">
                  {editingSOP ? 'Update' : 'Create'} SOP
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* SOP Viewer Dialog */}
      <Dialog open={!!viewingSOP} onOpenChange={(open) => !open && setViewingSOP(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingSOP?.title}
              <Badge className={getStatusBadge(viewingSOP?.status || null)}>
                {viewingSOP?.status}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none">
            {viewingSOP?.category && (
              <p className="text-sm text-muted-foreground">Category: {viewingSOP.category} | Version: {viewingSOP.version}</p>
            )}
            <div className="whitespace-pre-wrap mt-4">{viewingSOP?.content || 'No content'}</div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      {showAllFunctions && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search SOPs..."
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

      {filteredSOPs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No SOPs found</p>
          </CardContent>
        </Card>
      ) : showAllFunctions ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Function</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSOPs.map((sop) => {
                const dept = departments.find(d => d.id === (sop.team?.departmentId || sop.departmentId));
                return (
                  <TableRow key={sop.id} className="cursor-pointer" onClick={() => setViewingSOP(sop)}>
                    <TableCell className="font-medium">{sop.title}</TableCell>
                    <TableCell className="text-muted-foreground">{sop.category || '-'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(sop.status)}>{sop.status}</Badge>
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
                      {sop.team ? (
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" />
                          {sop.team.name}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingSOP(sop)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(sop)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(sop.id)}>
                            <Trash2 className="h-4 w-4" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSOPs.map((sop) => (
            <Card key={sop.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewingSOP(sop)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{sop.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={getStatusBadge(sop.status)}>
                        {sop.status}
                      </Badge>
                      {sop.category && (
                        <Badge variant="outline">{sop.category}</Badge>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingSOP(sop)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(sop)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(sop.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {sop.content || 'No description'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Version {sop.version}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
