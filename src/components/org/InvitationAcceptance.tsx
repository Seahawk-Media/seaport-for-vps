
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const InvitationAcceptance = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const { toast } = useToast();

  const invitationId = searchParams.get('invitation');

  useEffect(() => {
    const fetchInvitation = async () => {
      setLoading(true);

      try {
        let query = supabase
          .from('invitations')
          .select(`
            *,
            organizations (name)
          `)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString());

        if (invitationId) {
          query = query.eq('id', invitationId).limit(1);
        } else {
          // When no specific invitation is provided, use the most recent pending invite for the authenticated user
          query = query.order('created_at', { ascending: false }).limit(1);
        }

        const { data, error } = await query.maybeSingle();

        if (error) throw error;
        setInvitation(data);
      } catch (error: any) {
        toast({
          title: "Error fetching invitation",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [invitationId, toast]);

  const handleAccept = async () => {
    if (!invitation?.id) return;

    setAccepting(true);
    try {
      const { error } = await supabase.rpc('accept_invitation', {
        invitation_id: invitation.id,
      });

      if (error) throw error;

      toast({
        title: "Invitation accepted",
        description: "Welcome to the organization!",
      });

      navigate('/');
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
            You've been invited to join <strong>{invitation.organizations?.name}</strong>
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
