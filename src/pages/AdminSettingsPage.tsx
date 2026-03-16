import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AdminSettings } from '@/components/admin/AdminSettings';

export const AdminSettingsPage = () => {
  const { user, loading } = useAuth();
  const { organization, loading: orgLoading } = useOrganization();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !organization) {
    return null;
  }

  return (
    <DashboardLayout
      viewMode="org-settings"
      title="Org Settings"
      description="Manage organization settings and configurations"
    >
      <AdminSettings />
    </DashboardLayout>
  );
};
