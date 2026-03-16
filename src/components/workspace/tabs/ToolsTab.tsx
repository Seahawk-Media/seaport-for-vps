import React, { useState, useEffect } from 'react';
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
import { supabase } from "@/integrations/supabase/client";
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
  team_id: string | null;
  department_id: string | null;
  team?: { id: string; name: string; department_id: string | null } | null;
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

export const ToolsTab: React.FC<ToolsTabProps> = ({ departmentId, teamId, showAllFunctions = false, showDeptAll = false }) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', url: '', team_id: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterFunction, setFilterFunction] = useState('all');
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin, isManager } = useRole();
  const { organization } = useOrganization();

  const canManage = isAdmin() || isSuperAdmin() || isManager();

  useEffect(() => {
    fetchData();
  }, [departmentId, teamId, showAllFunctions, showDeptAll]);

  const fetchData = async () => {
    try {
      let query = supabase.from('tools').select('*, team:teams(id, name, department_id)');
      
      if (showAllFunctions) {
        // Show all tools across all functions - no filter
      } else if (teamId) {
        query = query.eq('team_id', teamId);
      } else if (showDeptAll && departmentId) {
        // Department master list: all tools where department_id matches (incl. function-level)
        query = query.eq('department_id', departmentId);
      } else if (departmentId) {
        query = query.eq('department_id', departmentId).is('team_id', null);
      }

      const [toolsRes, deptRes, teamsRes] = await Promise.all([
        query.order('name'),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('teams').select('id, name, department_id').order('name')
      ]);

      if (toolsRes.error) throw toolsRes.error;
      setTools(toolsRes.data || []);
      setDepartments(deptRes.data || []);
      setTeams(teamsRes.data || []);
    } catch (error) {
      console.error('Error fetching tools:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    // Require function selection when in global view
    if (showAllFunctions && !formData.team_id) {
      toast({ title: "Error", description: "Please select a function", variant: "destructive" });
      return;
    }

    const selectedTeam = teams.find(t => t.id === formData.team_id);

    try {
      if (editingTool) {
        const { error } = await supabase
          .from('tools')
          .update({
            name: formData.name,
            description: formData.description || null,
            url: formData.url || null,
            team_id: formData.team_id || null,
            department_id: selectedTeam?.department_id || null,
          })
          .eq('id', editingTool.id);

        if (error) throw error;
        toast({ title: "Tool updated" });
      } else {
        const { error } = await supabase
          .from('tools')
          .insert({
            name: formData.name,
            description: formData.description || null,
            url: formData.url || null,
            organization_id: organization.id,
            department_id: showAllFunctions ? (selectedTeam?.department_id || null) : (departmentId || null),
            team_id: showAllFunctions ? (formData.team_id || null) : (teamId || null),
          });

        if (error) throw error;
        toast({ title: "Tool added" });
      }

      setDialogOpen(false);
      setEditingTool(null);
      setFormData({ name: '', description: '', url: '', team_id: '' });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('tools').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Tool deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openEdit = (tool: Tool) => {
    setEditingTool(tool);
    setFormData({ 
      name: tool.name, 
      description: tool.description || '', 
      url: tool.url || '',
      team_id: tool.team_id || ''
    });
    setDialogOpen(true);
  };

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (tool.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const toolDeptId = tool.team?.department_id || tool.department_id;
    const matchesDept = filterDepartment === 'all' || toolDeptId === filterDepartment;
    const matchesFunc = filterFunction === 'all' || tool.team_id === filterFunction;
    
    return matchesSearch && matchesDept && matchesFunc;
  });

  const filteredTeams = filterDepartment === 'all' 
    ? teams 
    : teams.filter(t => t.department_id === filterDepartment);

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
              setFormData({ name: '', description: '', url: '', team_id: '' });
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
                const dept = departments.find(d => d.id === (tool.team?.department_id || tool.department_id));
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
