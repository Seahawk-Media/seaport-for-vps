import { useEffect, useState } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { TrendingUp, Calendar, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DirectReport {
  id: string;
  full_name: string;
  email: string;
  job_title: string | null;
  avatar_url: string | null;
  promotion: {
    id: string;
    role_title: string | null;
    salary_band: string | null;
    next_review_date: string | null;
    last_review_date: string | null;
  } | null;
}

export default function ManagePromotionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isManager, isAdmin, loading: roleLoading } = useRole();
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reports, setReports] = useState<DirectReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<DirectReport | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    role_title: '',
    salary_band: '',
    next_review_date: '',
  });

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!roleLoading && !isManager() && !isAdmin()) navigate('/dashboard');
  }, [roleLoading, isManager, isAdmin, navigate]);

  const fetchReports = async () => {
    if (!user || roleLoading) return;

    try {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

      if (!currentProfile) return;

      let query = supabase
        .from('profiles')
        .select('id, full_name, email, job_title, avatar_url');

      if (isAdmin()) {
        query = query.eq('organization_id', currentProfile.organization_id);
      } else {
        query = query.eq('manager_id', currentProfile.id);
      }

      const { data: profiles, error } = await query.order('full_name');
      if (error) throw error;

      const profileIds = profiles?.map(p => p.id) || [];
      if (profileIds.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      const { data: promotions } = await (supabase
        .from('promotions' as any)
        .select('id, profile_id, role_title, salary_band, next_review_date, last_review_date')
        .in('profile_id', profileIds) as any);

      const promotionMap = new Map((promotions || []).map((p: any) => [p.profile_id, p]));

      const reportsWithPromotions: DirectReport[] = (profiles || []).map(p => ({
        ...p,
        promotion: promotionMap.get(p.id) as DirectReport['promotion'] || null,
      }));

      setReports(reportsWithPromotions);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [user, roleLoading, isAdmin]);

  const handleEditClick = (report: DirectReport) => {
    setSelectedReport(report);
    setFormData({
      role_title: report.promotion?.role_title || report.job_title || '',
      salary_band: report.promotion?.salary_band || '',
      next_review_date: report.promotion?.next_review_date || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedReport || !organization) return;

    try {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user!.id)
        .single();

      if (selectedReport.promotion) {
        const { error } = await (supabase
          .from('promotions' as any)
          .update({
            role_title: formData.role_title || null,
            salary_band: formData.salary_band || null,
            next_review_date: formData.next_review_date || null,
          })
          .eq('id', selectedReport.promotion.id) as any);

        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from('promotions' as any)
          .insert({
            profile_id: selectedReport.id,
            organization_id: currentProfile?.organization_id,
            role_title: formData.role_title || null,
            salary_band: formData.salary_band || null,
            next_review_date: formData.next_review_date || null,
          }) as any);

        if (error) throw error;
      }

      toast({ title: 'Promotion saved', description: 'The promotion information has been updated.' });
      setIsDialogOpen(false);
      fetchReports();
    } catch (error) {
      console.error('Error saving promotion:', error);
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
                        <AvatarImage src={report.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(report.full_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{report.full_name}</CardTitle>
                        <CardDescription>
                          {report.promotion?.role_title || report.job_title || 'No role set'}
                          {report.promotion?.salary_band && ` • Band: ${report.promotion.salary_band}`}
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
                      Next review: {report.promotion?.next_review_date
                        ? format(new Date(report.promotion.next_review_date), 'MMM d, yyyy')
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
              <DialogTitle>Edit Promotion — {selectedReport?.full_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role Title</Label>
                <Input
                  id="role"
                  value={formData.role_title}
                  onChange={(e) => setFormData(prev => ({ ...prev, role_title: e.target.value }))}
                  placeholder="e.g., Senior Developer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="band">Salary Band</Label>
                <Input
                  id="band"
                  value={formData.salary_band}
                  onChange={(e) => setFormData(prev => ({ ...prev, salary_band: e.target.value }))}
                  placeholder="e.g., Band 4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next">Next Review Date</Label>
                <Input
                  id="next"
                  type="date"
                  value={formData.next_review_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, next_review_date: e.target.value }))}
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
