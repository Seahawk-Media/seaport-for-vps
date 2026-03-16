import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Briefcase, Calendar, TrendingUp } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';

interface ProfileData {
  id: string;
  full_name: string;
  job_title: string | null;
  position: {
    title: string;
    description: string | null;
  } | null;
}

interface Promotion {
  id: string;
  role_title: string | null;
  salary_band: string | null;
  next_review_date: string | null;
  last_review_date: string | null;
  notes: string | null;
}

export default function MePromotionsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            job_title,
            position:position_id(title, description)
          `)
          .eq('user_id', user.id)
          .single();

        if (profileData) {
          setProfile(profileData as unknown as ProfileData);

          const { data: promotionData } = await (supabase
            .from('promotions' as any)
            .select('*')
            .eq('profile_id', profileData.id)
            .single() as any);

          if (promotionData) {
            setPromotion(promotionData as Promotion);
          }
        }
      } catch (error) {
        console.error('Error fetching promotion data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Promotions" description="View your role and promotion information">
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </DashboardLayout>
    );
  }

  const currentRole = promotion?.role_title || profile?.position?.title || profile?.job_title || 'Not set';

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
            {profile?.position?.description && (
              <p className="text-muted-foreground mt-2">{profile.position.description}</p>
            )}
            {promotion?.salary_band && (
              <Badge variant="secondary" className="mt-3">
                Band: {promotion.salary_band}
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
                {promotion?.next_review_date
                  ? format(new Date(promotion.next_review_date), 'MMMM d, yyyy')
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
                {promotion?.last_review_date
                  ? format(new Date(promotion.last_review_date), 'MMMM d, yyyy')
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
