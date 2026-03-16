import { useRef, useEffect } from "react";
import { Building2, Users, GitBranch, Eye, Trophy, Heart, TrendingUp, User, GraduationCap, Wrench, Video, FileText, Target, BarChart3, Settings, CalendarDays, ListTodo, Bot, LayoutDashboard, Grid3X3 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useOrganization } from "@/hooks/useOrganization";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Module-level variable to persist scroll position across navigations
let savedScrollPosition = 0;




interface AppSidebarProps {
  viewMode?: string;
}

// ME section - Personal views for all users
const meItems = [
  { value: "my-journey", label: "My Journey", icon: User, route: null },
  { value: "me-performance", label: "Performance", icon: Eye, route: "/me/performance" },
  { value: "me-bounties", label: "Incentives", icon: Trophy, route: "/me/incentives" },
  { value: "me-promotions", label: "Promotions", icon: TrendingUp, route: "/me/promotions" },
];

// TEAM section - Team views for managers/admins
const manageItems = [
  { value: "team-reports", label: "Team Journeys", icon: Users, route: "/team/trails" },
  { value: "team-performance", label: "Perf Reviews", icon: Eye, route: "/team/performance" },
  { value: "team-bounties", label: "Incentives", icon: Trophy, route: "/team/incentives" },
  { value: "team-promotions", label: "Promotions", icon: TrendingUp, route: "/team/promotions" },
];

// ORG section - split into People and Departments sub-groups
const orgPeopleItems = [
  { value: "hierarchy", label: "Org Chart", icon: GitBranch, route: "/hierarchy" },
  { value: "holiday-calendar", label: "Event Calendar", icon: CalendarDays, route: "/holiday-calendar" },
  { value: "core-values", label: "Core Values", icon: Heart, route: "/core-values" },
  { value: "academy", label: "Academy", icon: GraduationCap, route: "/academy" },
];

const orgResourceItems = [
  { value: "departments", label: "Departments", icon: Building2, route: "/departments" },
  { value: "functions", label: "Functions", icon: Users, route: "/functions" },
  { value: "tools", label: "Tools", icon: Wrench, route: "/tools" },
  { value: "meetings", label: "Meetings", icon: Video, route: "/meetings" },
  { value: "sops", label: "SOPs", icon: FileText, route: "/sops" },
  { value: "measurables", label: "Measurables", icon: Target, route: "/measurables" },
];

// ADMIN section - Admin only items (sticky footer)
const adminItems = [
  { value: "analytics", label: "Analytics", icon: BarChart3, route: "/analytics" },
  { value: "admin", label: "Admin", icon: Settings, route: "/org" },
];

