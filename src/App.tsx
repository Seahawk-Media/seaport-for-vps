import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/hooks/useOrganization";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import { AuthPage } from "@/components/auth/AuthPage";
import { InvitationAcceptance } from "@/components/org/InvitationAcceptance";
import { UserSettingsPage } from "./pages/UserSettingsPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { EmployeeJourneyPage } from "./pages/EmployeeJourneyPage";
import DepartmentPage from "./pages/DepartmentPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import TeamPage from "./pages/TeamPage";
import DirectoryPage from "./pages/DirectoryPage";
import OrgChartPage from "./pages/OrgChartPage";

// Me section pages
import MePerformancePage from "./pages/me/PerformancePage";
import MeIncentivesPage from "./pages/me/BountiesPage";
import MePromotionsPage from "./pages/me/AppraisalPage";

// Manage section pages
import ManageReportsPage from "./pages/manage/ReportsPage";
import ManagePerformancePage from "./pages/manage/PerformancePage";
import ManageIncentivesPage from "./pages/manage/BountiesPage";
import ManagePromotionsPage from "./pages/manage/AppraisalsPage";
import ManageToolsPage from "./pages/manage/ToolsPage";
import ManageMeetingsPage from "./pages/manage/MeetingsPage";
import ManageSOPsPage from "./pages/manage/SOPsPage";
import ManageMeasurablesPage from "./pages/manage/MeasurablesPage";
import ManageAgentsPage from "./pages/manage/AgentsPage";
import AgentChatPage from "./pages/AgentChatPage";

// Functions page
import FunctionsPage from "./pages/FunctionsPage";

// Tasks page
import TasksPage from "./pages/TasksPage";

// Analytics page
import AnalyticsPage from "./pages/AnalyticsPage";

// Holiday Calendar page
import HolidayCalendarPage from "./pages/HolidayCalendarPage";
import AcademyPage from "./pages/AcademyPage";
import CoreValuesPage from "./pages/CoreValuesPage";
import SSOPage from "./pages/SSOPage";

// Feedback page
import AcceptInvitePage from "./pages/AcceptInvitePage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OrganizationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/sso" element={<SSOPage />} />
              
              {/* Me section routes */}
              <Route path="/me/performance" element={<MePerformancePage />} />
              <Route path="/me/bounties" element={<MeIncentivesPage />} />
              <Route path="/me/incentives" element={<MeIncentivesPage />} />
              <Route path="/me/promotions" element={<MePromotionsPage />} />
              
              {/* Team section routes */}
              <Route path="/team/trails" element={<ManageReportsPage />} />
              <Route path="/team/performance" element={<ManagePerformancePage />} />
              <Route path="/team/bounties" element={<ManageIncentivesPage />} />
              <Route path="/team/incentives" element={<ManageIncentivesPage />} />
              <Route path="/team/promotions" element={<ManagePromotionsPage />} />
              
              {/* Tasks page */}
              <Route path="/tasks" element={<TasksPage />} />

              {/* Org section routes - resources */}
              <Route path="/tools" element={<ManageToolsPage />} />
              <Route path="/meetings" element={<ManageMeetingsPage />} />
              <Route path="/sops" element={<ManageSOPsPage />} />
              <Route path="/measurables" element={<ManageMeasurablesPage />} />
              <Route path="/agents" element={<ManageAgentsPage />} />
              <Route path="/agents/:agentId/chat" element={<AgentChatPage />} />
              
              {/* Org section routes */}
              <Route path="/departments" element={<DepartmentsPage />} />
              <Route path="/functions" element={<FunctionsPage />} />
              <Route path="/directory" element={<OrgChartPage />} />
              <Route path="/hierarchy" element={<OrgChartPage />} />
              <Route path="/holiday-calendar" element={<HolidayCalendarPage />} />
              <Route path="/core-values" element={<CoreValuesPage />} />
              <Route path="/academy" element={<AcademyPage />} />
              
              {/* Other routes */}
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/accept-invite" element={<AcceptInvitePage />} />
              <Route path="/accept-invitation" element={<InvitationAcceptance />} />
              <Route path="/settings" element={<UserSettingsPage />} />
              <Route path="/org" element={<AdminSettingsPage />} />
              <Route path="/admin" element={<AdminSettingsPage />} /> {/* Redirect for old URL */}
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/journey/:employeeId" element={<EmployeeJourneyPage />} />
              <Route path="/department/:id" element={<DepartmentPage />} />
              <Route path="/function/:id" element={<TeamPage />} />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </OrganizationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
