import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AgentsTab } from "@/components/workspace/tabs/AgentsTab";

const AgentsPage = () => {
  return (
    <DashboardLayout>
      <div className="p-6">
        <AgentsTab showAllFunctions />
      </div>
    </DashboardLayout>
  );
};

export default AgentsPage;
