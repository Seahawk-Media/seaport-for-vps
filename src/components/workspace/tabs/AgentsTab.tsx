import React, { useState } from 'react';
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
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { useOrganization } from "@/hooks/useOrganization";

// Model catalogue (mirrors AIModelsManagement)

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

// Types

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
  teamId: string | null;
  departmentId: string | null;
  tier: string | null;
  systemPrompt: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  team?: { id: string; name: string; departmentId: string | null } | null;
}

interface Department { id: string; name: string }
interface Team { id: string; name: string; departmentId: string | null }
interface AIConfig { provider: string; isEnabled: boolean }

// Component

export const AgentsTab: React.FC<AgentsTabProps> = ({
  departmentId, functionId, showAllFunctions = false, showDeptAll = false,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'automation',
    status: 'inactive',
    tier: showAllFunctions ? 'general' : (functionId ? 'functional' : 'departmental'),
    teamId: '',
    departmentId: '',
    aiProvider: '',
    aiModel: '',
    systemPrompt: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterFunction, setFilterFunction] = useState('all');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin } = useRole();
  const { organization } = useOrganization();

  const canManage = isAdmin() || isSuperAdmin();
  const utils = trpc.useUtils();

  const agentsQuery = trpc.agents.list.useQuery();
  const departmentsQuery = trpc.departments.list.useQuery();
  const teamsQuery = trpc.teams.list.useQuery();
  const aiConfigQuery = trpc.aiConfig.list.useQuery();

  const createMutation = trpc.agents.create.useMutation({
    onSuccess: () => {
      toast({ title: 'Agent created' });
      resetForm();
      utils.agents.list.invalidate();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = trpc.agents.update.useMutation({
    onSuccess: () => {
      toast({ title: 'Agent updated' });
      resetForm();
      utils.agents.list.invalidate();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = trpc.agents.delete.useMutation({
    onSuccess: () => {
      toast({ title: 'Agent deleted' });
      utils.agents.list.invalidate();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const allAgents = (agentsQuery.data || []) as Agent[];
  const departments = (departmentsQuery.data || []) as Department[];
  const teams = (teamsQuery.data || []) as Team[];
  const aiConfigs = (aiConfigQuery.data || []) as AIConfig[];
  const loading = agentsQuery.isLoading;

  const enabledProviders = aiConfigs.filter(c => c.isEnabled);

  // Filter agents based on scope
  const agents = allAgents.filter(agent => {
    if (showAllFunctions) return true;
    if (functionId) return agent.teamId === functionId;
    if (showDeptAll && departmentId) return agent.departmentId === departmentId;
    if (departmentId) return agent.departmentId === departmentId && !agent.teamId;
    return true;
  });

  const resetForm = () => {
    setDialogOpen(false);
    setEditingAgent(null);
    setFormData({
      name: '', description: '', type: 'automation', status: 'inactive',
      tier: showAllFunctions ? 'general' : (functionId ? 'functional' : 'departmental'),
      teamId: '', departmentId: '', aiProvider: '', aiModel: '', systemPrompt: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    const tier = formData.tier;

    // Validation
    if (tier === 'functional' && !formData.teamId) {
      toast({ title: 'Please select a function', variant: 'destructive' }); return;
    }
    if (tier === 'departmental' && !formData.departmentId) {
      toast({ title: 'Please select a department', variant: 'destructive' }); return;
    }

    const selectedTeam = teams.find(t => t.id === formData.teamId);

    const basePayload = {
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type,
      tier,
      systemPrompt: formData.systemPrompt || undefined,
      aiProvider: formData.aiProvider || undefined,
      aiModel: formData.aiModel || undefined,
      teamId: tier === 'functional' ? (formData.teamId || undefined) : undefined,
      departmentId:
        tier === 'general' ? undefined :
        tier === 'functional' ? (selectedTeam?.departmentId || undefined) :
        (formData.departmentId || undefined),
    };

    // If context-fixed (in a function workspace), override
    if (!showAllFunctions && functionId) {
      basePayload.teamId = functionId;
      basePayload.departmentId = departmentId || undefined;
    } else if (!showAllFunctions && departmentId) {
      basePayload.departmentId = departmentId;
    }

    if (editingAgent) {
      updateMutation.mutate({ id: editingAgent.id, ...basePayload });
    } else {
      createMutation.mutate(basePayload);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  const toggleAgentStatus = (agent: Agent) => {
    const newStatus = agent.status === 'active' ? 'inactive' : 'active';
    updateMutation.mutate({ id: agent.id, name: agent.name }, {
      onSuccess: () => {
        toast({ title: `Agent ${newStatus === 'active' ? 'activated' : 'deactivated'}` });
        utils.agents.list.invalidate();
      },
    });
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      description: agent.description || '',
      type: agent.type || 'automation',
      status: agent.status || 'inactive',
      tier: agent.tier || 'functional',
      teamId: agent.teamId || '',
      departmentId: agent.departmentId || '',
      aiProvider: agent.aiProvider || '',
      aiModel: agent.aiModel || '',
      systemPrompt: agent.systemPrompt || '',
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
    const agentDeptId = agent.team?.departmentId || agent.departmentId;
    const matchesDept = filterDepartment === 'all' || agentDeptId === filterDepartment;
    const matchesFunc = filterFunction === 'all' || agent.teamId === filterFunction;
    return matchesSearch && matchesDept && matchesFunc;
  });

  const filteredTeams = filterDepartment === 'all' ? teams : teams.filter(t => t.departmentId === filterDepartment);
  const formTeams = formData.departmentId
    ? teams.filter(t => t.departmentId === formData.departmentId)
    : teams;

  if (loading) return <div className="flex items-center justify-center h-48 text-muted-foreground">Loading agents...</div>;

  // Dialog form
  const dialogForm = (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{editingAgent ? 'Edit Agent' : 'Create Agent'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">

        {/* Scope */}
        {(showAllFunctions || editingAgent) && (
          <div className="space-y-2">
            <Label className="text-xs">Tier</Label>
            <div className="grid grid-cols-3 gap-2">
              {TIER_OPTIONS.map(({ value, label, description, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, tier: value, teamId: '', departmentId: '' }))}
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
            <Select value={formData.departmentId} onValueChange={v => setFormData(f => ({ ...f, departmentId: v, teamId: '' }))}>
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
            <Select value={formData.teamId} onValueChange={v => setFormData(f => ({ ...f, teamId: v }))}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select function" />
              </SelectTrigger>
              <SelectContent>
                {formTeams.map(t => {
                  const dept = departments.find(d => d.id === t.departmentId);
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
                <Select value={formData.aiProvider} onValueChange={v => setFormData(f => ({ ...f, aiProvider: v, aiModel: '' }))}>
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
                  value={formData.aiModel}
                  onValueChange={v => setFormData(f => ({ ...f, aiModel: v }))}
                  disabled={!formData.aiProvider}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select model" /></SelectTrigger>
                  <SelectContent>
                    {(PROVIDER_MODELS[formData.aiProvider] ?? []).map(m => (
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
            <p className="text-xs text-muted-foreground">No AI providers connected. Go to <strong>Admin - AI Models</strong> to add a key.</p>
          </div>
        )}

        {/* System Prompt */}
        {formData.aiProvider && (
          <div className="space-y-1.5">
            <Label className="text-xs">System Prompt</Label>
            <Textarea
              placeholder="You are a helpful assistant for [team name]..."
              value={formData.systemPrompt}
              onChange={e => setFormData(f => ({ ...f, systemPrompt: e.target.value }))}
              rows={3}
            />
          </div>
        )}

        <Button type="submit" className="w-full">{editingAgent ? 'Update' : 'Create'} Agent</Button>
      </form>
    </DialogContent>
  );

  // Render
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
                const dept = departments.find(d => d.id === (agent.team?.departmentId || agent.departmentId));
                return (
                  <TableRow key={agent.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/agents/${agent.id}`)}>
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
                      {agent.aiProvider && agent.aiModel ? (
                        <div className="text-xs">
                          <span className="font-medium">{PROVIDER_LABELS[agent.aiProvider] ?? agent.aiProvider}</span>
                          <br />
                          <span className="text-muted-foreground font-mono">{agent.aiModel}</span>
                        </div>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </TableCell>
                    <TableCell><Badge className={getTypeBadgeClass(agent.type)}>{agent.type}</Badge></TableCell>
                    <TableCell><Badge className={getStatusBadgeClass(agent.status)}>{agent.status}</Badge></TableCell>
                    <TableCell>
                      {dept ? <Badge variant="outline" className="gap-1"><Building className="h-3 w-3" />{dept.name}</Badge> : '-'}
                    </TableCell>
                    <TableCell>
                      {agent.team ? <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" />{agent.team.name}</Badge> : '-'}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleAgentStatus(agent)}>
                            {agent.status === 'active'
                              ? <PowerOff className="h-4 w-4 text-orange-500" />
                              : <Power className="h-4 w-4 text-green-500" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/agents/${agent.id}`)}>
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
            <Card key={agent.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/agents/${agent.id}`)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                  </div>
                  {canManage && (
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleAgentStatus(agent)}>
                        {agent.status === 'active'
                          ? <PowerOff className="h-4 w-4 text-orange-500" />
                          : <Power className="h-4 w-4 text-green-500" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/agents/${agent.id}`)}>
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
                {agent.aiProvider && agent.aiModel && (
                  <div className="text-xs text-muted-foreground font-mono">
                    {PROVIDER_LABELS[agent.aiProvider] ?? agent.aiProvider} / {agent.aiModel}
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
