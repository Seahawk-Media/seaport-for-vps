import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { trpc } from '@/lib/trpc';
import { format } from 'date-fns';
import { Trophy, Check, X, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ManageIncentivesPage() {
  const { user, loading: authLoading } = useAuth();
  const { isManager, isAdmin, loading: roleLoading } = useRole();
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const { data: allProfiles } = trpc.profiles.list.useQuery(undefined, {
    enabled: !!myProfile && !roleLoading,
  });

  const { data: allIncentives, isLoading: incentivesLoading, refetch: refetchIncentives } = trpc.incentives.list.useQuery(undefined, {
    enabled: !!myProfile && !roleLoading,
  });

  const reviewMutation = trpc.incentives.review.useMutation({
    onSuccess: () => {
      refetchIncentives();
    },
  });

  const loading = incentivesLoading;

  // Build profile IDs for filtering (admin sees all, manager sees direct reports)
  const profileIds = useMemo(() => {
    if (!allProfiles || !myProfile) return new Set<string>();
    if (isAdmin()) {
      return new Set(allProfiles.map((p: any) => p.id));
    }
    return new Set(allProfiles.filter((p: any) => p.managerId === myProfile.id).map((p: any) => p.id));
  }, [allProfiles, myProfile, isAdmin]);

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    (allProfiles ?? []).forEach((p: any) => map.set(p.id, p.fullName));
    return map;
  }, [allProfiles]);

  const incentives = useMemo(() => {
    return (allIncentives ?? [])
      .filter((i: any) => profileIds.has(i.profileId))
      .map((i: any) => ({
        ...i,
        profileName: profileMap.get(i.profileId) || 'Unknown',
      }))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allIncentives, profileIds, profileMap]);

  const handleApproval = async (incentiveId: string, approved: boolean) => {
    try {
      await reviewMutation.mutateAsync({
        id: incentiveId,
        status: approved ? 'approved' : 'rejected',
      });

      toast({
        title: approved ? 'Incentive approved' : 'Incentive rejected',
        description: `The incentive has been ${approved ? 'approved' : 'rejected'}.`,
      });
    } catch {
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

  const pendingIncentives = incentives.filter((b: any) => b.status === 'pending');
  const processedIncentives = incentives.filter((b: any) => b.status !== 'pending');

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
              {pendingIncentives.map((incentive: any) => (
                <Card key={incentive.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{incentive.title}</CardTitle>
                          {incentive.evidenceUrl && (
                            <a
                              href={incentive.evidenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        <CardDescription>
                          {incentive.profileName} • {incentive.incentiveType} • {incentive.points} pts
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
              {processedIncentives.slice(0, 10).map((incentive: any) => (
                <Card key={incentive.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{incentive.title}</CardTitle>
                        <CardDescription>
                          {incentive.profileName} • {incentive.incentiveType} • {incentive.points} pts
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
