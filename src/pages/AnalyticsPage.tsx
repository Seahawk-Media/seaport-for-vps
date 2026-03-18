import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useOrganization } from '@/hooks/useOrganization';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/lib/trpc';
import { Calendar, Clock, Heart } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';

interface ProfileWithStats {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  value: number;
}

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isSuperAdmin, loading: roleLoading } = useRole();
  const { organization } = useOrganization();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!roleLoading && !isAdmin() && !isSuperAdmin()) {
      navigate('/dashboard');
    }
  }, [roleLoading, isAdmin, isSuperAdmin, navigate]);

  const { data: profiles, isLoading: profilesLoading } = trpc.profiles.list.useQuery(undefined, {
    enabled: !!organization?.id,
  });
  const { data: timeOffRequests, isLoading: timeOffLoading } = trpc.timeOff.listRequests.useQuery(undefined, {
    enabled: !!organization?.id,
  });
  const { data: overtimeEntries, isLoading: overtimeLoading } = trpc.overtime.list.useQuery(undefined, {
    enabled: !!organization?.id,
  });

  const loading = profilesLoading || timeOffLoading || overtimeLoading;

  const profileMap = useMemo(() => {
    const map: Record<string, any> = {};
    (profiles ?? []).forEach((p: any) => { map[p.id] = p; });
    return map;
  }, [profiles]);

  const mostTimeOff = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const approved = (timeOffRequests ?? []).filter((t: any) =>
      t.status === 'approved' && t.startDate >= `${currentYear}-01-01`
    );
    const timeOffByProfile: Record<string, number> = {};
    approved.forEach((t: any) => {
      timeOffByProfile[t.profileId] = (timeOffByProfile[t.profileId] || 0) + (Number(t.totalDays) || 0);
    });
    return Object.entries(timeOffByProfile)
      .filter(([pid]) => profileMap[pid])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([pid, total]) => ({
        id: pid,
        fullName: profileMap[pid]?.fullName || 'Unknown',
        avatarUrl: profileMap[pid]?.avatarUrl,
        value: total,
      }));
  }, [timeOffRequests, profileMap]);

  const mostOvertime = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const approved = (overtimeEntries ?? []).filter((o: any) =>
      o.status === 'approved' && o.date >= `${currentYear}-01-01`
    );
    const overtimeByProfile: Record<string, number> = {};
    approved.forEach((o: any) => {
      overtimeByProfile[o.profileId] = (overtimeByProfile[o.profileId] || 0) + (Number(o.hours) || 0);
    });
    return Object.entries(overtimeByProfile)
      .filter(([pid]) => profileMap[pid])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([pid, total]) => ({
        id: pid,
        fullName: profileMap[pid]?.fullName || 'Unknown',
        avatarUrl: profileMap[pid]?.avatarUrl,
        value: Math.round(total * 10) / 10,
      }));
  }, [overtimeEntries, profileMap]);

  const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  const renderLeaderboard = (
    title: string,
    icon: React.ReactNode,
    data: ProfileWithStats[],
    unit: string,
    maxValue?: number
  ) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
        ) : (
          <div className="space-y-3">
            {data.map((item, index) => (
              <div key={item.id} className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground w-5">{index + 1}</span>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={item.avatarUrl || ''} />
                  <AvatarFallback className="text-xs">{getInitials(item.fullName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.fullName}</p>
                  {maxValue && (
                    <Progress value={(item.value / maxValue) * 100} className="h-1.5 mt-1" />
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {item.value} {unit}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (authLoading || roleLoading) {
    return (
      <DashboardLayout title="Analytics" description="Organization analytics">
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Analytics" description="Organization engagement metrics">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {renderLeaderboard(
              'Most Time Off (YTD)',
              <Calendar className="h-4 w-4 text-blue-500" />,
              mostTimeOff,
              'days',
              mostTimeOff[0]?.value
            )}

            {renderLeaderboard(
              'Most Overtime (YTD)',
              <Clock className="h-4 w-4 text-purple-500" />,
              mostOvertime,
              'hrs',
              mostOvertime[0]?.value
            )}
          </div>

          {/* Core Values Winners - Placeholder */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Heart className="h-4 w-4 text-red-500" />
                Core Value Champions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Heart}
                title="Core value tracking coming soon."
                description="This will display employees who exemplify your organization's core values."
              />
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
