import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Trophy, Check, X, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Incentive {
  id: string;
  profile_id: string;
  incentive_type: string;
  title: string;
  description: string | null;
  evidence_url: string | null;
  points: number;
  status: string;
  created_at: string;
  profile_name: string;
}

export default function ManageIncentivesPage() {
  const { user, loading: authLoading } = useAuth();
  const { isManager, isAdmin, loading: roleLoading } = useRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [incentives, setIncentives] = useState<Incentive[]>([]);
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

  const fetchIncentives = async () => {
    if (!user || roleLoading) return;

    try {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

      if (!currentProfile) return;

      let profileIds: string[] = [];

      if (isAdmin()) {
        const { data: orgProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('organization_id', currentProfile.organization_id);
        profileIds = orgProfiles?.map(p => p.id) || [];
      } else {
        const { data: directReports } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', currentProfile.id);
        profileIds = directReports?.map(p => p.id) || [];
      }

      if (profileIds.length === 0) {
        setIncentives([]);
        setLoading(false);
        return;
      }

      const { data, error } = await (supabase
        .from('incentives' as any)
        .select('*')
        .in('profile_id', profileIds)
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', profileIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      const incentivesWithNames = (data || []).map((b: any) => ({
        ...b,
        profile_name: profileMap.get(b.profile_id) || 'Unknown',
      }));

      setIncentives(incentivesWithNames);
    } catch (error) {
      console.error('Error fetching incentives:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncentives();
  }, [user, roleLoading, isAdmin]);

  const handleApproval = async (incentiveId: string, approved: boolean) => {
    try {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      const { error } = await (supabase
        .from('incentives' as any)
        .update({
          status: approved ? 'approved' : 'rejected',
          reviewed_by: currentProfile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', incentiveId) as any);

      if (error) throw error;

      toast({
        title: approved ? 'Incentive approved' : 'Incentive rejected',
        description: `The incentive has been ${approved ? 'approved' : 'rejected'}.`,
      });
      fetchIncentives();
    } catch (error) {
      console.error('Error updating incentive:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the incentive.',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'pending': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  if (authLoading || roleLoading || loading) {
    return (
      <DashboardLayout title="Incentives" description="Review team achievements">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const pendingIncentives = incentives.filter(b => b.status === 'pending');
  const processedIncentives = incentives.filter(b => b.status !== 'pending');

  return (
    <DashboardLayout title="Incentives" description="Review and approve team achievements">
      <div className="space-y-8">
        {/* Pending Incentives */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Pending Review ({pendingIncentives.length})</h2>
          {pendingIncentives.length === 0 ? (
            <EmptyState icon={Trophy} title="No incentives pending review." />
          ) : (
            <div className="space-y-4">
              {pendingIncentives.map((incentive) => (
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
                          {incentive.profile_name} • {incentive.incentive_type} • {incentive.points} pts
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApproval(incentive.id, false)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApproval(incentive.id, true)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
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

        {/* Processed Incentives */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Decisions</h2>
          {processedIncentives.length === 0 ? (
            <EmptyState title="No processed incentives yet." />
          ) : (
            <div className="space-y-4">
              {processedIncentives.slice(0, 10).map((incentive) => (
                <Card key={incentive.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{incentive.title}</CardTitle>
                        <CardDescription>
                          {incentive.profile_name} • {incentive.incentive_type} • {incentive.points} pts
                        </CardDescription>
                      </div>
                      <Badge variant={getStatusColor(incentive.status)}>
                        {incentive.status}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
