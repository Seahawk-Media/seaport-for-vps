import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Bot, Edit, Trash2, Power, PowerOff, Search, Building, Users, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { useOrganization } from "@/hooks/useOrganization";

// ─── Model catalogue (mirrors AIModelsManagement) ─────────────────────────────

const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-opus-4-5',   label: 'Claude Opus 4.5' },
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { value: 'claude-haiku-3-5',  label: 'Claude Haiku 3.5' },
  ],
  openai: [
    { value: 'gpt-5',      label: 'GPT-5' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
    { value: 'gpt-5-nano', label: 'GPT-5 Nano' },
  ],
  google: [
    { value: 'gemini-2.5-pro',        label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  ],
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google Gemini',
};

const TIER_OPTIONS = [
  { value: 'general',       label: 'General (Entire Org)', description: 'Visible to everyone in the org', Icon: Globe },
  { value: 'departmental',  label: 'Departmental', description: 'Scoped to a department', Icon: Building },
  { value: 'functional',    label: 'Functional', description: 'Scoped to a specific function', Icon: Users },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentsTabProps {
  departmentId?: string;
  functionId?: string;
  showAllFunctions?: boolean;
  showDeptAll?: boolean;
}

interface Agent {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  status: string | null;
  config: unknown;
  team_id: string | null;
  department_id: string | null;
  tier: string | null;
  system_prompt: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  team?: { id: string; name: string; department_id: string | null } | null;
}

interface Department { id: string; name: string }
interface Team { id: string; name: string; department_id: string | null }
interface AIConfig { provider: string; is_enabled: boolean }

// ─── Component ────────────────────────────────────────────────────────────────

export const AgentsTab: React.FC<AgentsTabProps> = ({
  departmentId, functionId, showAllFunctions = false, showDeptAll = false,
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'automation',
    status: 'inactive',
    tier: showAllFunctions ? 'general' : (functionId ? 'functional' : 'departmental'),
    team_id: '',
    department_id: '',
    ai_provider: '',
    ai_model: '',
    system_prompt: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterFunction, setFilterFunction] = useState('all');
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin } = useRole();
  const { organization } = useOrganization();

  const canManage = isAdmin() || isSuperAdmin();
  const enabledProviders = aiConfigs.filter(c => c.is_enabled);

  useEffect(() => { fetchData(); }, [departmentId, functionId, showAllFunctions, showDeptAll]);

  const fetchData = async () => {
    if (!organization) return;
    try {
      let query = supabase.from('agents').select('*, team:teams(id, name, department_id)');

      if (showAllFunctions) {
        // show all
      } else if (functionId) {
        query = query.eq('team_id', functionId);
      } else if (showDeptAll && departmentId) {
        query = query.eq('department_id', departmentId);
      } else if (departmentId) {
        query = query.eq('department_id', departmentId).is('team_id', null);
      }

      const [agentsRes, deptRes, teamsRes, aiRes] = await Promise.all([
        query.order('name'),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('teams').select('id, name, department_id').order('name'),
        supabase.from('org_ai_config').select('provider, is_enabled').eq('organization_id', organization.id),
      ]);

      if (agentsRes.error) throw agentsRes.error;
      setAgents((agentsRes.data || []) as Agent[]);
      setDepartments(deptRes.data || []);
      setTeams(teamsRes.data || []);
      setAiConfigs((aiRes.data || []) as AIConfig[]);
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDialogOpen(false);
    setEditingAgent(null);
    setFormData({
      name: '', description: '', type: 'automation', status: 'inactive',
      tier: showAllFunctions ? 'general' : (functionId ? 'functional' : 'departmental'),
      team_id: '', department_id: '', ai_provider: '', ai_model: '', system_prompt: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    const tier = formData.tier;

    // Validation
    if (tier === 'functional' && !formData.team_id) {
      toast({ title: 'Please select a function', variant: 'destructive' }); return;
    }
    if (tier === 'departmental' && !formData.department_id) {
      toast({ title: 'Please select a department', variant: 'destructive' }); return;
    }

    const selectedTeam = teams.find(t => t.id === formData.team_id);

    const payload: Record<string, unknown> = {
      name: formData.name,
      description: formData.description || null,
      type: formData.type,
      status: formData.status,
      tier,
      system_prompt: formData.system_prompt || null,
      ai_provider: formData.ai_provider || null,
      ai_model: formData.ai_model || null,
      team_id: tier === 'functional' ? (formData.team_id || null) : null,
      department_id:
        tier === 'general' ? null :
        tier === 'functional' ? (selectedTeam?.department_id || null) :
        (formData.department_id || null),
    };

    // If context-fixed (in a function workspace), override
    if (!showAllFunctions && functionId) {
      payload.team_id = functionId;
      payload.department_id = departmentId || null;
      payload.tier = 'functional';
    } else if (!showAllFunctions && departmentId) {
      payload.department_id = departmentId;
      payload.tier = 'departmental';
    }

    try {
      if (editingAgent) {
        const { error } = await supabase.from('agents').update(payload).eq('id', editingAgent.id);
        if (error) throw error;
        toast({ title: 'Agent updated' });
      } else {
        const { error } = await (supabase.from('agents') as any).insert({ ...payload, organization_id: organization.id });
        if (error) throw error;
        toast({ title: 'Agent created' });
      }
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('agents').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Agent deleted' });
    fetchData();
  };

  const toggleAgentStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('agents').update({ status: newStatus }).eq('id', agent.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Agent ${newStatus === 'active' ? 'activated' : 'deactivated'}` });
    fetchData();
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      description: agent.description || '',
      type: agent.type || 'automation',
      status: agent.status || 'inactive',
      tier: agent.tier || 'functional',
      team_id: agent.team_id || '',
      department_id: agent.department_id || '',
      ai_provider: agent.ai_provider || '',
      ai_model: agent.ai_model || '',
      system_prompt: agent.system_prompt || '',
    });
    setDialogOpen(true);
  };

  const getTypeBadgeClass = (type: string | null) => {
    const map: Record<string, string> = {
      automation: 'bg-blue-100 text-blue-800',
      'ai-assistant': 'bg-purple-100 text-purple-800',
      integration: 'bg-green-100 text-green-800',
    };
    return map[type || 'automation'] || map.automation;
  };

  const getStatusBadgeClass = (status: string | null) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      error: 'bg-red-100 text-red-800',
    };
    return map[status || 'inactive'] || map.inactive;
  };

  const getTierIcon = (tier: string | null) => {
    if (tier === 'general') return <Globe className="h-3 w-3" />;
    if (tier === 'departmental') return <Building className="h-3 w-3" />;
    return <Users className="h-3 w-3" />;
  };

  const filteredAgents = agents.filter(agent => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (agent.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    const agentDeptId = agent.team?.department_id || agent.department_id;
    const matchesDept = filterDepartment === 'all' || agentDeptId === filterDepartment;
    const matchesFunc = filterFunction === 'all' || agent.team_id === filterFunction;
    return matchesSearch && matchesDept && matchesFunc;
  });

  const filteredTeams = filterDepartment === 'all' ? teams : teams.filter(t => t.department_id === filterDepartment);
  const formTeams = formData.department_id
    ? teams.filter(t => t.department_id === formData.department_id)
    : teams;

  if (loading) return <div className="flex items-center justify-center h-48 text-muted-foreground">Loading agents...</div>;

  // ─── Dialog form ────────────────────────────────────────────────────────────
  const dialogForm = (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{editingAgent ? 'Edit Agent' : 'Create Agent'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">

        {/* Scope — only show when in the global agents view */}
        {(showAllFunctions || editingAgent) && (
          <div className="space-y-2">
            <Label className="text-xs">Tier</Label>
            <div className="grid grid-cols-3 gap-2">
              {TIER_OPTIONS.map(({ value, label, description, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, tier: value, team_id: '', department_id: '' }))}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-colors ${
                    formData.tier === value
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border hover:border-foreground/30'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">{label}</span>
                  <span className={`text-[10px] leading-snug ${formData.tier === value ? 'text-background/60' : 'text-muted-foreground'}`}>
                    {description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Department picker */}
        {(showAllFunctions || editingAgent) && (formData.tier === 'departmental' || formData.tier === 'functional') && (
          <div className="space-y-2">
            <Label className="text-xs">Department</Label>
            <Select value={formData.department_id} onValueChange={v => setFormData(f => ({ ...f, department_id: v, team_id: '' }))}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Function picker */}
        {(showAllFunctions || editingAgent) && formData.tier === 'functional' && (
          <div className="space-y-2">
            <Label className="text-xs">Function</Label>
            <Select value={formData.team_id} onValueChange={v => setFormData(f => ({ ...f, team_id: v }))}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select function" />
              </SelectTrigger>
              <SelectContent>
                {formTeams.map(t => {
                  const dept = departments.find(d => d.id === t.department_id);
                  return (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {dept && <span className="text-muted-foreground">({dept.name})</span>}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Name */}
        <div className="space-y-1.5">
          <Label className="text-xs">Agent Name *</Label>
          <Input placeholder="e.g. Support Responder" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} required />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea placeholder="What does this agent do?" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} rows={2} />
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select value={formData.type} onValueChange={v => setFormData(f => ({ ...f, type: v }))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="automation">Automation</SelectItem>
              <SelectItem value="ai-assistant">AI Assistant</SelectItem>
              <SelectItem value="integration">Integration</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* AI Provider + Model */}
        {enabledProviders.length > 0 && (
          <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/20">
            <p className="text-xs font-medium">AI Model</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Provider</Label>
                <Select value={formData.ai_provider} onValueChange={v => setFormData(f => ({ ...f, ai_provider: v, ai_model: '' }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {enabledProviders.map(c => (
                      <SelectItem key={c.provider} value={c.provider}>{PROVIDER_LABELS[c.provider] ?? c.provider}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Model</Label>
                <Select
                  value={formData.ai_model}
                  onValueChange={v => setFormData(f => ({ ...f, ai_model: v }))}
                  disabled={!formData.ai_provider}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select model" /></SelectTrigger>
                  <SelectContent>
                    {(PROVIDER_MODELS[formData.ai_provider] ?? []).map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {enabledProviders.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-3 text-center">
            <p className="text-xs text-muted-foreground">No AI providers connected. Go to <strong>Admin → AI Models</strong> to add a key.</p>
          </div>
        )}

        {/* System Prompt */}
        {formData.ai_provider && (
          <div className="space-y-1.5">
            <Label className="text-xs">System Prompt</Label>
            <Textarea
              placeholder="You are a helpful assistant for [team name]..."
              value={formData.system_prompt}
              onChange={e => setFormData(f => ({ ...f, system_prompt: e.target.value }))}
              rows={3}
            />
          </div>
        )}

        <Button type="submit" className="w-full">{editingAgent ? 'Update' : 'Create'} Agent</Button>
      </form>
    </DialogContent>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Agents</h2>
          <p className="text-sm text-muted-foreground">Automation and AI assistants</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={open => { if (!open) resetForm(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Agent</Button>
            </DialogTrigger>
            {dialogForm}
          </Dialog>
        )}
      </div>

      {/* Filters */}
      {showAllFunctions && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder="Search agents..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterDepartment} onValueChange={v => { setFilterDepartment(v); setFilterFunction('all'); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterFunction} onValueChange={setFilterFunction}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Functions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Functions</SelectItem>
              {filteredTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredAgents.length === 0 ? (
        <EmptyState icon={Bot} title="No agents found" />
      ) : showAllFunctions ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>AI Model</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Function</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.map(agent => {
                const dept = departments.find(d => d.id === (agent.team?.department_id || agent.department_id));
                return (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        {agent.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 capitalize">
                        {getTierIcon(agent.tier)}
                        {agent.tier || 'functional'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {agent.ai_provider && agent.ai_model ? (
                        <div className="text-xs">
                          <span className="font-medium">{PROVIDER_LABELS[agent.ai_provider] ?? agent.ai_provider}</span>
                          <br />
                          <span className="text-muted-foreground font-mono">{agent.ai_model}</span>
                        </div>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell><Badge className={getTypeBadgeClass(agent.type)}>{agent.type}</Badge></TableCell>
                    <TableCell><Badge className={getStatusBadgeClass(agent.status)}>{agent.status}</Badge></TableCell>
                    <TableCell>
                      {dept ? <Badge variant="outline" className="gap-1"><Building className="h-3 w-3" />{dept.name}</Badge> : '—'}
                    </TableCell>
                    <TableCell>
                      {agent.team ? <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" />{agent.team.name}</Badge> : '—'}
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleAgentStatus(agent)}>
                            {agent.status === 'active'
                              ? <PowerOff className="h-4 w-4 text-orange-500" />
                              : <Power className="h-4 w-4 text-green-500" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(agent)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(agent.id)}>
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
          {filteredAgents.map(agent => (
            <Card key={agent.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleAgentStatus(agent)}>
                        {agent.status === 'active'
                          ? <PowerOff className="h-4 w-4 text-orange-500" />
                          : <Power className="h-4 w-4 text-green-500" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(agent)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(agent.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {agent.description && <CardDescription>{agent.description}</CardDescription>}
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div className="flex flex-wrap gap-1">
                  <Badge className={getTypeBadgeClass(agent.type)}>{agent.type}</Badge>
                  <Badge className={getStatusBadgeClass(agent.status)}>{agent.status}</Badge>
                  <Badge variant="outline" className="gap-1 capitalize text-xs">
                    {getTierIcon(agent.tier)}
                    {agent.tier || 'functional'}
                  </Badge>
                </div>
                {agent.ai_provider && agent.ai_model && (
                  <div className="text-xs text-muted-foreground font-mono">
                    {PROVIDER_LABELS[agent.ai_provider] ?? agent.ai_provider} / {agent.ai_model}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog (reuse same form) */}
      {editingAgent && (
        <Dialog open={dialogOpen} onOpenChange={open => { if (!open) resetForm(); }}>
          {dialogForm}
        </Dialog>
      )}
    </div>
  );
};
