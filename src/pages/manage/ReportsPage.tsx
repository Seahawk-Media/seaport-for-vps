import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { supabase } from '@/integrations/supabase/client';
import { Users } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface DirectReport {
  id: string;
  full_name: string;
  email: string;
  job_title: string | null;
  avatar_url: string | null;
  status: string;
}

export default function ManageReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isManager, isAdmin, loading: roleLoading } = useRole();
  const navigate = useNavigate();
  const [reports, setReports] = useState<DirectReport[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const fetchReports = async () => {
      if (!user || roleLoading) return;

      try {
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('id, organization_id')
          .eq('user_id', user.id)
          .single();

        if (!currentProfile) return;

        let query = supabase
          .from('profiles')
          .select('id, full_name, email, job_title, avatar_url, status');

        // Admins see all, managers see only direct reports
        if (isAdmin()) {
          query = query.eq('organization_id', currentProfile.organization_id);
        } else {
          query = query.eq('manager_id', currentProfile.id);
        }

        const { data, error } = await query.order('full_name');

        if (error) throw error;
        setReports(data || []);
      } catch (error) {
        console.error('Error fetching reports:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [user, roleLoading, isAdmin]);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (authLoading || roleLoading || loading) {
    return (
      <DashboardLayout title="Reports" description="View your team members">
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Reports" 
      description={isAdmin() ? "All employees in the organization" : "Your direct reports"}
    >
      <div className="space-y-6">
        {reports.length === 0 ? (
          <EmptyState icon={Users} title={isAdmin() ? 'No employees in the organization yet.' : 'No direct reports yet.'} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <Card 
                key={report.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/journey/${report.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={report.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(report.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{report.full_name}</CardTitle>
                      <CardDescription className="truncate">{report.email}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground truncate">
                      {report.job_title || 'No title'}
                    </span>
                    <Badge variant={report.status === 'active' ? 'default' : 'secondary'}>
                      {report.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
