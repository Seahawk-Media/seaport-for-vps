import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { trpc } from '@/lib/trpc';
import { Users } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

export default function ManageReportsPage() {
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

  const { data: myProfile } = trpc.profiles.me.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: allProfiles, isLoading: profilesLoading } = trpc.profiles.list.useQuery(undefined, {
    enabled: !!myProfile && !roleLoading,
  });

  const loading = profilesLoading;

  const reports = useMemo(() => {
    if (!allProfiles || !myProfile) return [];
    if (isAdmin()) {
      // Admins see all in the org
      return allProfiles
        .map((p: any) => ({
          id: p.id,
          fullName: p.fullName,
          email: p.email,
          jobTitle: p.jobTitle ?? null,
          avatarUrl: p.avatarUrl ?? null,
          status: p.status ?? 'active',
        }))
        .sort((a: any, b: any) => (a.fullName ?? '').localeCompare(b.fullName ?? ''));
    }
    // Managers see direct reports
    return allProfiles
      .filter((p: any) => p.managerId === myProfile.id)
      .map((p: any) => ({
        id: p.id,
        fullName: p.fullName,
        email: p.email,
        jobTitle: p.jobTitle ?? null,
        avatarUrl: p.avatarUrl ?? null,
        status: p.status ?? 'active',
      }))
      .sort((a: any, b: any) => (a.fullName ?? '').localeCompare(b.fullName ?? ''));
  }, [allProfiles, myProfile, isAdmin]);

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
            {reports.map((report: any) => (
              <Card
                key={report.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/journey/${report.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={report.avatarUrl || undefined} />
                      <AvatarFallback>{getInitials(report.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{report.fullName}</CardTitle>
                      <CardDescription className="truncate">{report.email}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground truncate">
                      {report.jobTitle || 'No title'}
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
