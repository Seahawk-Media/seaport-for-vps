import React from 'react';
import { Users, Wrench, Video, FileText, CheckSquare, MessageSquare, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceTab = 'functions' | 'tools' | 'meetings' | 'sops' | 'tasks' | 'chat' | 'agents';

interface WorkspaceSidebarProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  showTeamsTab?: boolean; // Only show for departments
}

const tabs = [
  { id: 'functions' as WorkspaceTab, label: 'Functions', icon: Users, departmentOnly: true },
  { id: 'tools' as WorkspaceTab, label: 'Tools', icon: Wrench, departmentOnly: false },
  { id: 'meetings' as WorkspaceTab, label: 'Meetings', icon: Video, departmentOnly: false },
  { id: 'sops' as WorkspaceTab, label: 'SOPs', icon: FileText, departmentOnly: false },
  { id: 'tasks' as WorkspaceTab, label: 'Tasks', icon: CheckSquare, departmentOnly: false },
  { id: 'chat' as WorkspaceTab, label: 'Chat', icon: MessageSquare, departmentOnly: false },
  { id: 'agents' as WorkspaceTab, label: 'Agents', icon: Bot, departmentOnly: false },
];

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  activeTab,
  onTabChange,
  showTeamsTab = true
}) => {
  const filteredTabs = showTeamsTab ? tabs : tabs.filter(t => !t.departmentOnly);

  return (
    <div className="w-48 border-r border-border bg-muted/30 flex flex-col">
      <nav className="flex flex-col gap-1 p-2">
        {filteredTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};
