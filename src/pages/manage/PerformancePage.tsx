import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ManagerPerformanceReviewDashboard } from '@/components/performance/ManagerPerformanceReviewDashboard';
import { Spinner } from '@/components/ui/spinner';

export default function ManagePerformancePage() {
  const { user, loading: authLoading } = useAuth();
  const { isManager, isAdmin, loading: roleLoading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!roleLoading && !isManager() && !isAdmin()) {
      navigate('/dashboard');
    }
  }, [roleLoading, isManager, isAdmin, navigate]);

  if (authLoading || roleLoading) {
    return (
      <DashboardLayout title="Performance Reviews" description="Manage team performance reviews">
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Performance Reviews" description="Manage team performance reviews">
      <ManagerPerformanceReviewDashboard />
    </DashboardLayout>
  );
}
