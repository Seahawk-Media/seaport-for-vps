import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useOrganization } from '@/hooks/useOrganization';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Star, Calendar, Clock, TrendingUp, Heart, AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { format } from 'date-fns';

interface ProfileWithStats {
  id: string;
  full_name: string;
  avatar_url: string | null;
  value: number;
}

interface UpcomingPromotion {
  id: string;
  profile_id: string;
  full_name: string;
  avatar_url: string | null;
  next_review_date: string;
}

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isSuperAdmin, loading: roleLoading } = useRole();
  const { organization } = useOrganization();
  const navigate = useNavigate();
  
  const [topBountyEarners, setTopBountyEarners] = useState<ProfileWithStats[]>([]);
  const [topPerformers, setTopPerformers] = useState<ProfileWithStats[]>([]);
  const [lowPerformers, setLowPerformers] = useState<ProfileWithStats[]>([]);
  const [mostTimeOff, setMostTimeOff] = useState<ProfileWithStats[]>([]);
  const [mostOvertime, setMostOvertime] = useState<ProfileWithStats[]>([]);
  const [upcomingPromotions, setUpcomingPromotions] = useState<UpcomingPromotion[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (organization?.id) {
      fetchAnalytics();
    }
  }, [organization?.id]);

  const fetchAnalytics = async () => {
    if (!organization?.id) return;
    setLoading(true);

    try {
      // Fetch all profiles first for lookups
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('organization_id', organization.id);

      const profileMap = (profiles || []).reduce((acc: Record<string, any>, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      // Fetch top incentive earners (approved incentives)
      const { data: incentives } = await (supabase
        .from('incentives' as any)
        .select('profile_id, points')
        .eq('organization_id', organization.id)
        .eq('status', 'approved') as any);

      if (incentives) {
        const bountyByProfile = (incentives as any[]).reduce((acc: Record<string, number>, b: any) => {
          acc[b.profile_id] = (acc[b.profile_id] || 0) + (b.points || 0);
          return acc;
        }, {});
        
        const sorted = Object.entries(bountyByProfile)
          .filter(([pid]) => profileMap[pid])
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 5)
          .map(([pid, total]) => ({
            id: pid,
            full_name: profileMap[pid]?.full_name || 'Unknown',
            avatar_url: profileMap[pid]?.avatar_url,
            value: total as number
          }));
        setTopBountyEarners(sorted);
      }

      // Fetch performance reviews for top and low performers
      const { data: reviews } = await supabase
        .from('performance_reviews')
        .select('employee_id, overall_rating')
        .eq('organization_id', organization.id)
        .eq('status', 'submitted')
        .not('overall_rating', 'is', null);

      if (reviews) {
        const ratingByProfile = reviews.reduce((acc: Record<string, { ratings: number[] }>, r) => {
          const pid = r.employee_id;
          if (!acc[pid]) {
            acc[pid] = { ratings: [] };
          }
          if (r.overall_rating) {
            acc[pid].ratings.push(Number(r.overall_rating));
          }
          return acc;
        }, {});

        const profilesWithRatings = Object.entries(ratingByProfile)
          .filter(([pid]) => profileMap[pid])
          .map(([pid, data]) => ({
            pid,
            avg: data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length
          }));
        
        const topSorted = [...profilesWithRatings]
          .sort((a, b) => b.avg - a.avg)
          .slice(0, 5)
          .map(item => ({
            id: item.pid,
            full_name: profileMap[item.pid]?.full_name || 'Unknown',
            avatar_url: profileMap[item.pid]?.avatar_url,
            value: Math.round(item.avg * 10) / 10
          }));
        setTopPerformers(topSorted);

        const lowSorted = [...profilesWithRatings]
          .sort((a, b) => a.avg - b.avg)
          .slice(0, 5)
          .map(item => ({
            id: item.pid,
            full_name: profileMap[item.pid]?.full_name || 'Unknown',
            avatar_url: profileMap[item.pid]?.avatar_url,
            value: Math.round(item.avg * 10) / 10
          }));
        setLowPerformers(lowSorted);
      }

      // Fetch time off requests (approved, current year)
      const currentYear = new Date().getFullYear();
      const { data: timeOffs } = await supabase
        .from('time_off_requests')
        .select('profile_id, total_days')
        .eq('organization_id', organization.id)
        .eq('status', 'approved')
        .gte('start_date', `${currentYear}-01-01`);

      if (timeOffs) {
        const timeOffByProfile = timeOffs.reduce((acc: Record<string, number>, t) => {
          acc[t.profile_id] = (acc[t.profile_id] || 0) + (Number(t.total_days) || 0);
          return acc;
        }, {});

        const sorted = Object.entries(timeOffByProfile)
          .filter(([pid]) => profileMap[pid])
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([pid, total]) => ({
            id: pid,
            full_name: profileMap[pid]?.full_name || 'Unknown',
            avatar_url: profileMap[pid]?.avatar_url,
            value: total
          }));
        setMostTimeOff(sorted);
      }

      // Fetch overtime entries (approved, current year)
      const { data: overtimes } = await supabase
        .from('overtime_entries')
        .select('profile_id, hours')
        .eq('organization_id', organization.id)
        .eq('status', 'approved')
        .gte('date', `${currentYear}-01-01`);

      if (overtimes) {
        const overtimeByProfile = overtimes.reduce((acc: Record<string, number>, o) => {
          acc[o.profile_id] = (acc[o.profile_id] || 0) + (Number(o.hours) || 0);
          return acc;
        }, {});

        const sorted = Object.entries(overtimeByProfile)
          .filter(([pid]) => profileMap[pid])
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([pid, total]) => ({
            id: pid,
            full_name: profileMap[pid]?.full_name || 'Unknown',
            avatar_url: profileMap[pid]?.avatar_url,
            value: Math.round(total * 10) / 10
          }));
        setMostOvertime(sorted);
      }

      // Fetch upcoming promotions
      const today = new Date().toISOString().split('T')[0];
      const { data: promotionReviews } = await (supabase
        .from('promotions' as any)
        .select('id, profile_id, next_review_date')
        .eq('organization_id', organization.id)
        .gte('next_review_date', today)
        .order('next_review_date', { ascending: true })
        .limit(5) as any);

      if (promotionReviews) {
        const formatted = (promotionReviews as any[])
          .filter((a: any) => profileMap[a.profile_id])
          .map((a: any) => ({
            id: a.id,
            profile_id: a.profile_id,
            full_name: profileMap[a.profile_id]?.full_name || 'Unknown',
            avatar_url: profileMap[a.profile_id]?.avatar_url,
            next_review_date: a.next_review_date
          }));
        setUpcomingPromotions(formatted);
      }

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

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
                  <AvatarImage src={item.avatar_url || ''} />
                  <AvatarFallback className="text-xs">{getInitials(item.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.full_name}</p>
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
                          <AvatarImage src={item.avatar_url || ''} />
                          <AvatarFallback className="text-xs">{getInitials(item.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.full_name}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {format(new Date(item.next_review_date), 'MMM d')}
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
