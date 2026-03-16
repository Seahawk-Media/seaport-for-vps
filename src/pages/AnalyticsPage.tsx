import { useEffect, useState, useMemo } from 'react';
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
import { Trophy, Star, Calendar, Clock, TrendingUp, Heart, AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { format } from 'date-fns';

interface ProfileWithStats {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  value: number;
}

interface UpcomingPromotion {
  id: string;
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  nextReviewDate: string;
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
  const { data: incentives, isLoading: incentivesLoading } = trpc.incentives.list.useQuery(undefined, {
    enabled: !!organization?.id,
  });
  const { data: reviews, isLoading: reviewsLoading } = trpc.reviews.list.useQuery(undefined, {
    enabled: !!organization?.id,
  });
  const { data: timeOffRequests, isLoading: timeOffLoading } = trpc.timeOff.listRequests.useQuery(undefined, {
    enabled: !!organization?.id,
  });
  const { data: overtimeEntries, isLoading: overtimeLoading } = trpc.overtime.list.useQuery(undefined, {
    enabled: !!organization?.id,
  });
  const { data: promotions, isLoading: promotionsLoading } = trpc.promotions.list.useQuery(undefined, {
    enabled: !!organization?.id,
  });

  const loading = profilesLoading || incentivesLoading || reviewsLoading || timeOffLoading || overtimeLoading || promotionsLoading;

  const profileMap = useMemo(() => {
    const map: Record<string, any> = {};
    (profiles ?? []).forEach((p: any) => { map[p.id] = p; });
    return map;
  }, [profiles]);

  const topBountyEarners = useMemo(() => {
    const approved = (incentives ?? []).filter((i: any) => i.status === 'approved');
    const bountyByProfile: Record<string, number> = {};
    approved.forEach((i: any) => {
      bountyByProfile[i.profileId] = (bountyByProfile[i.profileId] || 0) + (i.points || 0);
    });
    return Object.entries(bountyByProfile)
      .filter(([pid]) => profileMap[pid])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([pid, total]) => ({
        id: pid,
        fullName: profileMap[pid]?.fullName || 'Unknown',
        avatarUrl: profileMap[pid]?.avatarUrl,
        value: total,
      }));
  }, [incentives, profileMap]);

  const { topPerformers, lowPerformers } = useMemo(() => {
    const submitted = (reviews ?? []).filter((r: any) => r.status === 'submitted' && r.overallRating != null);
    const ratingByProfile: Record<string, number[]> = {};
    submitted.forEach((r: any) => {
      const pid = r.employeeId;
      if (!ratingByProfile[pid]) ratingByProfile[pid] = [];
      ratingByProfile[pid].push(Number(r.overallRating));
    });
    const profilesWithRatings = Object.entries(ratingByProfile)
      .filter(([pid]) => profileMap[pid])
      .map(([pid, ratings]) => ({
        pid,
        avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      }));
    const top = [...profilesWithRatings].sort((a, b) => b.avg - a.avg).slice(0, 5).map(item => ({
      id: item.pid,
      fullName: profileMap[item.pid]?.fullName || 'Unknown',
      avatarUrl: profileMap[item.pid]?.avatarUrl,
      value: Math.round(item.avg * 10) / 10,
    }));
    const low = [...profilesWithRatings].sort((a, b) => a.avg - b.avg).slice(0, 5).map(item => ({
      id: item.pid,
      fullName: profileMap[item.pid]?.fullName || 'Unknown',
      avatarUrl: profileMap[item.pid]?.avatarUrl,
      value: Math.round(item.avg * 10) / 10,
    }));
    return { topPerformers: top, lowPerformers: low };
  }, [reviews, profileMap]);

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

  const upcomingPromotions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return (promotions ?? [])
      .filter((p: any) => p.nextReviewDate && p.nextReviewDate >= today && profileMap[p.profileId])
      .sort((a: any, b: any) => a.nextReviewDate.localeCompare(b.nextReviewDate))
      .slice(0, 5)
      .map((p: any) => ({
        id: p.id,
        profileId: p.profileId,
        fullName: profileMap[p.profileId]?.fullName || 'Unknown',
        avatarUrl: profileMap[p.profileId]?.avatarUrl,
        nextReviewDate: p.nextReviewDate,
      }));
  }, [promotions, profileMap]);

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
      <DashboardLayout title="Analytics" description="Employee performance analytics">
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Analytics" description="Employee performance and engagement metrics">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top row - Key metrics - spinner during inner load */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {renderLeaderboard(
              'Top Bounty Earners',
              <Trophy className="h-4 w-4 text-yellow-500" />,
              topBountyEarners,
              'pts',
              topBountyEarners[0]?.value
            )}

            {renderLeaderboard(
              'Top Performers',
              <Star className="h-4 w-4 text-green-500" />,
              topPerformers,
              '/ 5',
              5
            )}

            {renderLeaderboard(
              'Needs Improvement',
              <AlertTriangle className="h-4 w-4 text-orange-500" />,
              lowPerformers,
              '/ 5'
            )}
          </div>

          {/* Second row */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

            {/* Upcoming Promotions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Upcoming Promotions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingPromotions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No upcoming promotions</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingPromotions.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={item.avatarUrl || ''} />
                          <AvatarFallback className="text-xs">{getInitials(item.fullName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.fullName}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {format(new Date(item.nextReviewDate), 'MMM d')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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
