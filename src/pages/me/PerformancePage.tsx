import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { trpc } from '@/lib/trpc';
import { format } from 'date-fns';
import { Star } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

export default function MePerformancePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const { data: myProfile } = trpc.profiles.me.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: reviewsData, isLoading: reviewsLoading } = trpc.reviews.list.useQuery(undefined, {
    enabled: !!myProfile,
  });

  const { data: profilesList } = trpc.profiles.list.useQuery(undefined, {
    enabled: !!myProfile,
  });

  // Filter reviews where the current user is the employee
  const reviews = (reviewsData ?? [])
    .filter((r: any) => r.employeeId === myProfile?.id)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((review: any) => {
      const reviewer = (profilesList ?? []).find((p: any) => p.id === review.reviewerId);
      return {
        id: review.id,
        reviewPeriodStart: review.reviewPeriodStart,
        reviewPeriodEnd: review.reviewPeriodEnd,
        overallRating: review.overallRating,
        status: review.status,
        reviewerComments: review.reviewerComments,
        strengths: review.strengths,
        areasForImprovement: review.areasForImprovement,
        goals: review.goals,
        createdAt: review.createdAt,
        reviewerName: reviewer?.fullName ?? null,
      };
    });

  const loading = reviewsLoading;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'default';
      case 'draft': return 'secondary';
      default: return 'outline';
    }
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
          />
        ))}
        <span className="ml-2 text-sm text-muted-foreground">{rating.toFixed(1)}</span>
      </div>
    );
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout title="My Performance" description="View your performance reviews">
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Performance" description="View your performance reviews">
      <div className="space-y-6">
        {reviews.length === 0 ? (
          <EmptyState title="No performance reviews yet." />
        ) : (
          reviews.map((review) => (
            <Card key={review.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {review.reviewPeriodStart && review.reviewPeriodEnd
                        ? `${format(new Date(review.reviewPeriodStart), 'MMM yyyy')} - ${format(new Date(review.reviewPeriodEnd), 'MMM yyyy')}`
                        : 'Performance Review'}
                    </CardTitle>
                    <CardDescription>
                      Reviewed by {review.reviewerName || 'Unknown'} on{' '}
                      {format(new Date(review.createdAt), 'MMM d, yyyy')}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStars(review.overallRating)}
                    <Badge variant={getStatusColor(review.status)}>
                      {review.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {review.strengths && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Strengths</h4>
                    <p className="text-sm text-muted-foreground">{review.strengths}</p>
                  </div>
                )}
                {review.areasForImprovement && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Areas for Improvement</h4>
                    <p className="text-sm text-muted-foreground">{review.areasForImprovement}</p>
                  </div>
                )}
                {review.goals && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Goals</h4>
                    <p className="text-sm text-muted-foreground">{review.goals}</p>
                  </div>
                )}
                {review.reviewerComments && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Comments</h4>
                    <p className="text-sm text-muted-foreground">{review.reviewerComments}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
