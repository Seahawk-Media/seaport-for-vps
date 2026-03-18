import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/hooks/useOrganization";
import { trpc, trpcClient, queryClient } from "@/lib/trpc";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import SetupWizard from "./pages/SetupWizard";
import { AuthPage } from "@/components/auth/AuthPage";
import { InvitationAcceptance } from "@/components/org/InvitationAcceptance";
import { UserSettingsPage } from "./pages/UserSettingsPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { EmployeeJourneyPage } from "./pages/EmployeeJourneyPage";
import DepartmentPage from "./pages/DepartmentPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import TeamPage from "./pages/TeamPage";
import OrgChartPage from "./pages/OrgChartPage";

// Team section
import ManageReportsPage from "./pages/manage/ReportsPage";
import ManageToolsPage from "./pages/manage/ToolsPage";
import ManageMeetingsPage from "./pages/manage/MeetingsPage";
import ManageSOPsPage from "./pages/manage/SOPsPage";
import ManageMeasurablesPage from "./pages/manage/MeasurablesPage";
import ManageAgentsPage from "./pages/manage/AgentsPage";
import AgentChatPage from "./pages/AgentChatPage";
import AgentDetailPage from "./pages/AgentDetailPage";

import FunctionsPage from "./pages/FunctionsPage";
import TasksPage from "./pages/TasksPage";

import AcademyPage from "./pages/AcademyPage";
import CoreValuesPage from "./pages/CoreValuesPage";
import SSOPage from "./pages/SSOPage";
import AcceptInvitePage from "./pages/AcceptInvitePage";

const App = () => (
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrganizationProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <ErrorBoundary>
            <BrowserRouter>
              <Routes>
                <Route path="/setup" element={<SetupWizard />} />
                <Route path="/" element={<Index />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/sso" element={<SSOPage />} />

                {/* Team section */}
                <Route path="/team/trails" element={<ManageReportsPage />} />

                {/* Tasks */}
                <Route path="/tasks" element={<TasksPage />} />

                {/* Resources */}
                <Route path="/tools" element={<ManageToolsPage />} />
                <Route path="/meetings" element={<ManageMeetingsPage />} />
                <Route path="/sops" element={<ManageSOPsPage />} />
                <Route path="/measurables" element={<ManageMeasurablesPage />} />

                {/* Agents */}
                <Route path="/agents" element={<ManageAgentsPage />} />
                <Route path="/agents/:agentId" element={<AgentDetailPage />} />
                <Route path="/agents/:agentId/chat" element={<AgentChatPage />} />

                {/* Org */}
                <Route path="/departments" element={<DepartmentsPage />} />
                <Route path="/functions" element={<FunctionsPage />} />
                <Route path="/directory" element={<OrgChartPage />} />
                <Route path="/hierarchy" element={<OrgChartPage />} />
                <Route path="/core-values" element={<CoreValuesPage />} />
                <Route path="/academy" element={<AcademyPage />} />

                {/* Auth & settings */}
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/accept-invite" element={<AcceptInvitePage />} />
                <Route path="/accept-invitation" element={<InvitationAcceptance />} />
                <Route path="/invite/:token" element={<AcceptInvitePage />} />
                <Route path="/settings" element={<UserSettingsPage />} />
                <Route path="/org" element={<AdminSettingsPage />} />
                <Route path="/admin" element={<AdminSettingsPage />} />

                <Route path="/journey/:employeeId" element={<EmployeeJourneyPage />} />
                <Route path="/department/:id" element={<DepartmentPage />} />
                <Route path="/function/:id" element={<TeamPage />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            </ErrorBoundary>
          </TooltipProvider>
        </OrganizationProvider>
      </AuthProvider>
    </QueryClientProvider>
  </trpc.Provider>
);

export default App;
