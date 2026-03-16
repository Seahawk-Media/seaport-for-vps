import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MeetingsTab } from '@/components/workspace/tabs/MeetingsTab';

export default function ManageMeetingsPage() {
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
      <DashboardLayout title="Meetings" description="Manage meetings across all functions">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Meetings" 
      description="Manage meetings across all functions"
    >
      <MeetingsTab showAllFunctions />
    </DashboardLayout>
  );
}
