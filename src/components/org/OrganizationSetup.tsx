import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { trpc } from '@/lib/trpc';
import { Building2, Bot, LayoutGrid, Users } from 'lucide-react';

interface OrganizationSetupProps {
  onComplete: () => void;
}

const steps = [
  {
    icon: <Users className="h-4 w-4" />,
    label: 'Structure your org',
    desc: 'Departments \u2192 Functions \u2192 People',
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
  const [formData, setFormData] = useState({ organizationName: '', fullName: '', email: '', password: '' });
  const { toast } = useToast();
  const navigate = useNavigate();

  const setupMutation = trpc.setup.complete.useMutation({
    onSuccess: () => {
      toast({ title: 'Organization created', description: "Your workspace is ready. Let's build your org." });
      onComplete();
    },
    onError: (error) => {
      toast({ title: 'Error creating organization', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setupMutation.mutate({
      orgName: formData.organizationName,
      adminName: formData.fullName,
      adminEmail: formData.email,
      adminPassword: formData.password,
    });
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
                  disabled={setupMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jane@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  disabled={setupMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  required
                  minLength={8}
                  disabled={setupMutation.isPending}
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
                  disabled={setupMutation.isPending}
                />
              </div>
              <Button type="submit" className="w-full" disabled={setupMutation.isPending}>
                {setupMutation.isPending ? 'Creating workspace...' : 'Create Organization'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Open source {'\u00B7'} Self-hostable {'\u00B7'} Departments {'\u2192'} Functions {'\u2192'} People
        </p>
      </div>
    </div>
  );
};
