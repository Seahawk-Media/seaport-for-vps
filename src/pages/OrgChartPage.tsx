import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { OrgChart } from "@/components/org-chart/OrgChart";

export default function OrgChartPage() {
  const navigate = useNavigate();

  const handleEmployeeClick = async (employeeId: string) => {
    navigate(`/journey/${employeeId}`);
  };

  return (
    <DashboardLayout title="Org Chart" description="View your organization's reporting structure">
      <OrgChart
        onEmployeeClick={handleEmployeeClick}
      />
    </DashboardLayout>
  );
}