export function AppSidebar({ viewMode }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { organization } = useOrganization();
  const { isAdmin, isSuperAdmin, isManager, loading: roleLoading } = useRole();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Restore scroll position after navigation
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollPosition;
    }
  }, [location.pathname]);

  // Save scroll position on scroll
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      savedScrollPosition = scrollContainerRef.current.scrollTop;
    }
  };

  const isActive = (value: string, route: string | null) => {
    if (value === 'admin') return location.pathname === '/org' || location.pathname === '/admin';
    if (value === 'analytics') return location.pathname === '/analytics';
    if (value === 'my-journey') return location.pathname.startsWith('/journey/');
    if (route) return location.pathname === route;
    return false;
  };
  
  // Wait for roles to load before determining visibility
  const canSeeAdmin = !roleLoading && (isAdmin() || isSuperAdmin());
  const canSeeManage = !roleLoading && (isManager() || isAdmin() || isSuperAdmin());

  const handleNavClick = async (item: { value: string; route: string | null }) => {
    if (item.value === 'my-journey') {
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
    
    if (item.route) {
      navigate(item.route);
    }
  };

  const renderNavSection = (
    items: typeof meItems,
    showAdminOnly = false
  ) => (
    <SidebarMenu className="space-y-0.5">
      {items.map((item) => {
        if ('adminOnly' in item && item.adminOnly && !canSeeAdmin) return null;
        const active = isActive(item.value, item.route);
        return (
          <SidebarMenuItem key={item.value}>
            <SidebarMenuButton
              onClick={() => handleNavClick(item)}
              className={`
                rounded-lg transition-colors duration-150
                ${active 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }
              `}
              tooltip={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && (
                <span className="truncate text-sm">{item.label}</span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="!h-14 !min-h-14 !max-h-14 !p-0 !gap-0 border-b border-sidebar-border flex-row items-center">
        <div className="flex items-center gap-3 h-full px-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm text-sidebar-foreground truncate leading-tight">
                {organization?.name || 'Workspace'}
              </span>
              <span className="text-[10px] text-muted-foreground truncate leading-tight tracking-wide uppercase font-medium">
                AI Context Platform
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent ref={scrollContainerRef} onScroll={handleScroll} className="px-2 py-3 gap-1">
        {/* Dashboard + Tasks + SSO - top level */}
        <SidebarGroup className="space-y-0.5">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/dashboard')}
                  className={`rounded-lg transition-colors duration-150 ${
                    location.pathname === '/dashboard'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  }`}
                  tooltip={collapsed ? 'Dashboard' : undefined}
                >
                  <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span className="truncate text-sm">Dashboard</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/sso')}
                  className={`rounded-lg transition-colors duration-150 ${
                    location.pathname === '/sso'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  }`}
                  tooltip={collapsed ? 'SSO' : undefined}
                >
                  <Grid3X3 className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span className="truncate text-sm">SSO</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/tasks')}
                  className={`rounded-lg transition-colors duration-150 ${
                    location.pathname === '/tasks'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  }`}
                  tooltip={collapsed ? 'Tasks' : undefined}
                >
                  <ListTodo className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span className="truncate text-sm">Tasks</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/agents')}
                  className={`rounded-lg transition-colors duration-150 ${
                    location.pathname === '/agents' || location.pathname.startsWith('/agents/')
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  }`}
                  tooltip={collapsed ? 'Agents' : undefined}
                >
                  <Bot className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span className="truncate text-sm">Agents</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ME Section */}
        <SidebarGroup className="space-y-0.5">
          <SidebarGroupLabel className={`text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-0.5 ${collapsed ? "sr-only" : ""}`}>
            Me
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderNavSection(meItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* MANAGE Section - Only visible to managers/admins */}
        {canSeeManage && (
          <SidebarGroup className="space-y-0.5 mt-3">
            <SidebarGroupLabel className={`text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-0.5 ${collapsed ? "sr-only" : ""}`}>
              Team
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {renderNavSection(manageItems)}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ORG Section */}
        <SidebarGroup className="space-y-0.5 mt-3">
          <SidebarGroupLabel className={`text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-0.5 ${collapsed ? "sr-only" : ""}`}>
            Org
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderNavSection(orgPeopleItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ORG Resources Sub-section */}
        <SidebarGroup className="space-y-0.5 mt-3">
          <SidebarGroupLabel className={`text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-0.5 ${collapsed ? "sr-only" : ""}`}>
            Departments
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderNavSection(orgResourceItems)}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Admin Footer - Sticky at bottom, only for admins */}
      {canSeeAdmin && (
        <SidebarFooter className="border-t border-sidebar-border px-2 py-2">
          <SidebarMenu className="space-y-0.5">
            {adminItems.map((item) => {
              const active = isActive(item.value, item.route);
              return (
                <SidebarMenuItem key={item.value}>
                  <SidebarMenuButton
                    onClick={() => handleNavClick(item)}
                    className={`
                      rounded-lg transition-colors duration-150
                      ${active 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      }
                    `}
                    tooltip={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && (
                      <span className="truncate text-sm">{item.label}</span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
