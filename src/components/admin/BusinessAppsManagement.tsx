import React, { useState } from 'react';
import {
  BarChart2, Briefcase, CheckSquare, CreditCard,
  FileText, Globe, Grid3X3, Headphones, ImageIcon,
  LayoutDashboard, Zap, ExternalLink, Plus, Pencil,
  RotateCcw, Check, X, Link, ArrowUpRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSuiteConfig, SuiteApp } from '@/hooks/useSuiteConfig';

// ─── Pattern SVGs ─────────────────────────────────────────────────────────────

const APP_PATTERNS: Record<string, string> = {
  crm: 'dots', projects: 'grid', billing: 'lines', support: 'waves',
  website: 'cross', files: 'zigzag', brand: 'checker', analytics: 'bars',
  automations: 'circuit',
};

const APP_INDEX: Record<string, string> = {
  crm: '01', projects: '02', billing: '03', support: '04',
  website: '05', files: '06', brand: '07', analytics: '08', automations: '09',
};

function PatternBg({ pattern, id }: { pattern: string; id: string }) {
  const uid = `p-${id}-${pattern}`;
  const defs: Record<string, React.ReactNode> = {
    dots: <pattern id={uid} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="currentColor" /></pattern>,
    grid: <pattern id={uid} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="currentColor" strokeWidth="0.8" /></pattern>,
    lines: <pattern id={uid} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse"><line x1="0" y1="8" x2="8" y2="0" stroke="currentColor" strokeWidth="1" /></pattern>,
    waves: <pattern id={uid} x="0" y="0" width="20" height="10" patternUnits="userSpaceOnUse"><path d="M0 5 Q5 0 10 5 Q15 10 20 5" fill="none" stroke="currentColor" strokeWidth="1" /></pattern>,
    cross: <pattern id={uid} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse"><line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="0.8" /><line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="0.8" /></pattern>,
    zigzag: <pattern id={uid} x="0" y="0" width="16" height="8" patternUnits="userSpaceOnUse"><polyline points="0,8 8,0 16,8" fill="none" stroke="currentColor" strokeWidth="1" /></pattern>,
    checker: <pattern id={uid} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse"><rect x="0" y="0" width="6" height="6" fill="currentColor" /><rect x="6" y="6" width="6" height="6" fill="currentColor" /></pattern>,
    bars: <pattern id={uid} x="0" y="0" width="8" height="24" patternUnits="userSpaceOnUse"><rect x="1" y="16" width="6" height="8" fill="currentColor" /><rect x="1" y="8" width="6" height="6" fill="currentColor" opacity="0.6" /><rect x="1" y="2" width="6" height="4" fill="currentColor" opacity="0.3" /></pattern>,
    circuit: <pattern id={uid} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="currentColor" /><line x1="2" y1="2" x2="10" y2="2" stroke="currentColor" strokeWidth="0.8" /><line x1="10" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="0.8" /><circle cx="10" cy="10" r="1.5" fill="currentColor" /></pattern>,
  };
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.1]" xmlns="http://www.w3.org/2000/svg">
      <defs>{defs[pattern]}</defs>
      <rect width="100%" height="100%" fill={`url(#${uid})`} />
    </svg>
  );
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Briefcase:   <Briefcase   className="h-5 w-5" />,
  CheckSquare: <CheckSquare className="h-5 w-5" />,
  CreditCard:  <CreditCard  className="h-5 w-5" />,
  Headphones:  <Headphones  className="h-5 w-5" />,
  Globe:       <Globe       className="h-5 w-5" />,
  FileText:    <FileText    className="h-5 w-5" />,
  ImageIcon:   <ImageIcon   className="h-5 w-5" />,
  BarChart2:   <BarChart2   className="h-5 w-5" />,
  Zap:         <Zap         className="h-5 w-5" />,
};

// ─── App Card ─────────────────────────────────────────────────────────────────

interface AppCardProps {
  app: SuiteApp;
  onToggleConnect: (id: string) => void;
  onSaveConfig: (id: string, name: string, url: string, iconUrl: string) => void;
}

