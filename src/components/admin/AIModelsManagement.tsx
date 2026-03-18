import React, { useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, Loader2, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';

// ─── Provider definitions ─────────────────────────────────────────────────────

interface ProviderDef {
  id: string;
  name: string;
  logo: React.ReactNode;
  models: { value: string; label: string }[];
  docsUrl: string;
  keyPlaceholder: string;
  keyPrefix: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    logo: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-foreground">
        <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-6.468 0H11.03l6.57 16.48H14L12.246 15H5.754L4 20H.397L7.359 3.52zM9 7.56l-2.25 5.64h4.5L9 7.56z" />
      </svg>
    ),
    models: [
      { value: 'claude-opus-4-5', label: 'Claude Opus 4.5 (Most Capable)' },
      { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Balanced)' },
      { value: 'claude-haiku-3-5', label: 'Claude Haiku 3.5 (Fast)' },
    ],
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-api03-...',
    keyPrefix: 'sk-ant-',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    logo: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-foreground">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.843-3.369 2.02-1.168a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.402-.681zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
      </svg>
    ),
    models: [
      { value: 'gpt-5', label: 'GPT-5 (Most Capable)' },
      { value: 'gpt-5-mini', label: 'GPT-5 Mini (Balanced)' },
      { value: 'gpt-5-nano', label: 'GPT-5 Nano (Fast)' },
    ],
    docsUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-proj-...',
    keyPrefix: 'sk-',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    logo: (
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        <path d="M12 24A14.304 14.304 0 0 0 0 12 14.304 14.304 0 0 0 12 0a14.305 14.305 0 0 0 12 12 14.305 14.305 0 0 0-12 12" fill="#1967D2"/>
      </svg>
    ),
    models: [
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Most Capable)' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Balanced)' },
      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Fast)' },
    ],
    docsUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIzaSy...',
    keyPrefix: 'AIza',
  },
];

// ─── Provider Card ─────────────────────────────────────────────────────────────

interface ProviderCardProps {
  def: ProviderDef;
  saved: { isEnabled: boolean; apiKeyHint: string | null } | null;
  onSave: (providerId: string, apiKey: string) => Promise<void>;
  onRemove: (providerId: string) => Promise<void>;
}

const ProviderCard: React.FC<ProviderCardProps> = ({ def, saved, onSave, onRemove }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const isConnected = !!saved?.isEnabled;

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    await onSave(def.id, apiKey.trim());
    setApiKey('');
    setSaving(false);
  };

  const handleRemove = async () => {
    setRemoving(true);
    await onRemove(def.id);
    setRemoving(false);
  };

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all',
      isConnected ? 'border-foreground/20 shadow-sm' : 'border-border',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3',
        isConnected ? 'bg-foreground text-background' : 'bg-muted/40',
      )}>
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center border',
            isConnected ? 'bg-background/10 border-background/20' : 'bg-background border-border',
          )}>
            {def.logo}
          </div>
          <div>
            <p className={cn('text-sm font-semibold', isConnected ? 'text-background' : 'text-foreground')}>{def.name}</p>
            {isConnected && saved?.apiKeyHint && (
              <p className="text-[10px] font-mono text-background/50">····{saved.apiKeyHint}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <span className="text-[9px] font-mono uppercase tracking-wider bg-background/20 text-background px-1.5 py-0.5 rounded">connected</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-background/60 hover:text-background hover:bg-background/10"
                onClick={handleRemove}
                disabled={removing}
              >
                {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">Not connected</Badge>
          )}
        </div>
      </div>

      {/* Models list */}
      <div className="px-4 py-3 border-t border-border bg-card">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Available Models</p>
        <div className="space-y-1">
          {def.models.map(m => (
            <div key={m.value} className="flex items-center gap-2">
              <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', isConnected ? 'bg-primary' : 'bg-muted-foreground/30')} />
              <span className="text-xs text-muted-foreground font-mono">{m.value}</span>
              <span className="text-[10px] text-muted-foreground/60 hidden sm:block">— {m.label.split('(')[1]?.replace(')', '') ?? ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Key input */}
      <div className="px-4 pb-4 pt-3 border-t border-border bg-card space-y-2">
        <Label className="text-xs">{isConnected ? 'Update API Key' : 'Add API Key'}</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type={showKey ? 'text' : 'password'}
              placeholder={def.keyPlaceholder}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="pl-8 pr-8 h-8 text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs gap-1 px-3"
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Save
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Get your key from{' '}
          <a href={def.docsUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
            {def.docsUrl.replace('https://', '').split('/')[0]}
          </a>
          . Keys are encrypted and never exposed to users.
        </p>
      </div>
    </div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────

export const AIModelsManagement: React.FC = () => {
  const { organization } = useOrganization();
  const { toast } = useToast();

  const utils = trpc.useUtils();
  const { data: configList = [], isLoading: loading } = trpc.aiConfig.list.useQuery(undefined, {
    enabled: !!organization,
  });

  const upsertMutation = trpc.aiConfig.upsert.useMutation({
    onSuccess: () => { utils.aiConfig.list.invalidate(); },
  });

  // Build a lookup map from provider to config
  const configs: Record<string, { isEnabled: boolean; apiKeyHint: string | null }> = {};
  for (const row of configList) {
    configs[row.provider] = { isEnabled: row.isEnabled ?? false, apiKeyHint: row.apiKeyHint };
  }

  const handleSave = async (provider: string, apiKey: string) => {
    if (!organization) return;
    try {
      await upsertMutation.mutateAsync({ provider, apiKey, isEnabled: true });
      toast({ title: `${provider} connected`, description: 'API key saved. Agents can now use this provider.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error saving key', description: message, variant: 'destructive' });
    }
  };

  const handleRemove = async (provider: string) => {
    if (!organization) return;
    try {
      await upsertMutation.mutateAsync({ provider, apiKeyHint: undefined, isEnabled: false });
      toast({ title: `${provider} disconnected` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error removing key', description: message, variant: 'destructive' });
    }
  };

  const connectedCount = Object.values(configs).filter(c => c.isEnabled).length;

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="relative overflow-hidden bg-foreground px-4 py-3">
          <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="ai-circuit" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="currentColor" />
                <line x1="2" y1="2" x2="10" y2="2" stroke="currentColor" strokeWidth="0.8" />
                <line x1="10" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="0.8" />
                <circle cx="10" cy="10" r="1.5" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ai-circuit)" />
          </svg>
          <div className="relative flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-background/10 border border-background/20 flex items-center justify-center">
              <Zap className="h-4 w-4 text-background/80" />
            </div>
            <div>
              <p className="text-sm font-semibold text-background">AI Model Configuration</p>
              <p className="text-[10px] font-mono text-background/40">
                {connectedCount} provider{connectedCount !== 1 ? 's' : ''} connected
              </p>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 bg-muted/30">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Connect AI providers so agents can use them. Each agent can then select its own provider and model — giving your Support agent Claude, your Analytics agent GPT-5, and so on.
            Keys are stored securely and only used server-side when agents are invoked.
          </p>
        </div>
      </div>

      {/* Provider cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {PROVIDERS.map(def => (
            <ProviderCard
              key={def.id}
              def={def}
              saved={configs[def.id] ?? null}
              onSave={handleSave}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
};
