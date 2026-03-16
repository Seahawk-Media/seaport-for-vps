import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Bot, LayoutGrid, Users } from 'lucide-react';

interface OrganizationSetupProps {
  onComplete: () => void;
}

const steps = [
  {
    icon: <Users className="h-4 w-4" />,
    label: 'Structure your org',
    desc: 'Departments → Functions → People',
  },
  {
    icon: <Bot className="h-4 w-4" />,
    label: 'Plug in AI agents',
    desc: 'Attach agents to any department or function',
  },
  {
    icon: <LayoutGrid className="h-4 w-4" />,
    label: 'Centralize IBAs',
    desc: 'One launcher for all internal business apps',
  },
];

export const OrganizationSetup = ({ onComplete }: OrganizationSetupProps) => {
  const [formData, setFormData] = useState({ organizationName: '', fullName: '' });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkPendingInvite = async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('id')
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) { console.log('Error checking invitations in setup:', error); return; }
      if (data && data.length > 0) navigate(`/accept-invitation?invitation=${data[0].id}`);
    };
    checkPendingInvite();
  }, [navigate]);

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const slug = generateSlug(formData.organizationName);
      const { error } = await supabase.rpc('create_organization_and_profile', {
        org_name: formData.organizationName,
        org_slug: slug,
        user_full_name: formData.fullName,
      });
      if (error) throw error;
      toast({ title: 'Organization created', description: "Your workspace is ready. Let's build your org." });
      onComplete();
    } catch (error: any) {
      toast({ title: 'Error creating organization', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="rounded-xl bg-primary p-3">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Set up your organization</h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            You're creating an open org workspace. Structure your people, departments, and functions — 
            then plug in AI agents and centralize your internal apps.
          </p>
        </div>

        {/* What you're building cards */}
        <div className="grid grid-cols-3 gap-3">
          {steps.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-3 text-center space-y-1.5">
              <div className="flex justify-center">
                <div className="rounded-md bg-primary/10 p-1.5 text-primary">{s.icon}</div>
              </div>
              <p className="text-xs font-semibold leading-tight">{s.label}</p>
              <p className="text-[10px] text-muted-foreground leading-snug">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Create your workspace</CardTitle>
            <CardDescription className="text-xs">
              This is your organization's root. You can invite team members and configure departments after setup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Your Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Jane Smith"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organizationName">Organization Name</Label>
                <Input
                  id="organizationName"
                  type="text"
                  placeholder="Acme Corp"
                  value={formData.organizationName}
                  onChange={(e) => setFormData(prev => ({ ...prev, organizationName: e.target.value }))}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating workspace...' : 'Create Organization'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Open source · Self-hostable · Departments → Functions → People
        </p>
      </div>
    </div>
  );
};
