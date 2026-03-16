import { useState, useCallback } from 'react';

export interface SuiteApp {
  id: string;
  name: string;
  url: string;
  iconUrl: string;
  status: 'connected' | 'available' | 'coming_soon';
  color: string;
  defaultIcon: string; // lucide icon name kept for admin display
}

export interface SuiteConfig {
  name: string;
  iconUrl: string;
  apps: SuiteApp[];
}

const STORAGE_KEY = 'iba_suite_config';

export const DEFAULT_APPS: SuiteApp[] = [
  { id: 'crm',         name: 'CRM',              url: '', iconUrl: '', status: 'available', color: 'bg-blue-100 text-blue-600',      defaultIcon: 'Briefcase'    },
  { id: 'projects',    name: 'Projects / Tasks',  url: '', iconUrl: '', status: 'available', color: 'bg-violet-100 text-violet-600',  defaultIcon: 'CheckSquare'  },
  { id: 'billing',     name: 'Billing',           url: '', iconUrl: '', status: 'available', color: 'bg-emerald-100 text-emerald-600',defaultIcon: 'CreditCard'   },
  { id: 'support',     name: 'Support',           url: '', iconUrl: '', status: 'available', color: 'bg-orange-100 text-orange-600',  defaultIcon: 'Headphones'   },
  { id: 'website',     name: 'Website',           url: '', iconUrl: '', status: 'available', color: 'bg-cyan-100 text-cyan-600',      defaultIcon: 'Globe'        },
  { id: 'files',       name: 'Files',             url: '', iconUrl: '', status: 'available', color: 'bg-yellow-100 text-yellow-600',  defaultIcon: 'FileText'     },
  { id: 'brand',       name: 'Brand',             url: '', iconUrl: '', status: 'available', color: 'bg-pink-100 text-pink-600',      defaultIcon: 'ImageIcon'    },
  { id: 'analytics',   name: 'Analytics',         url: '', iconUrl: '', status: 'available', color: 'bg-indigo-100 text-indigo-600',  defaultIcon: 'BarChart2'    },
  { id: 'automations', name: 'Automations',       url: '', iconUrl: '', status: 'available', color: 'bg-amber-100 text-amber-600',    defaultIcon: 'Zap'          },
];

export const DEFAULT_CONFIG: SuiteConfig = {
  name: 'Internal Business Apps (IBA)',
  iconUrl: '', // blank = render generic Grid3X3 icon in UI
  apps: DEFAULT_APPS,
};

function load(): SuiteConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge to ensure new default apps are included if not yet persisted
      const mergedApps = DEFAULT_APPS.map(def => {
        const saved = (parsed.apps ?? []).find((a: SuiteApp) => a.id === def.id);
        return saved ? { ...def, ...saved } : def;
      });
      return { ...DEFAULT_CONFIG, ...parsed, apps: mergedApps };
    }
  } catch {
    // If localStorage read/parse fails, fall back to defaults
    return DEFAULT_CONFIG;
  }
  return DEFAULT_CONFIG;
}

function save(config: SuiteConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function useSuiteConfig() {
  const [config, setConfig] = useState<SuiteConfig>(load);

  const update = useCallback((next: Partial<SuiteConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...next };
      save(updated);
      return updated;
    });
  }, []);

  const updateApp = useCallback((id: string, changes: Partial<SuiteApp>) => {
    setConfig(prev => {
      const apps = prev.apps.map(a => a.id === id ? { ...a, ...changes } : a);
      const updated = { ...prev, apps };
      save(updated);
      return updated;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConfig(DEFAULT_CONFIG);
  }, []);

  return { config, update, updateApp, reset, DEFAULT_CONFIG };
}
