import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { trpc } from '@/lib/trpc';

export const InvitationAcceptance = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);
  const { toast } = useToast();

  const token = searchParams.get('token') || searchParams.get('invitation') || '';

  const { data: verifyResult, isLoading: loading } = trpc.invitations.verify.useQuery(
    { token },
    { enabled: !!token }
  );

  const invitation = verifyResult?.valid ? verifyResult.invite : null;

  const handleAccept = async () => {
    if (!invitation?.id) return;

    setAccepting(true);
    try {
      // Note: accept_invitation RPC is not yet available as a tRPC route.
      // For now, navigate to signup/signin flow with the token.
      toast({
        title: "Invitation verified",
        description: "Please sign in or create an account to join the organization.",
      });
      navigate(`/auth?invite=${token}`);
    } catch (error: any) {
      toast({
        title: "Error accepting invitation",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">Loading invitation...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-destructive">No Pending Invitation</CardTitle>
            <CardDescription>
              We couldn't find any valid invitations for your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={() => navigate('/')} className="w-full" variant="outline">
              Go to Home
            </Button>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Join Organization</CardTitle>
          <CardDescription>
            You've been invited to join an organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Role: <span className="font-medium capitalize">{invitation.role}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Email: <span className="font-medium">{invitation.email}</span>
            </p>
          </div>
          <Button onClick={handleAccept} className="w-full" disabled={accepting}>
            {accepting ? "Accepting..." : "Accept Invitation"}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/auth')}
            className="w-full"
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
