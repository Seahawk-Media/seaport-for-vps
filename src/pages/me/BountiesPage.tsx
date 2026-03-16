import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Plus, Trophy, ExternalLink } from 'lucide-react';
import { IncentiveSubmissionForm } from '@/components/incentives/IncentiveSubmissionForm';

interface Incentive {
  id: string;
  incentive_type: string;
  title: string;
  description: string | null;
  evidence_url: string | null;
  points: number;
  status: string;
  created_at: string;
}

export default function MeIncentivesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [incentives, setIncentives] = useState<Incentive[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const fetchIncentives = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      const { data, error } = await (supabase
        .from('incentives' as any)
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;
      setIncentives((data || []) as Incentive[]);
    } catch (error) {
      console.error('Error fetching incentives:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncentives();
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'pending': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const totalPoints = incentives
    .filter(b => b.status === 'approved')
    .reduce((sum, b) => sum + b.points, 0);

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Incentives" description="Log your achievements and earn points">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Incentives" description="Log your achievements and earn points">
      <div className="space-y-6">
        {/* Points Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Points Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <Trophy className="h-8 w-8 text-yellow-500" />
              {totalPoints}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Submit Incentive
          </Button>
        </div>

        {showForm && (
          <IncentiveSubmissionForm
            onClose={() => setShowForm(false)}
            onSuccess={() => {
              setShowForm(false);
              fetchIncentives();
            }}
          />
        )}

        {incentives.length === 0 ? (
          <EmptyState icon={Trophy} title="No incentives submitted yet." description="Submit your achievements to earn points!" />
        ) : (
          <div className="space-y-4">
            {incentives.map((incentive) => (
              <Card key={incentive.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{incentive.title}</CardTitle>
                        {incentive.evidence_url && (
                          <a
                            href={incentive.evidence_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      <CardDescription>
                        {incentive.incentive_type} • {format(new Date(incentive.created_at), 'MMM d, yyyy')}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{incentive.points} pts</span>
                      <Badge variant={getStatusColor(incentive.status)}>
                        {incentive.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                {incentive.description && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{incentive.description}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
