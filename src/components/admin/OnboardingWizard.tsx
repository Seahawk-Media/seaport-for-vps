import React, { useState, useCallback } from 'react';
import { Check, ChevronDown, ChevronUp, Building2, Bot, LayoutGrid, X, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ── Persistence ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'seaport_onboarding_v1';

interface OnboardingState {
  dismissed: boolean;
  checked: Record<string, boolean>;
  openStep: number | null;
}

function loadState(): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // If localStorage is unavailable or corrupted, fall back to defaults
  }
  return { dismissed: false, checked: {}, openStep: 0 };
}

function saveState(s: OnboardingState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ── Step definitions ──────────────────────────────────────────────────────────

interface CheckItem {
  id: string;
  label: string;
  route?: string;
  tab?: string; // admin settings tab to jump to
}

interface Step {
  id: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  items: CheckItem[];
}

const STEPS: Step[] = [
  {
    id: 0,
    icon: <Building2 className="h-4 w-4" />,
    title: 'Data Organization',
    description: 'Document your org structure so every team member knows where everything lives.',
    color: 'text-blue-600',
    items: [
      { id: 'dept',        label: 'Create your Departments',            tab: 'departments' },
      { id: 'functions',   label: 'Add Functions inside departments',   tab: 'functions'   },
      { id: 'tools',       label: 'Catalogue your Tools',               route: '/tools'    },
      { id: 'meetings',    label: 'Document recurring Meetings',        route: '/meetings' },
      { id: 'sops',        label: 'Write your SOPs',                    route: '/sops'     },
      { id: 'measurables', label: 'Define Measurables',                 route: '/measurables' },
      { id: 'agents_doc',  label: 'List your Agents',                   route: '/agents'   },
    ],
  },
  {
    id: 1,
    icon: <Bot className="h-4 w-4" />,
    title: 'Agent Setup',
    description: 'Plug AI agents into departments or functions to work alongside your team.',
    color: 'text-violet-600',
    items: [
      { id: 'agent_create',   label: 'Create your first Agent',            route: '/agents'   },
      { id: 'agent_dept',     label: 'Attach an Agent to a Department',    route: '/departments' },
      { id: 'agent_function', label: 'Attach an Agent to a Function',      route: '/functions' },
    ],
  },
  {
    id: 2,
    icon: <LayoutGrid className="h-4 w-4" />,
    title: 'Internal Business Apps (IBA)',
    description: 'Customize and centralize the apps your team uses every day.',
    color: 'text-emerald-600',
    items: [
      { id: 'iba_connect',  label: 'Connect your first Business App',  tab: 'business-apps' },
      { id: 'iba_icon',     label: 'Add icons and URLs to each app',   tab: 'business-apps' },
      { id: 'iba_suite',    label: 'Customize the Suite Identity',     tab: 'business-apps' },
      { id: 'iba_launcher', label: 'Select a VPS host to self-host Seaport', route: '/sso' },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onTabChange?: (tab: string) => void;
}

export const OnboardingWizard: React.FC<Props> = ({ onTabChange }) => {
  const navigate = useNavigate();
  const [state, setState] = useState<OnboardingState>(loadState);

  const update = useCallback((next: Partial<OnboardingState>) => {
    setState(prev => {
      const updated = { ...prev, ...next };
      saveState(updated);
      return updated;
    });
  }, []);

  const toggleCheck = (itemId: string) => {
    update({ checked: { ...state.checked, [itemId]: !state.checked[itemId] } });
  };

  const toggleStep = (stepId: number) => {
    update({ openStep: state.openStep === stepId ? null : stepId });
  };

  const dismiss = () => update({ dismissed: true });

  const totalItems = STEPS.reduce((s, step) => s + step.items.length, 0);
  const checkedCount = Object.values(state.checked).filter(Boolean).length;
  const progressPct = Math.round((checkedCount / totalItems) * 100);
  const allDone = checkedCount === totalItems;

  if (state.dismissed) return null;

  return (
    <div className="rounded-xl border border-border bg-card mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {allDone ? '🎉 Setup complete!' : `Get started with ${import.meta.env.VITE_APP_NAME || 'Seaport'}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {allDone
                ? 'Your org is fully set up. Nice work.'
                : `${checkedCount} of ${totalItems} tasks completed`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{progressPct}%</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={dismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-border">
        {STEPS.map((step) => {
          const stepChecked = step.items.filter(i => state.checked[i.id]).length;
          const stepDone = stepChecked === step.items.length;
          const isOpen = state.openStep === step.id;

          return (
            <div key={step.id}>
              {/* Step header — always visible */}
              <button
                onClick={() => toggleStep(step.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors text-left"
              >
                {/* Step number / check */}
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold border-2 transition-colors',
                  stepDone
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border bg-muted text-muted-foreground'
                )}>
                  {stepDone ? <Check className="h-3.5 w-3.5" /> : step.id + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('flex-shrink-0', step.color)}>{step.icon}</span>
                    <span className="text-sm font-medium text-foreground">{step.title}</span>
                    <span className="text-xs text-muted-foreground">
                      ({stepChecked}/{step.items.length})
                    </span>
                  </div>
                  {!isOpen && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{step.description}</p>
                  )}
                </div>

                <div className="flex-shrink-0 text-muted-foreground">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {/* Step body — expandable */}
              {isOpen && (
                <div className="px-5 pb-4 pt-1 bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-3">{step.description}</p>
                  <ul className="space-y-1.5">
                    {step.items.map((item) => {
                      const done = !!state.checked[item.id];
                      return (
                        <li key={item.id} className="flex items-center gap-3 group">
                          <button
                            onClick={() => toggleCheck(item.id)}
                            className={cn(
                              'h-5 w-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors',
                              done
                                ? 'bg-primary border-primary'
                                : 'border-border bg-background hover:border-primary/50'
                            )}
                          >
                            {done && <Check className="h-3 w-3 text-primary-foreground" />}
                          </button>
                          <span
                            className={cn(
                              'text-sm flex-1 transition-colors',
                              done ? 'line-through text-muted-foreground' : 'text-foreground'
                            )}
                          >
                            {item.label}
                          </span>
                          {/* Jump link */}
                          {(item.route || item.tab) && (
                            <button
                              onClick={() => {
                                if (item.tab && onTabChange) {
                                  onTabChange(item.tab);
                                } else if (item.route) {
                                  navigate(item.route);
                                }
                              }}
                              className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:underline flex-shrink-0"
                            >
                              Go →
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