const AppCard: React.FC<AppCardProps> = ({ app, onToggleConnect, onSaveConfig }) => {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(app.name);
  const [draftUrl, setDraftUrl] = useState(app.url);
  const [draftIconUrl, setDraftIconUrl] = useState(app.iconUrl);
  const [iconError, setIconError] = useState(false);

  const save = () => {
    onSaveConfig(app.id, draftName.trim() || app.name, draftUrl.trim(), draftIconUrl.trim());
    setEditing(false);
  };

  const cancel = () => {
    setDraftName(app.name); setDraftUrl(app.url);
    setDraftIconUrl(app.iconUrl); setIconError(false); setEditing(false);
  };

  const openEdit = () => {
    setDraftName(app.name); setDraftUrl(app.url);
    setDraftIconUrl(app.iconUrl); setIconError(false); setEditing(true);
  };

  const isConnected = app.status === 'connected';
  const pattern = APP_PATTERNS[app.id] ?? 'dots';
  const index = APP_INDEX[app.id] ?? '—';

  return (
    <div className={cn(
      'flex flex-col rounded-xl border overflow-hidden transition-all duration-200',
      isConnected
        ? 'border-foreground/20 shadow-sm'
        : 'border-border',
    )}>
      {/* Visual header */}
      <div className={cn(
        'relative overflow-hidden flex items-start justify-between p-4 pb-3',
        isConnected ? 'bg-foreground text-background' : 'bg-muted/40 text-foreground',
      )}>
        <PatternBg pattern={pattern} id={app.id} />
        <div className="relative flex items-center gap-2.5">
          <div className={cn(
            'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border',
            isConnected ? 'bg-background/10 border-background/20' : 'bg-muted border-border',
          )}>
            {app.iconUrl && !iconError ? (
              <img src={app.iconUrl} alt={app.name} className={cn('h-6 w-6 object-contain', isConnected && 'invert')} onError={() => setIconError(true)} />
            ) : (
              <div className={isConnected ? 'text-background/80' : 'text-muted-foreground'}>
                {ICON_MAP[app.defaultIcon] ?? <Briefcase className="h-5 w-5" />}
              </div>
            )}
          </div>
          <div>
            <p className={cn('text-sm font-semibold leading-tight', isConnected ? 'text-background' : 'text-foreground')}>{app.name}</p>
            <p className={cn('text-[10px] font-mono mt-0.5', isConnected ? 'text-background/40' : 'text-muted-foreground/60')}>{index}</p>
          </div>
        </div>
        <div className="relative flex items-center gap-1.5">
          {isConnected && (
            <span className="text-[9px] font-mono uppercase tracking-wider bg-background/20 text-background px-1.5 py-0.5 rounded">live</span>
          )}
          {app.url && !editing && (
            <a href={app.url} target="_blank" rel="noopener noreferrer">
              <ArrowUpRight className={cn('h-3.5 w-3.5 transition-colors', isConnected ? 'text-background/50 hover:text-background' : 'text-muted-foreground hover:text-foreground')} />
            </a>
          )}
        </div>
      </div>

      {/* URL row */}
      {app.url && !editing && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border bg-muted/20">
          <Link className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-[10px] text-muted-foreground truncate flex-1 font-mono">{app.url}</span>
        </div>
      )}

      {/* Edit panel */}
      {editing && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3 bg-card">
          <div className="space-y-1.5">
            <Label className="text-xs">App Name</Label>
            <Input value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="e.g. CRM" className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">App Icon URL</Label>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">48×48 · SVG/PNG</span>
            </div>
            <div className="flex gap-2 items-center">
              <div className="h-8 w-8 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                {draftIconUrl && !iconError
                  ? <img src={draftIconUrl} alt="preview" className="h-6 w-6 object-contain" onError={() => setIconError(true)} onLoad={() => setIconError(false)} />
                  : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
              </div>
              <Input value={draftIconUrl} onChange={e => { setDraftIconUrl(e.target.value); setIconError(false); }} placeholder="https://example.com/icon.svg" className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">App Login URL</Label>
            <Input value={draftUrl} onChange={e => setDraftUrl(e.target.value)} placeholder="https://app.example.com/login" className="h-8 text-xs" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-7 text-xs gap-1 flex-1" onClick={save}><Check className="h-3 w-3" /> Save</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={cancel}><X className="h-3 w-3" /> Cancel</Button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border mt-auto bg-card">
          <Button
            size="sm"
            variant={isConnected ? 'outline' : 'default'}
            className="h-7 text-xs flex-1"
            onClick={() => onToggleConnect(app.id)}
          >
            {isConnected ? 'Disconnect' : 'Connect'}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Configure" onClick={openEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────

export const BusinessAppsManagement: React.FC = () => {
  const { config, update, updateApp, reset, DEFAULT_CONFIG } = useSuiteConfig();

  const [editingIdentity, setEditingIdentity] = useState(false);
  const [draftName, setDraftName] = useState(config.name);
  const [draftIconUrl, setDraftIconUrl] = useState(config.iconUrl);
  const [suiteIconError, setSuiteIconError] = useState(false);

  const startEdit = () => {
    setDraftName(config.name); setDraftIconUrl(config.iconUrl);
    setSuiteIconError(false); setEditingIdentity(true);
  };

  const saveEdit = () => {
    update({ name: draftName.trim() || DEFAULT_CONFIG.name, iconUrl: draftIconUrl.trim() });
    setEditingIdentity(false);
  };

  const toggleConnect = (id: string) => {
    const app = config.apps.find(a => a.id === id);
    if (!app) return;
    updateApp(id, { status: app.status === 'connected' ? 'available' : 'connected' });
  };

  const saveAppConfig = (id: string, name: string, url: string, iconUrl: string) => {
    updateApp(id, { name, url, iconUrl });
  };

  const connectedCount = config.apps.filter(a => a.status === 'connected').length;

  return (
    <div className="space-y-6">
      {/* Suite Identity Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Dark header strip */}
        <div className="relative overflow-hidden bg-foreground px-4 py-3 flex items-center justify-between">
          <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="id-grid" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                <path d="M 16 0 L 0 0 0 16" fill="none" stroke="currentColor" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#id-grid)" />
          </svg>
          <div className="relative flex items-center gap-2.5">
            {/* Suite icon: custom or generic Grid3X3 */}
            <div className="h-9 w-9 rounded-lg bg-background/10 border border-background/20 flex items-center justify-center overflow-hidden flex-shrink-0">
              {config.iconUrl && !suiteIconError ? (
                <img src={config.iconUrl} alt="Suite" className="h-6 w-6 object-contain invert" onError={() => setSuiteIconError(true)} />
              ) : (
                <Grid3X3 className="h-4 w-4 text-background/80" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-background leading-tight">{config.name}</p>
              <p className="text-[10px] font-mono text-background/40">Suite Identity</p>
            </div>
          </div>
          {!editingIdentity && (
            <Button variant="ghost" size="sm" className="relative h-7 text-xs gap-1.5 text-background/60 hover:text-background hover:bg-background/10" onClick={startEdit}>
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          )}
        </div>

        {/* Edit form */}
        {editingIdentity && (
          <div className="p-4 space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 text-center">
                <div className="h-12 w-12 rounded-xl border border-border bg-foreground flex items-center justify-center overflow-hidden">
                  {draftIconUrl && !suiteIconError ? (
                    <img src={draftIconUrl} alt="preview" className="h-7 w-7 object-contain invert" onError={() => setSuiteIconError(true)} onLoad={() => setSuiteIconError(false)} />
                  ) : (
                    <Grid3X3 className="h-5 w-5 text-background/80" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Preview</p>
              </div>
              <div className="flex-1 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Suite Name</Label>
                  <Input value={draftName} onChange={e => setDraftName(e.target.value)} placeholder={DEFAULT_CONFIG.name} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Suite Icon URL</Label>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">24×24 · SVG/PNG</span>
                  </div>
                  <Input value={draftIconUrl} onChange={e => { setDraftIconUrl(e.target.value); setSuiteIconError(false); }} placeholder="https://example.com/logo.svg" className="h-8 text-sm" />
                  <p className="text-[10px] text-muted-foreground">Leave blank to use the default grid icon</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs gap-1.5" onClick={saveEdit}><Check className="h-3 w-3" /> Save</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setEditingIdentity(false)}><X className="h-3 w-3" /> Cancel</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5 ml-auto text-muted-foreground" onClick={() => { reset(); setEditingIdentity(false); }}>
                <RotateCcw className="h-3 w-3" /> Reset to default
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* What are IBAs? */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 mt-0.5 flex-shrink-0">
            <LayoutDashboard className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Internal Business Apps (IBAs)</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              IBAs are the AI-powered tools your team builds and operates — CRMs, project trackers, billing systems, support desks, and more.
              {import.meta.env.VITE_APP_NAME || 'Seaport'} centralizes them so every employee has a single launcher to access every tool.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { label: 'Connect', desc: "Link your app's login URL" },
            { label: 'Brand it', desc: 'Add a name and custom icon' },
            { label: 'Launch', desc: 'Appears in the app launcher for all users' },
          ].map((s) => (
            <div key={s.label} className="rounded-md bg-muted/60 px-3 py-2 text-center">
              <p className="text-xs font-semibold">{s.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Apps section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Apps</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure icon and login URL for each app.
            {connectedCount > 0 && <span className="ml-1 text-foreground font-medium">{connectedCount} connected</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
          <Plus className="h-3.5 w-3.5" /> Add App
        </Button>
      </div>

      {/* Apps grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {config.apps.map(app => (
          <AppCard key={app.id} app={app} onToggleConnect={toggleConnect} onSaveConfig={saveAppConfig} />
        ))}
      </div>
    </div>
  );
};
