import { useState } from 'react';
import { Grid3X3 } from 'lucide-react';
import seahawkMark from '@/assets/seahawk-mark.svg';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useSuiteConfig } from '@/hooks/useSuiteConfig';

export const AppLauncher = () => {
  const [open, setOpen] = useState(false);
  const { config } = useSuiteConfig();
  const iconSrc = config.iconUrl || seahawkMark;

  const connectedApps = config.apps.filter(a => a.status === 'connected' && a.url);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <Grid3X3 className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-4"
      >
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
          <img src={iconSrc} alt="Suite icon" className="h-6 w-6 object-contain" />
          <span className="text-sm font-semibold text-foreground">{config.name}</span>
        </div>

        {connectedApps.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No apps connected yet. Configure apps in Org Settings → Business Apps.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {connectedApps.map((app) => (
              <a
                key={app.id}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-accent transition-colors group cursor-pointer"
              >
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden group-hover:bg-accent-foreground/10 transition-colors">
                  {app.iconUrl ? (
                    <img src={app.iconUrl} alt={app.name} className="h-8 w-8 object-contain" />
                  ) : (
                    <span className="text-xl">{app.name.charAt(0)}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight font-medium">
                  {app.name}
                </span>
              </a>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
