import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRole } from "@/hooks/useRole";
import { Spinner } from "@/components/ui/spinner";
import { DepartmentManagement } from "./DepartmentManagement";
import { TeamManagement } from "./TeamManagement";
import { PositionManagement } from "./PositionManagement";
import { OrganizationManagement } from "./OrganizationManagement";

import { ActivityLogViewer } from "./ActivityLogViewer";
import { UserManagementSettings } from "./UserManagementSettings";
import { BusinessAppsManagement } from "./BusinessAppsManagement";
import { OnboardingWizard } from "./OnboardingWizard";
import { AIModelsManagement } from "./AIModelsManagement";
import { JourneyEventTypesManagement } from "./JourneyEventTypesManagement";

export const AdminSettings: React.FC = () => {
  const { isSuperAdmin, isAdmin, loading } = useRole();
  const [activeTab, setActiveTab] = useState("organization");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!isSuperAdmin() && !isAdmin()) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-destructive">Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access workspace settings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const tabs = [
    { value: "organization", label: "Organization" },
    { value: "users", label: "Users & Permissions" },
    { value: "business-apps", label: "Business Apps" },
    { value: "ai-models", label: "AI Models" },
    { value: "departments", label: "Departments" },
    { value: "functions", label: "Functions" },
    { value: "positions", label: "Positions" },
    { value: "journey-events", label: "Journey Events" },
    { value: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-0">
      {/* Onboarding wizard — above all settings */}
      <OnboardingWizard onTabChange={(tab) => setActiveTab(tab)} />

      <div className="flex gap-6 items-start">
        {/* Vertical nav */}
        <nav className="w-48 flex-shrink-0 flex flex-col gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
                activeTab === tab.value
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "organization" && <OrganizationManagement />}
          {activeTab === "users" && <UserManagementSettings />}
          {activeTab === "business-apps" && <BusinessAppsManagement />}
          {activeTab === "ai-models" && <AIModelsManagement />}
          {activeTab === "departments" && <DepartmentManagement />}
          {activeTab === "functions" && <TeamManagement />}
          {activeTab === "positions" && <PositionManagement />}
          {activeTab === "journey-events" && <JourneyEventTypesManagement />}
          {activeTab === "activity" && <ActivityLogViewer />}
        </div>
      </div>
    </div>
  );
};
