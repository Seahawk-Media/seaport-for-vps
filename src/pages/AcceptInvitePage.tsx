import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { Building2, Clock } from 'lucide-react';

const AcceptInvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const verifyQuery = trpc.invitations.verify.useQuery(
    { token: token || '' },
    { enabled: !!token, retry: false }
  );

  const invite = verifyQuery.data?.invite;
  const isValid = verifyQuery.data?.valid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!fullName.trim()) {
      setValidationError('Please enter your full name.');
      return;
    }
    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }
    if (!invite) {
      setValidationError('Invalid invitation. Please request a new invite.');
      return;
    }

    setSubmitting(true);

    try {
      // Sign up with Better Auth
      const { error } = await authClient.signUp.email({
        name: fullName,
        email: invite.email,
        password,
      });

      if (error) {
        toast({
          title: 'Failed to create account',
          description: error.message || 'Please try again.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      toast({
        title: 'Welcome!',
        description: 'Your account is ready.',
      });

      navigate('/dashboard', { replace: true });
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'Please try again.',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  const handleRequestNewInvite = () => {
    toast({
      title: 'Contact your admin',
      description: 'Please contact your organisation admin to resend the invite.',
    });
  };

  const isFormValid = fullName.trim().length > 0 && password.length >= 6 && password === confirmPassword;

  if (verifyQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Spinner className="h-8 w-8" />
            <p className="text-muted-foreground">Verifying your invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValid || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-destructive p-3">
                <Clock className="w-6 h-6 text-destructive-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl">Invitation Invalid or Expired</CardTitle>
            <CardDescription>
              This invite link is no longer valid. It may have expired or already been used.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-3">
            <Button onClick={handleRequestNewInvite} variant="outline" className="w-full">
              Request New Invite
            </Button>
            <Button onClick={() => navigate('/')} className="w-full" variant="secondary">
              Return to Home
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Contact your organisation admin for a new invite link
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary p-3">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Join your team</CardTitle>
          <CardDescription>Create your account to get started</CardDescription>
          <div className="flex justify-center mt-2">
            <Badge variant="secondary" className="capitalize">{invite.role}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={invite.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {validationError && (
              <p className="text-sm font-medium text-destructive">{validationError}</p>
            )}
            <Button type="submit" className="w-full" disabled={!isFormValid || submitting}>
              {submitting ? 'Setting up...' : 'Create Account & Join'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvitePage;
