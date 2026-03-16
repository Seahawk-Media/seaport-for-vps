import React from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { UserProfileDropdown } from "@/components/navigation/UserProfileDropdown";
import { AppLauncher } from "@/components/navigation/AppLauncher";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLogger } from '@/hooks/useActivityLogger';

interface DashboardLayoutProps {
  children: React.ReactNode;
  viewMode?: string;
  onViewModeChange?: (mode: 'departments' | 'functions' | 'hierarchy' | 'performance' | 'timeoff' | 'overtime' | 'bounties' | 'core-values' | 'growth-journey' | 'my-journey' | 'academy') => void;
  title?: string;
  description?: string;
  headerContent?: React.ReactNode;
  showSidebar?: boolean;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  viewMode = 'departments',
  onViewModeChange,
  title,
  description,
  headerContent,
  showSidebar = true,
}) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  
  // Track page views automatically
  useActivityLogger();

  const handleViewModeChange = async (mode: 'departments' | 'functions' | 'hierarchy' | 'performance' | 'timeoff' | 'overtime' | 'bounties' | 'core-values' | 'growth-journey' | 'my-journey' | 'academy') => {
    if (mode === 'my-journey') {
      // Navigate to the user's journey page
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        navigate(`/journey/${profile.id}`);
      }
      return;
    }
    
    if (onViewModeChange) {
      onViewModeChange(mode);
    } else {
      // If no handler provided, navigate to dashboard with the view mode
      navigate('/dashboard');
    }
  };

  const handleMyJourneyClick = async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      navigate(`/journey/${profile.id}`);
    }
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleAdminSettingsClick = () => {
    navigate('/org');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "14rem",
        "--sidebar-width-icon": "4rem",
      } as React.CSSProperties}
    >
      <div className="min-h-screen flex w-full bg-background">
        {showSidebar && (
          <AppSidebar viewMode={viewMode} />
        )}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header - clean minimal style */}
          <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3 pl-4">
              {showSidebar && <SidebarTrigger className="text-muted-foreground hover:text-foreground" />}
              {headerContent || (
                <div className="flex flex-col">
                  {title && <h1 className="text-base font-semibold text-foreground">{title}</h1>}
                  {description && <p className="text-xs text-muted-foreground">{description}</p>}
                </div>
              )}
            </div>
            <div className="pr-6 flex items-center gap-2">
              <AppLauncher />
              <UserProfileDropdown
                onMyJourneyClick={handleMyJourneyClick}
                onSettingsClick={handleSettingsClick}
                onAdminSettingsClick={handleAdminSettingsClick}
                onSignOut={handleSignOut}
              />
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
