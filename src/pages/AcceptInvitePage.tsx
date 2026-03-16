import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { Building2, AlertCircle, Clock } from 'lucide-react';

interface InviteRow {
  id: string;
  organization_id: string;
  role: string;
  email: string;
  accepted: boolean;
  expires_at: string | null;
}

// Capture hash params IMMEDIATELY on module load, before Supabase client can clear them
const capturedHash = window.location.hash;
const capturedHashParams = new URLSearchParams(capturedHash.substring(1));

const AcceptInvitePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const hasRun = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorIsExpired, setErrorIsExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [userEmail, setUserEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteData, setInviteData] = useState<InviteRow | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    processInvite();
  }, []);

  const processInvite = async () => {
    try {
      const hashParams = capturedHashParams;

      // STEP 0 — Check for error params BEFORE doing anything with tokens
      const hashError = hashParams.get('error');
      const hashErrorCode = hashParams.get('error_code');
      const hashErrorDescription = hashParams.get('error_description');

      if (hashError) {
        if (hashErrorCode === 'otp_expired') {
          setError('This invite link has expired. Invite links are only valid for 24 hours. Please ask your admin to send a new invitation.');
          setErrorIsExpired(true);
        } else {
          setError(
            hashErrorDescription
              ? decodeURIComponent(hashErrorDescription.replace(/\+/g, ' '))
              : 'This invite link is invalid. Please ask your admin to send a new invitation.'
          );
        }
        setLoading(false);
        return;
      }

      // STEP 1 — Extract tokens from hash
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (!accessToken || !refreshToken) {
        // No tokens and no error — maybe user navigated here directly
        // Check if there's an existing session (user already completed invite)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', existingSession.user.id)
            .maybeSingle();

          if (existingProfile) {
            navigate(`/journey/${existingProfile.id}`, { replace: true });
            return;
          }
        }

        setError('This invite link is invalid or incomplete. Please ask your admin to send a new invitation.');
        setLoading(false);
        return;
      }

      // STEP 2 — Sign out any existing session first
      await supabase.auth.signOut();

      // STEP 3 — Set session with invite tokens (this consumes the token — do it ONCE)
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError || !sessionData.session) {
        // Token was already consumed — check if user already has an account
        const errorMsg = sessionError?.message?.toLowerCase() || '';
        const isAlreadyUsed = errorMsg.includes('expired') || errorMsg.includes('invalid') || errorMsg.includes('already');

        if (isAlreadyUsed) {
          toast({
            title: 'Account may already be set up',
            description: 'If you already accepted this invite, please log in instead.',
          });
          navigate('/auth', { replace: true });
          return;
        }

        setError('This invite link has expired or has already been used. Please ask your admin to send a new invite.');
        setErrorIsExpired(true);
        setLoading(false);
        return;
      }

      // STEP 4 — Session established successfully. Store user info.
      const sessionUser = sessionData.session.user;
      const email = sessionUser.email?.toLowerCase() || '';
      setUserEmail(email);
      setSessionUserId(sessionUser.id);

      // STEP 5 — Check if profile already exists (user completed signup before)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', sessionUser.id)
        .maybeSingle();

      if (existingProfile && existingProfile.organization_id) {
        // User already fully onboarded — redirect directly
        // Mark any pending invitations as accepted
        await supabase
          .from('invitations')
          .update({ accepted: true, accepted_at: new Date().toISOString() })
          .eq('email', email)
          .eq('accepted', false);

        toast({
          title: 'Welcome back!',
          description: 'Your account is already set up.',
        });
        navigate(`/journey/${existingProfile.id}`, { replace: true });
        return;
      }

      // STEP 6 — Validate invite row
      const { data: invite, error: inviteError } = await supabase
        .from('invitations')
        .select('*')
        .eq('email', email)
        .eq('accepted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (inviteError || !invite) {
        setError('No pending invitation found for this email address.');
        setLoading(false);
        return;
      }

      const invRow = invite as InviteRow;

      if (invRow.expires_at && new Date(invRow.expires_at) < new Date()) {
        setError('This invitation has expired. Please ask your admin to send a new one.');
        setErrorIsExpired(true);
        setLoading(false);
        return;
      }

      setInviteRole(invRow.role);
      setInviteData(invRow);

      // STEP 7 — Fetch org name
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', invRow.organization_id)
        .maybeSingle();

      setOrgName(org?.name || 'your organization');

      // STEP 8 — Show the password form
      setLoading(false);
    } catch (err) {
      console.error('Unexpected error in processInvite:', err);
      setError('Something went wrong. Please try again or contact your admin.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }
    if (!sessionUserId || !inviteData) {
      setValidationError('Session expired. Please use your invite link again.');
      return;
    }

    setSubmitting(true);

    try {
      // Set password
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) {
        toast({
          title: 'Failed to set password',
          description: pwError.message || 'Please try again.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      // Create profile
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: sessionUserId,
          email: userEmail,
          organization_id: inviteData.organization_id,
          full_name: '',
        })
        .select('id')
        .single();

      if (profileError) {
        // Profile might already exist (race condition) — try to fetch it
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', sessionUserId)
          .maybeSingle();

        if (existingProfile) {
          // Update org assignment
          await supabase
            .from('profiles')
            .update({ organization_id: inviteData.organization_id })
            .eq('id', existingProfile.id);

          await finalizeInvite(existingProfile.id);
          return;
        }

        console.error('Profile creation error:', profileError);
        toast({
          title: 'Failed to set up your profile',
          description: 'Please contact your admin.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      await finalizeInvite(newProfile.id);
    } catch (err) {
      console.error('Submit error:', err);
      toast({
        title: 'Something went wrong',
        description: 'Please try again.',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  const finalizeInvite = async (profileId: string) => {
    // Mark invitation as accepted
    if (inviteData) {
      await supabase
        .from('invitations')
        .update({ accepted: true, accepted_at: new Date().toISOString() })
        .eq('id', inviteData.id);
    }

    toast({
      title: `Welcome to ${orgName}!`,
      description: 'Your account is ready.',
    });

    navigate(`/journey/${profileId}`, { replace: true });
  };

  const handleRequestNewInvite = () => {
    toast({
      title: 'Contact your admin',
      description: 'Please contact your admin at your organisation to resend the invite.',
    });
  };

  const isFormValid = password.length >= 6 && password === confirmPassword;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Spinner className="h-8 w-8" />
            <p className="text-muted-foreground">Setting up your account...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-destructive p-3">
                {errorIsExpired ? (
                  <Clock className="w-6 h-6 text-destructive-foreground" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-destructive-foreground" />
                )}
              </div>
            </div>
            <CardTitle className="text-2xl">
              {errorIsExpired ? 'Invite Link Expired' : 'Invitation Error'}
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-3">
            {errorIsExpired && (
              <Button onClick={handleRequestNewInvite} variant="outline" className="w-full">
                Request New Invite
              </Button>
            )}
            <Button onClick={() => navigate('/')} className="w-full" variant={errorIsExpired ? 'secondary' : 'default'}>
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
          <CardTitle className="text-2xl">Welcome to {orgName}</CardTitle>
          <CardDescription>Set your password to activate your account</CardDescription>
          <div className="flex justify-center mt-2">
            <Badge variant="secondary" className="capitalize">{inviteRole}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={userEmail} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
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
              {submitting ? 'Setting up...' : 'Set Password & Join'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvitePage;
