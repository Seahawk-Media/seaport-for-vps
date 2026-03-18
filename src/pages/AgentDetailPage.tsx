import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AgentChat } from "@/components/agents/AgentChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot, MessageSquare, Settings, Wrench, Sparkles, ArrowLeft,
  Save, Globe, Building, Users, Power, PowerOff, Trash2, Plus,
  Brain, Cpu, Zap, ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { cn } from "@/lib/utils";

// ─── Model catalogue (same as AgentsTab) ───────────────────────────

const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-opus-4-5", label: "Claude Opus 4.5" },
    { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { value: "claude-haiku-3-5", label: "Claude Haiku 3.5" },
  ],
  openai: [
    { value: "gpt-5", label: "GPT-5" },
    { value: "gpt-5-mini", label: "GPT-5 Mini" },
    { value: "gpt-5-nano", label: "GPT-5 Nano" },
  ],
  google: [
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  ],
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google Gemini",
};

// ─── Sidebar tabs ───────────────────────────────────────────────────

type TabKey = "overview" | "chat" | "tools" | "skills";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: Settings },
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "tools", label: "Tools", icon: Wrench },
  { key: "skills", label: "Skills", icon: Sparkles },
];

// ─── Page ───────────────────────────────────────────────────────────

const AgentDetailPage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin } = useRole();
  const canManage = isAdmin() || isSuperAdmin();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────

  const { data: agent, isLoading } = trpc.agents.get.useQuery(
    { id: agentId! },
    { enabled: !!agentId }
  );

  const departmentsQuery = trpc.departments.list.useQuery();
  const teamsQuery = trpc.teams.list.useQuery();
  const aiConfigQuery = trpc.aiConfig.list.useQuery();

  const departments = (departmentsQuery.data || []) as { id: string; name: string }[];
  const teams = (teamsQuery.data || []) as { id: string; name: string; departmentId: string | null }[];
  const aiConfigs = (aiConfigQuery.data || []) as { provider: string; isEnabled: boolean }[];
  const enabledProviders = aiConfigs.filter((c) => c.isEnabled);

  // ── Form state ───────────────────────────────────────────────────

  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "automation",
    status: "inactive",
    tier: "general",
    teamId: "",
    departmentId: "",
    aiProvider: "",
    aiModel: "",
    systemPrompt: "",
  });

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name || "",
        description: (agent as any).description || "",
        type: (agent as any).type || "automation",
        status: (agent as any).status || "inactive",
        tier: (agent as any).tier || "general",
        teamId: (agent as any).teamId || "",
        departmentId: (agent as any).departmentId || "",
        aiProvider: (agent as any).aiProvider || "",
        aiModel: (agent as any).aiModel || "",
        systemPrompt: (agent as any).systemPrompt || "",
      });
      setDirty(false);
    }
  }, [agent]);

  const updateField = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  // ── Mutations ────────────────────────────────────────────────────

  const utils = trpc.useUtils();

  const updateMutation = trpc.agents.update.useMutation({
    onSuccess: () => {
      toast({ title: "Agent updated" });
      setDirty(false);
      utils.agents.get.invalidate({ id: agentId! });
      utils.agents.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = trpc.agents.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Agent deleted" });
      navigate("/agents");
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!agentId) return;
    const selectedTeam = teams.find((t) => t.id === form.teamId);
    updateMutation.mutate({
      id: agentId,
      name: form.name,
      description: form.description || undefined,
      type: form.type,
      tier: form.tier,
      systemPrompt: form.systemPrompt || undefined,
      aiProvider: form.aiProvider || undefined,
      aiModel: form.aiModel || undefined,
      teamId: form.tier === "functional" ? form.teamId || undefined : undefined,
      departmentId:
        form.tier === "general"
          ? undefined
          : form.tier === "functional"
          ? selectedTeam?.departmentId || undefined
          : form.departmentId || undefined,
    });
  };

  const handleDelete = () => {
    if (!agentId) return;
    if (window.confirm("Delete this agent? This cannot be undone.")) {
      deleteMutation.mutate({ id: agentId });
    }
  };

  const toggleStatus = () => {
    const next = form.status === "active" ? "inactive" : "active";
    updateField("status", next);
    if (agentId) {
      updateMutation.mutate({ id: agentId, name: form.name, status: next } as any);
    }
  };

  // ── Chat conversation ────────────────────────────────────────────

  const { data: conversations } = trpc.agentChat.listConversations.useQuery(
    { agentId: agentId! },
    { enabled: !!agentId && !!user }
  );

  const createConversation = trpc.agentChat.createConversation.useMutation();

  useEffect(() => {
    if (!agentId || !user || !conversations) return;
    const active = conversations.find((c: any) => c.status === "active");
    if (active) {
      setConversationId(active.id);
    } else if (activeTab === "chat") {
      createConversation.mutate(
        { agentId, title: `Chat with ${agent?.name ?? "Agent"}` },
        { onSuccess: (data) => setConversationId(data.id) }
      );
    }
  }, [agentId, user, conversations, activeTab]);

  // ── Filtered teams for form ──────────────────────────────────────

  const formTeams = form.departmentId
    ? teams.filter((t) => t.departmentId === form.departmentId)
    : teams;

  // ── Loading state ────────────────────────────────────────────────

  if (isLoading || !agent) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
          Loading agent...
        </div>
      </DashboardLayout>
    );
  }

  // ── Tab: Overview ────────────────────────────────────────────────

  const renderOverview = () => (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-2xl">
        {/* Identity */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Identity
          </h3>

          <div className="space-y-2">
            <Label className="text-xs">Agent Name</Label>
            <Input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              disabled={!canManage}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={2}
              placeholder="What does this agent do?"
              disabled={!canManage}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => updateField("type", v)}
              disabled={!canManage}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automation">Automation</SelectItem>
                <SelectItem value="ai-assistant">AI Assistant</SelectItem>
                <SelectItem value="integration">Integration</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <Separator />

        {/* Scope */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Scope
          </h3>

          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "general", label: "General", desc: "Entire org", Icon: Globe },
              { value: "departmental", label: "Department", desc: "One department", Icon: Building },
              { value: "functional", label: "Function", desc: "One function", Icon: Users },
            ].map(({ value, label, desc, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  if (!canManage) return;
                  updateField("tier", value);
                  setForm((f) => ({ ...f, tier: value, teamId: "", departmentId: "" }));
                  setDirty(true);
                }}
                disabled={!canManage}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                  form.tier === value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground/30"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium">{label}</span>
                <span
                  className={cn(
                    "text-[10px] leading-snug",
                    form.tier === value ? "text-background/60" : "text-muted-foreground"
                  )}
                >
                  {desc}
                </span>
              </button>
            ))}
          </div>

          {(form.tier === "departmental" || form.tier === "functional") && (
            <div className="space-y-2">
              <Label className="text-xs">Department</Label>
              <Select
                value={form.departmentId}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, departmentId: v, teamId: "" }));
                  setDirty(true);
                }}
                disabled={!canManage}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.tier === "functional" && (
            <div className="space-y-2">
              <Label className="text-xs">Function</Label>
              <Select
                value={form.teamId}
                onValueChange={(v) => updateField("teamId", v)}
                disabled={!canManage}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select function" />
                </SelectTrigger>
                <SelectContent>
                  {formTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </section>

        <Separator />

        {/* AI Model */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            AI Model
          </h3>

          {enabledProviders.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Provider</Label>
                  <Select
                    value={form.aiProvider}
                    onValueChange={(v) => {
                      setForm((f) => ({ ...f, aiProvider: v, aiModel: "" }));
                      setDirty(true);
                    }}
                    disabled={!canManage}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {enabledProviders.map((c) => (
                        <SelectItem key={c.provider} value={c.provider}>
                          {PROVIDER_LABELS[c.provider] ?? c.provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Model</Label>
                  <Select
                    value={form.aiModel}
                    onValueChange={(v) => updateField("aiModel", v)}
                    disabled={!canManage || !form.aiProvider}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {(PROVIDER_MODELS[form.aiProvider] ?? []).map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.aiProvider && (
                <div className="space-y-2">
                  <Label className="text-xs">System Prompt</Label>
                  <Textarea
                    value={form.systemPrompt}
                    onChange={(e) => updateField("systemPrompt", e.target.value)}
                    rows={6}
                    placeholder="You are a helpful assistant for..."
                    disabled={!canManage}
                    className="font-mono text-sm"
                  />
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-6 text-center">
                <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No AI providers configured.
                  <br />
                  Go to <strong>Admin → AI Models</strong> to add an API key.
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        <Separator />

        {/* Danger Zone */}
        {canManage && (
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider">
              Danger Zone
            </h3>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Agent
            </Button>
          </section>
        )}

        {/* Spacer so content doesn't get cut off */}
        <div className="h-8" />
      </div>
    </ScrollArea>
  );

  // ── Tab: Chat ────────────────────────────────────────────────────

  const renderChat = () => (
    <div className="h-full">
      <AgentChat
        agentId={agentId!}
        agentName={agent.name}
        conversationId={conversationId}
      />
    </div>
  );

  // ── Tab: Tools ───────────────────────────────────────────────────

  const renderTools = () => (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Connected Tools
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Tools this agent can use during conversations
            </p>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" disabled>
              <Plus className="h-4 w-4 mr-2" />
              Connect Tool
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <Wrench className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium mb-1">No tools connected</p>
            <p className="text-xs text-muted-foreground">
              Connect MCP servers, APIs, or CLI tools to give this agent capabilities.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: Cpu, label: "MCP Server", desc: "Model Context Protocol" },
            { icon: Zap, label: "API Key", desc: "REST / GraphQL APIs" },
            { icon: Wrench, label: "CLI Tool", desc: "Command line tools" },
          ].map(({ icon: Icon, label, desc }) => (
            <button
              key={label}
              disabled
              className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-left opacity-50 cursor-not-allowed"
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </ScrollArea>
  );

  // ── Tab: Skills ──────────────────────────────────────────────────

  const renderSkills = () => (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-2xl">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Agent Skills
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Capabilities and behaviours this agent can perform
          </p>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium mb-1">No skills configured</p>
            <p className="text-xs text-muted-foreground">
              Skills let agents perform specialized tasks like data lookups, report generation, and workflow automation.
            </p>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );

  // ── Content map ──────────────────────────────────────────────────

  const tabContent: Record<TabKey, React.ReactNode> = {
    overview: renderOverview(),
    chat: renderChat(),
    tools: renderTools(),
    skills: renderSkills(),
  };

  // ── Tier icon helper ─────────────────────────────────────────────

  const TierIcon =
    form.tier === "general" ? Globe : form.tier === "departmental" ? Building : Users;

  // ── Render ───────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* ─── Left sidebar ─────────────────────────────────────── */}
        <div className="w-64 border-r flex flex-col bg-muted/30">
          {/* Back + agent header */}
          <div className="p-4 space-y-4">
            <button
              onClick={() => navigate("/agents")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All Agents
            </button>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{form.name || "Agent"}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={form.status === "active" ? "default" : "secondary"}
                      className="text-[10px] h-4 px-1.5"
                    >
                      {form.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5 capitalize">
                      <TierIcon className="h-2.5 w-2.5" />
                      {form.tier}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Status toggle */}
              {canManage && (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2">
                    {form.status === "active" ? (
                      <Power className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-xs">{form.status === "active" ? "Active" : "Inactive"}</span>
                  </div>
                  <Switch
                    checked={form.status === "active"}
                    onCheckedChange={toggleStatus}
                    className="scale-75"
                  />
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Tab navigation */}
          <nav className="flex-1 p-2 space-y-0.5">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm transition-colors",
                  activeTab === key
                    ? "bg-background text-foreground shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          {/* AI model indicator */}
          {form.aiProvider && form.aiModel && (
            <>
              <Separator />
              <div className="p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                  AI Model
                </p>
                <div className="flex items-center gap-2">
                  <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium">
                      {PROVIDER_LABELS[form.aiProvider] ?? form.aiProvider}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {form.aiModel}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Save button */}
          {canManage && dirty && (
            <>
              <Separator />
              <div className="p-3">
                <Button
                  onClick={handleSave}
                  size="sm"
                  className="w-full"
                  disabled={updateMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* ─── Main content ─────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden">{tabContent[activeTab]}</div>
      </div>
    </DashboardLayout>
  );
};

export default AgentDetailPage;
