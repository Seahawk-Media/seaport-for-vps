import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useOrganization } from '@/hooks/useOrganization';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { format } from 'date-fns';
import { TrendingUp, Calendar, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DirectReport {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  promotion: {
    id: string;
    roleTitle: string | null;
    salaryBand: string | null;
    nextReviewDate: string | null;
    lastReviewDate: string | null;
  } | null;
}

export default function ManagePromotionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isManager, isAdmin, loading: roleLoading } = useRole();
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<DirectReport | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    roleTitle: '',
    salaryBand: '',
    nextReviewDate: '',
  });

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!roleLoading && !isManager() && !isAdmin()) navigate('/dashboard');
  }, [roleLoading, isManager, isAdmin, navigate]);

  const { data: myProfile } = trpc.profiles.me.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: allProfiles, isLoading: profilesLoading } = trpc.profiles.list.useQuery(undefined, {
    enabled: !!myProfile && !roleLoading,
  });

  const { data: allPromotions, isLoading: promotionsLoading, refetch: refetchPromotions } = trpc.promotions.list.useQuery(undefined, {
    enabled: !!myProfile && !roleLoading,
  });

  const upsertMutation = trpc.promotions.upsert.useMutation({
    onSuccess: () => {
      refetchPromotions();
    },
  });

  const loading = profilesLoading || promotionsLoading;

  const reports: DirectReport[] = useMemo(() => {
    if (!allProfiles || !myProfile) return [];
    const promotionMap = new Map((allPromotions ?? []).map((p: any) => [p.profileId, p]));

    const filtered = isAdmin()
      ? allProfiles
      : allProfiles.filter((p: any) => p.managerId === myProfile.id);

    return filtered
      .map((p: any) => {
        const promo = promotionMap.get(p.id);
        return {
          id: p.id,
          fullName: p.fullName,
          email: p.email,
          jobTitle: p.jobTitle ?? null,
          avatarUrl: p.avatarUrl ?? null,
          promotion: promo
            ? {
                id: promo.id,
                roleTitle: promo.roleTitle ?? null,
                salaryBand: promo.salaryBand ?? null,
                nextReviewDate: promo.nextReviewDate ?? null,
                lastReviewDate: promo.lastReviewDate ?? null,
              }
            : null,
        };
      })
      .sort((a: DirectReport, b: DirectReport) => (a.fullName ?? '').localeCompare(b.fullName ?? ''));
  }, [allProfiles, allPromotions, myProfile, isAdmin]);

  const handleEditClick = (report: DirectReport) => {
    setSelectedReport(report);
    setFormData({
      roleTitle: report.promotion?.roleTitle || report.jobTitle || '',
      salaryBand: report.promotion?.salaryBand || '',
      nextReviewDate: report.promotion?.nextReviewDate || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedReport || !organization) return;

    try {
      await upsertMutation.mutateAsync({
        profileId: selectedReport.id,
        roleTitle: formData.roleTitle || null,
        salaryBand: formData.salaryBand || null,
        nextReviewDate: formData.nextReviewDate || null,
      });

      toast({ title: 'Promotion saved', description: 'The promotion information has been updated.' });
      setIsDialogOpen(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to save promotion.', variant: 'destructive' });
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (authLoading || roleLoading || loading) {
    return (
      <DashboardLayout title="Promotions" description="Manage team promotions">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Promotions" description="Manage team promotion schedules">
      <div className="space-y-6">
        {reports.length === 0 ? (
          <EmptyState icon={TrendingUp} title="No team members to manage." />
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <Card key={report.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={report.avatarUrl || undefined} />
                        <AvatarFallback>{getInitials(report.fullName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{report.fullName}</CardTitle>
                        <CardDescription>
                          {report.promotion?.roleTitle || report.jobTitle || 'No role set'}
                          {report.promotion?.salaryBand && ` • Band: ${report.promotion.salaryBand}`}
                        </CardDescription>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(report)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Next review: {report.promotion?.nextReviewDate
                        ? format(new Date(report.promotion.nextReviewDate), 'MMM d, yyyy')
                        : 'Not scheduled'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Promotion — {selectedReport?.fullName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role Title</Label>
                <Input
                  id="role"
                  value={formData.roleTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, roleTitle: e.target.value }))}
                  placeholder="e.g., Senior Developer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="band">Salary Band</Label>
                <Input
                  id="band"
                  value={formData.salaryBand}
                  onChange={(e) => setFormData(prev => ({ ...prev, salaryBand: e.target.value }))}
                  placeholder="e.g., Band 4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next">Next Review Date</Label>
                <Input
                  id="next"
                  type="date"
                  value={formData.nextReviewDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, nextReviewDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
