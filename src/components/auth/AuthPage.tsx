import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Building2, Bot, LayoutGrid, GitBranch } from 'lucide-react';
import { trpc } from '@/lib/trpc';

const pillars = [
  {
    icon: <Building2 className="h-4 w-4" />,
    title: 'Organize your org',
    desc: 'Departments, functions, people, and roles — all in one structured hierarchy.',
  },
  {
    icon: <Bot className="h-4 w-4" />,
    title: 'Plug in AI agents',
    desc: 'Attach agents to departments or functions to automate ops and surface insights.',
  },
  {
    icon: <LayoutGrid className="h-4 w-4" />,
    title: 'Centralize your IBAs',
    desc: 'Link all your internal business apps into one launcher your team can actually find.',
  },
  {
    icon: <GitBranch className="h-4 w-4" />,
    title: 'Open source',
    desc: 'Self-hostable, forkable, and built for businesses that want full ownership.',
  },
];

export const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const invitationId = searchParams.get('invitation');

  const meQuery = trpc.profiles.me.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && user && invitationId) {
      navigate(`/accept-invitation?invitation=${invitationId}`);
    } else if (!authLoading && user) {
      if (meQuery.data) {
        navigate(`/journey/${meQuery.data.id}`);
      } else if (!meQuery.isLoading) {
        navigate('/dashboard');
      }
    }
  }, [user, authLoading, invitationId, navigate, meQuery.data, meQuery.isLoading]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error, data } = await signIn(email, password);

    if (error) {
      toast({ title: 'Sign in failed', description: error.message || 'Invalid credentials', variant: 'destructive' });
    } else {
      toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
      navigate('/dashboard');
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signUp(email, password, fullName);

    if (error) {
      toast({ title: 'Sign up failed', description: error.message || 'Could not create account', variant: 'destructive' });
    } else {
      toast({ title: 'Account created!', description: 'Welcome to Seaport. Setting up your workspace...' });
      navigate('/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left — branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-muted/40 border-r border-border">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary p-2">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">Seaport</span>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Open Source Org OS</p>
            <h1 className="text-4xl font-bold leading-tight">
              The open platform for<br />AI-powered organizations.
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-sm">
              Seaport gives businesses a structured foundation to organize their people,
              plug AI agents into every layer of the org, and centralize all internal business apps — in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {pillars.map((p) => (
              <div key={p.title} className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary flex-shrink-0">
                  {p.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Open source &middot; Self-hostable &middot; Built for modern businesses
        </p>
      </div>

      {/* Right — auth form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 justify-center">
            <div className="rounded-lg bg-primary p-2">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">Seaport</span>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold">Get started</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your workspace or create a new one.</p>
          </div>

          <Card className="border-border shadow-sm">
            <CardContent className="pt-6">
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input id="signin-email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <Input id="signin-password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Signing in...' : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <Input id="signup-name" type="text" placeholder="Jane Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input id="signup-email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input id="signup-password" type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Creating account...' : 'Create Account'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Open source & self-hostable.{' '}
            <a href="https://github.com/seahawkmedia/seaport-for-vps" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">View on GitHub</a>
          </p>
        </div>
      </div>
    </div>
  );
};
