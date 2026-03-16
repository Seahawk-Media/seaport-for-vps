import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AcademyDashboard } from "@/components/academy/AcademyDashboard";

export default function AcademyPage() {
  return (
    <DashboardLayout title="Academy" description="Training courses and knowledge base">
      <AcademyDashboard />
    </DashboardLayout>
  );
}
