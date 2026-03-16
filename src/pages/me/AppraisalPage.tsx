import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { format } from 'date-fns';
import { Briefcase, Calendar, TrendingUp } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';

export default function MePromotionsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const { data: myProfile, isLoading: profileLoading } = trpc.profiles.me.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: promotionData, isLoading: promotionLoading } = trpc.promotions.get.useQuery(
    { profileId: myProfile?.id ?? '' },
    { enabled: !!myProfile?.id },
  );

  const loading = profileLoading || promotionLoading;

  const promotion = promotionData ?? null;
  const currentRole = promotion?.roleTitle || myProfile?.positionId || myProfile?.jobTitle || 'Not set';

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Promotions" description="View your role and promotion information">
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Promotions" description="View your role and promotion information">
      <div className="space-y-6">
        {/* Current Role Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Current Role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{currentRole}</div>
            {promotion?.salaryBand && (
              <Badge variant="secondary" className="mt-3">
                Band: {promotion.salaryBand}
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Review Dates */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Next Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">
                {promotion?.nextReviewDate
                  ? format(new Date(promotion.nextReviewDate), 'MMMM d, yyyy')
                  : 'Not scheduled'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Last Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">
                {promotion?.lastReviewDate
                  ? format(new Date(promotion.lastReviewDate), 'MMMM d, yyyy')
                  : 'No previous review'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        {promotion?.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{promotion.notes}</p>
            </CardContent>
          </Card>
        )}

        {!promotion && (
          <EmptyState
            icon={TrendingUp}
            title="No promotion data yet."
            description="Your promotion information will appear here once your manager sets it up."
          />
        )}
      </div>
    </DashboardLayout>
  );
}
