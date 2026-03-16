import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Star } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface PerformanceReview {
  id: string;
  review_period_start: string;
  review_period_end: string;
  overall_rating: number | null;
  status: string;
  reviewer_comments: string | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  goals: string | null;
  created_at: string;
  reviewer_name: string | null;
}

export default function MePerformancePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchMyReviews = async () => {
      if (!user) return;

      try {
        // Get current user's profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!profile) return;

        // Fetch reviews where I am the employee - use separate query for reviewer name
        const { data, error } = await supabase
          .from('performance_reviews')
          .select(`
            id,
            review_period_start,
            review_period_end,
            overall_rating,
            status,
            reviewer_comments,
            strengths,
            areas_for_improvement,
            goals,
            created_at,
            reviewer_id
          `)
          .eq('employee_id', profile.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch reviewer names separately
        const reviewsWithNames = await Promise.all(
          (data || []).map(async (review) => {
            let reviewerName = null;
            if (review.reviewer_id) {
              const { data: reviewerProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', review.reviewer_id)
                .single();
              reviewerName = reviewerProfile?.full_name || null;
            }
            return {
              id: review.id,
              review_period_start: review.review_period_start,
              review_period_end: review.review_period_end,
              overall_rating: review.overall_rating,
              status: review.status,
              reviewer_comments: review.reviewer_comments,
              strengths: review.strengths,
              areas_for_improvement: review.areas_for_improvement,
              goals: review.goals,
              created_at: review.created_at,
              reviewer_name: reviewerName,
            };
          })
        );

        setReviews(reviewsWithNames);
      } catch (error) {
        console.error('Error fetching reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMyReviews();
  }, [user]);

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
                      {review.review_period_start && review.review_period_end
                        ? `${format(new Date(review.review_period_start), 'MMM yyyy')} - ${format(new Date(review.review_period_end), 'MMM yyyy')}`
                        : 'Performance Review'}
                    </CardTitle>
                    <CardDescription>
                      Reviewed by {review.reviewer_name || 'Unknown'} on{' '}
                      {format(new Date(review.created_at), 'MMM d, yyyy')}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStars(review.overall_rating)}
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
                {review.areas_for_improvement && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Areas for Improvement</h4>
                    <p className="text-sm text-muted-foreground">{review.areas_for_improvement}</p>
                  </div>
                )}
                {review.goals && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Goals</h4>
                    <p className="text-sm text-muted-foreground">{review.goals}</p>
                  </div>
                )}
                {review.reviewer_comments && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Comments</h4>
                    <p className="text-sm text-muted-foreground">{review.reviewer_comments}</p>
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
