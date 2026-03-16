import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ExternalLink, Wrench, Edit, Trash2, Search, Building, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { useOrganization } from "@/hooks/useOrganization";

interface ToolsTabProps {
  departmentId?: string;
  teamId?: string;
  showAllFunctions?: boolean;
  /** Show ALL tools for a department (master list incl. function-level items) */
  showDeptAll?: boolean;
}

interface Tool {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  icon: string | null;
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

export const ToolsTab: React.FC<ToolsTabProps> = ({ departmentId, teamId, showAllFunctions = false, showDeptAll = false }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', url: '', teamId: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterFunction, setFilterFunction] = useState('all');
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin, isManager } = useRole();
  const { organization } = useOrganization();

  const canManage = isAdmin() || isSuperAdmin() || isManager();
  const utils = trpc.useUtils();

  const toolsQuery = trpc.tools.list.useQuery();
  const departmentsQuery = trpc.departments.list.useQuery();
  const teamsQuery = trpc.teams.list.useQuery();

  const createMutation = trpc.tools.create.useMutation({
    onSuccess: () => {
      toast({ title: "Tool added" });
      setDialogOpen(false);
      setEditingTool(null);
      setFormData({ name: '', description: '', url: '', teamId: '' });
      utils.tools.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = trpc.tools.update.useMutation({
    onSuccess: () => {
      toast({ title: "Tool updated" });
      setDialogOpen(false);
      setEditingTool(null);
      setFormData({ name: '', description: '', url: '', teamId: '' });
      utils.tools.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = trpc.tools.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Tool deleted" });
      utils.tools.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const allTools = (toolsQuery.data || []) as Tool[];
  const departments = (departmentsQuery.data || []) as Department[];
  const teams = (teamsQuery.data || []) as Team[];
  const loading = toolsQuery.isLoading;

  // Filter tools based on scope
  const tools = allTools.filter(tool => {
    if (showAllFunctions) return true;
    if (teamId) return tool.teamId === teamId;
    if (showDeptAll && departmentId) return tool.departmentId === departmentId;
    if (departmentId) return tool.departmentId === departmentId && !tool.teamId;
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

    if (editingTool) {
      updateMutation.mutate({
        id: editingTool.id,
        name: formData.name,
        description: formData.description || undefined,
        url: formData.url || undefined,
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        description: formData.description || undefined,
        url: formData.url || undefined,
        departmentId: showAllFunctions ? (selectedTeam?.departmentId || undefined) : (departmentId || undefined),
        teamId: showAllFunctions ? (formData.teamId || undefined) : (teamId || undefined),
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  const openEdit = (tool: Tool) => {
    setEditingTool(tool);
    setFormData({
      name: tool.name,
      description: tool.description || '',
      url: tool.url || '',
      teamId: tool.teamId || ''
    });
    setDialogOpen(true);
  };

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (tool.description?.toLowerCase().includes(searchTerm.toLowerCase()));

    const toolDeptId = tool.team?.departmentId || tool.departmentId;
    const matchesDept = filterDepartment === 'all' || toolDeptId === filterDepartment;
    const matchesFunc = filterFunction === 'all' || tool.teamId === filterFunction;

    return matchesSearch && matchesDept && matchesFunc;
  });

  const filteredTeams = filterDepartment === 'all'
    ? teams
    : teams.filter(t => t.departmentId === filterDepartment);

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground">Loading tools...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Tools</h2>
          <p className="text-sm text-muted-foreground">Resources and applications used by functions</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingTool(null);
              setFormData({ name: '', description: '', url: '', teamId: '' });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Tool
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTool ? 'Edit Tool' : 'Add Tool'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {(showAllFunctions || editingTool) && (
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
                <div>
                  <Input
                    placeholder="Tool name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Textarea
                    placeholder="Description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <Input
                    placeholder="URL (optional)"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full">
                  {editingTool ? 'Update' : 'Add'} Tool
                </Button>
              </form>
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
              placeholder="Search tools..."
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

      {filteredTools.length === 0 ? (
        <EmptyState icon={Wrench} title="No tools found" />
      ) : showAllFunctions ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Function</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTools.map((tool) => {
                const dept = departments.find(d => d.id === (tool.team?.departmentId || tool.departmentId));
                return (
                  <TableRow key={tool.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {tool.name}
                        {tool.url && (
                          <a href={tool.url} target="_blank" rel="noopener noreferrer" className="text-primary">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">{tool.description || '-'}</TableCell>
                    <TableCell>
                      {dept ? (
                        <Badge variant="outline" className="gap-1">
                          <Building className="h-3 w-3" />
                          {dept.name}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {tool.team ? (
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" />
                          {tool.team.name}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tool)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(tool.id)}>
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
          {filteredTools.map((tool) => (
            <Card key={tool.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{tool.name}</CardTitle>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tool)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(tool.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {tool.description && (
                  <CardDescription>{tool.description}</CardDescription>
                )}
              </CardHeader>
              {tool.url && (
                <CardContent>
                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Open Tool <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
