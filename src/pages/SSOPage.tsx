import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useSuiteConfig } from '@/hooks/useSuiteConfig';
import { ExternalLink, Grid3X3, Settings, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BarChart2, Briefcase, CheckSquare, CreditCard,
  FileText, Globe, Headphones, ImageIcon, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Each app gets a unique B&W pattern identifier
const APP_PATTERNS: Record<string, { pattern: string; label: string }> = {
  crm:         { pattern: 'dots',     label: '01' },
  projects:    { pattern: 'grid',     label: '02' },
  billing:     { pattern: 'lines',    label: '03' },
  support:     { pattern: 'waves',    label: '04' },
  website:     { pattern: 'cross',    label: '05' },
  files:       { pattern: 'zigzag',   label: '06' },
  brand:       { pattern: 'checker',  label: '07' },
  analytics:   { pattern: 'bars',     label: '08' },
  automations: { pattern: 'circuit',  label: '09' },
};

const ICON_MAP: Record<string, React.ReactNode> = {
  Briefcase:   <Briefcase   className="h-7 w-7" />,
  CheckSquare: <CheckSquare className="h-7 w-7" />,
  CreditCard:  <CreditCard  className="h-7 w-7" />,
  Headphones:  <Headphones  className="h-7 w-7" />,
  Globe:       <Globe       className="h-7 w-7" />,
  FileText:    <FileText    className="h-7 w-7" />,
  ImageIcon:   <ImageIcon   className="h-7 w-7" />,
  BarChart2:   <BarChart2   className="h-7 w-7" />,
  Zap:         <Zap         className="h-7 w-7" />,
};

// SVG background patterns per type
function PatternBg({ pattern }: { pattern: string }) {
  const patterns: Record<string, React.ReactNode> = {
    dots: (
      <svg className="absolute inset-0 w-full h-full opacity-[0.12]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dots" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>
    ),
    grid: (
      <svg className="absolute inset-0 w-full h-full opacity-[0.1]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M 12 0 L 0 0 0 12" fill="none" stroke="currentColor" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    ),
    lines: (
      <svg className="absolute inset-0 w-full h-full opacity-[0.1]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="lines" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <line x1="0" y1="8" x2="8" y2="0" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lines)" />
      </svg>
    ),
    waves: (
      <svg className="absolute inset-0 w-full h-full opacity-[0.1]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="waves" x="0" y="0" width="20" height="10" patternUnits="userSpaceOnUse">
            <path d="M0 5 Q5 0 10 5 Q15 10 20 5" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#waves)" />
      </svg>
    ),
    cross: (
      <svg className="absolute inset-0 w-full h-full opacity-[0.1]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="cross" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
            <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="0.8" />
            <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cross)" />
      </svg>
    ),
    zigzag: (
      <svg className="absolute inset-0 w-full h-full opacity-[0.1]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="zigzag" x="0" y="0" width="16" height="8" patternUnits="userSpaceOnUse">
            <polyline points="0,8 8,0 16,8" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#zigzag)" />
      </svg>
    ),
    checker: (
      <svg className="absolute inset-0 w-full h-full opacity-[0.08]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="checker" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="6" height="6" fill="currentColor" />
            <rect x="6" y="6" width="6" height="6" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#checker)" />
      </svg>
    ),
    bars: (
      <svg className="absolute inset-0 w-full h-full opacity-[0.1]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="bars" x="0" y="0" width="8" height="24" patternUnits="userSpaceOnUse">
            <rect x="1" y="16" width="6" height="8" fill="currentColor" />
            <rect x="1" y="8" width="6" height="6" fill="currentColor" opacity="0.6" />
            <rect x="1" y="2" width="6" height="4" fill="currentColor" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bars)" />
      </svg>
    ),
    circuit: (
      <svg className="absolute inset-0 w-full h-full opacity-[0.1]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="circuit" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="currentColor" />
            <line x1="2" y1="2" x2="10" y2="2" stroke="currentColor" strokeWidth="0.8" />
            <line x1="10" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="0.8" />
            <circle cx="10" cy="10" r="1.5" fill="currentColor" />
            <line x1="10" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#circuit)" />
      </svg>
    ),
  };
  return <>{patterns[pattern] ?? null}</>;
}

export default function SSOPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { config } = useSuiteConfig();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const connectedApps = config.apps.filter(a => a.status === 'connected' && a.url);
  const availableApps = config.apps.filter(a => a.status !== 'connected');

  if (authLoading) return null;

  return (
    <DashboardLayout title="SSO" description="Your organization's app launcher">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-foreground flex items-center justify-center flex-shrink-0">
              <Grid3X3 className="h-4 w-4 text-background" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">{config.name}</h2>
              <p className="text-xs text-muted-foreground">
                {connectedApps.length} of {config.apps.length} apps connected
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => navigate('/org')}
          >
            <Settings className="h-3.5 w-3.5" />
            Configure Apps
          </Button>
        </div>

        {/* Connected apps */}
        {connectedApps.length > 0 ? (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">My Apps</span>
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] font-mono text-muted-foreground">{connectedApps.length}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {connectedApps.map((app) => {
                const meta = APP_PATTERNS[app.id] ?? { pattern: 'dots', label: '—' };
                return (
                  <a
                    key={app.id}
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'group relative overflow-hidden flex flex-col gap-3 p-4 rounded-xl border border-foreground/10',
                      'bg-foreground text-background',
                      'hover:border-foreground/60 transition-all duration-200 cursor-pointer',
                      'shadow-sm hover:shadow-md',
                    )}
                  >
                    <PatternBg pattern={meta.pattern} />
                    <div className="relative flex items-start justify-between">
                      <div className="h-10 w-10 rounded-lg bg-background/10 flex items-center justify-center overflow-hidden border border-background/20">
                        {app.iconUrl ? (
                          <img src={app.iconUrl} alt={app.name} className="h-6 w-6 object-contain invert" />
                        ) : (
                          <div className="text-background/80">
                            {ICON_MAP[app.defaultIcon] ?? <Briefcase className="h-7 w-7" />}
                          </div>
                        )}
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-background/30 group-hover:text-background/80 transition-colors" />
                    </div>
                    <div className="relative">
                      <p className="text-xs font-semibold leading-tight text-background">{app.name}</p>
                      <p className="text-[10px] font-mono text-background/40 mt-0.5">{meta.label}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 flex flex-col items-center gap-3 text-center">
            <Grid3X3 className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">No apps connected yet</p>
              <p className="text-xs text-muted-foreground mt-1">Ask your admin to connect apps in Org Settings → Business Apps.</p>
            </div>
            <Button variant="outline" size="sm" className="mt-2 gap-1.5 text-xs" onClick={() => navigate('/org')}>
              <Settings className="h-3.5 w-3.5" /> Go to Org Settings
            </Button>
          </div>
        )}

        {/* Available apps */}
        {availableApps.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Available</span>
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] font-mono text-muted-foreground">{availableApps.length}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {availableApps.map((app) => {
                const meta = APP_PATTERNS[app.id] ?? { pattern: 'dots', label: '—' };
                return (
                  <div
                    key={app.id}
                    className="group relative overflow-hidden flex flex-col gap-3 p-4 rounded-xl border border-border bg-muted/30 cursor-not-allowed"
                  >
                    <PatternBg pattern={meta.pattern} />
                    <div className="relative flex items-start justify-between">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
                        <div className="text-muted-foreground/50">
                          {ICON_MAP[app.defaultIcon] ?? <Briefcase className="h-7 w-7" />}
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      <p className="text-xs font-semibold leading-tight text-muted-foreground">{app.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">{meta.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
